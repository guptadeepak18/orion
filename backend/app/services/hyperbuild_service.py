import math
import random
import string
import uuid
from datetime import datetime, date, time, timedelta, timezone
from typing import List, Optional, Tuple, Dict, Any

from sqlalchemy import select, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.models.session import (
    Session,
    StudentAttendance,
    HyperbuildActivity,
    HyperbuildActivityVerification,
    HyperbuildActivityAuditLog,
)
from app.models.academic import Subject, Batch
from app.models.student import Student
from app.models.auth import User
from app.schemas.hyperbuild import (
    HyperbuildActivityCreate,
    HyperbuildActivityResponse,
    HyperbuildConfigureRequest,
    HyperbuildChallengeKeyTriggerResponse,
    HyperbuildVerificationRequest,
    HyperbuildVerificationResponse,
    HyperbuildSessionDetailResponse,
    HyperbuildLiveRosterResponse,
    HyperbuildLiveRosterStudentItem,
    HyperbuildExtendWindowRequest,
    HyperbuildLockWindowRequest,
    HyperbuildReopenWindowRequest,
    HyperbuildWindowActionResponse,
    HyperbuildActivityAuditLogItem,
    HyperbuildAuditLogListResponse,
)
from app.services.websocket_service import broadcast_session_event

CAMPUS_LAT = 18.5204
CAMPUS_LNG = 73.8567
MAX_CAMPUS_RADIUS_METERS = 1500.0


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def generate_challenge_key(length: int = 3) -> str:
    chars = string.ascii_uppercase + "23456789"
    safe_chars = [c for c in chars if c not in "OI01"]
    return "".join(random.choice(safe_chars) for _ in range(length))


def normalize_domain_key(domain_str: Optional[str]) -> str:
    if not domain_str:
        return ""
    norm = domain_str.strip().lower()
    mapping = {
        "mkt": "marketing", "mktg": "marketing", "marketing": "marketing",
        "fin": "finance", "finance": "finance", "financial": "finance",
        "hr": "hr", "human resource": "hr", "human resources": "hr",
        "rba": "rba", "research and business analytics": "rba", "analytics": "rba", "business analytics": "rba",
        "ops": "operations", "operations": "operations", "supply chain": "operations",
        "ib": "international business", "international business": "international business",
        "core": "core", "general": "general"
    }
    return mapping.get(norm, norm)


def is_student_eligible_for_subject(student: Student, subject: Subject) -> Tuple[bool, str]:
    cat = (subject.course_category or "core").strip().lower()
    if cat == "core":
        return True, "Core Subject (Applicable for all students)"
    
    sub_domain = normalize_domain_key(subject.elective_domain)
    if not sub_domain:
        return True, "General Elective"
    
    raw_major = getattr(student, "specialization_major", None) or getattr(student, "major_specialization", None) or ""
    raw_minor = getattr(student, "specialization_minor", None) or getattr(student, "minor_specialization", None) or ""
    s_major = normalize_domain_key(raw_major)
    s_minor = normalize_domain_key(raw_minor)

    if sub_domain in [s_major, s_minor]:
        matched = raw_major if sub_domain == s_major else raw_minor
        return True, f"Specialization Elective Match ({matched})"
    
    return False, f"Domain Mismatch: Activity is for {subject.elective_domain.upper()} Elective"


def is_activity_submission_open(activity: HyperbuildActivity, session: Session) -> Tuple[bool, Optional[datetime], str]:
    now_utc = datetime.now(timezone.utc)

    # 1. Faculty manual lock takes priority
    if activity.is_submission_locked:
        return False, None, activity.lock_reason or "Submissions have been locked by faculty."

    # 2. Indefinitely reopened
    if activity.is_reopened_indefinite:
        return True, None, "Window is reopened by faculty."

    # 3. Timed reopen
    if activity.reopened_until:
        if now_utc <= activity.reopened_until:
            return True, activity.reopened_until, f"Window reopened until {activity.reopened_until.strftime('%H:%M')} UTC."
        else:
            return False, activity.reopened_until, "The reopened submission window timer has expired."

    # 4. Extended deadline
    if activity.extended_until:
        if now_utc <= activity.extended_until:
            return True, activity.extended_until, f"Window extended until {activity.extended_until.strftime('%H:%M')} UTC."
        else:
            return False, activity.extended_until, "The extended submission deadline has passed."

    # 5. Default window
    if activity.status == "closed":
        return False, None, "Scheduled activity window has closed."

    return True, None, "Window is active."


async def configure_hyperbuild_activities(
    db: AsyncSession,
    session_id: uuid.UUID,
    req: HyperbuildConfigureRequest,
) -> List[HyperbuildActivityResponse]:
    stmt = select(Session).where(Session.id == session_id, Session.is_deleted == False)
    res = await db.execute(stmt)
    sess = res.scalar_one_or_none()
    if not sess:
        raise ValueError("Session not found")

    if not req.activities:
        raise ValueError("At least one activity is required for a HyperBuild session")

    # Validate that every activity has a subject_id
    for item in req.activities:
        if not item.subject_id:
            raise ValueError(f"Subject is required for Activity #{item.activity_no}")

    # Fetch existing activities
    act_stmt = (
        select(HyperbuildActivity)
        .where(HyperbuildActivity.session_id == session_id)
        .order_by(HyperbuildActivity.activity_no.asc())
    )
    act_res = await db.execute(act_stmt)
    existing_activities = list(act_res.scalars().all())
    existing_by_no = {act.activity_no: act for act in existing_activities}

    new_activity_nos = {item.activity_no for item in req.activities}

    # Delete any activities that were explicitly removed
    for act in existing_activities:
        if act.activity_no not in new_activity_nos:
            await db.delete(act)

    for item in req.activities:
        if item.activity_no in existing_by_no:
            # Update existing activity in place
            act = existing_by_no[item.activity_no]
            act.title = item.title
            act.description = item.description
            act.subject_id = item.subject_id
            act.start_time = item.start_time
            act.end_time = item.end_time
            act.duration_minutes = item.duration_minutes
            act.submission_type = item.submission_type or "link_or_text"
            act.instructions = item.instructions
        else:
            # Create new activity
            act = HyperbuildActivity(
                session_id=session_id,
                activity_no=item.activity_no,
                title=item.title,
                description=item.description,
                subject_id=item.subject_id,
                start_time=item.start_time,
                end_time=item.end_time,
                duration_minutes=item.duration_minutes,
                submission_type=item.submission_type or "link_or_text",
                instructions=item.instructions,
                status="pending",
                auto_lock_at_end_time=True,
                is_submission_locked=False,
            )
            db.add(act)

    await db.commit()

    detail_res = await get_hyperbuild_session_details(db, session_id)
    return detail_res.activities


async def get_hyperbuild_session_details(
    db: AsyncSession,
    session_id: uuid.UUID,
    current_user_id: Optional[uuid.UUID] = None,
) -> HyperbuildSessionDetailResponse:
    sess_stmt = select(Session).where(Session.id == session_id, Session.is_deleted == False)
    sess_res = await db.execute(sess_stmt)
    sess = sess_res.scalar_one_or_none()
    if not sess:
        raise ValueError("Session not found")

    act_stmt = (
        select(HyperbuildActivity)
        .options(joinedload(HyperbuildActivity.subject))
        .where(HyperbuildActivity.session_id == session_id, HyperbuildActivity.is_deleted == False)
        .order_by(HyperbuildActivity.start_time.asc(), HyperbuildActivity.activity_no.asc())
    )
    act_res = await db.execute(act_stmt)
    activities = act_res.scalars().all()

    student = None
    if current_user_id:
        st_stmt = select(Student).where(Student.user_id == current_user_id)
        st_res = await db.execute(st_stmt)
        student = st_res.scalar_one_or_none()

    activity_responses = []
    active_activity_id = None

    # Current time in IST for session schedule matching
    ist = timezone(timedelta(hours=5, minutes=30))
    now_ist = datetime.now(ist).replace(tzinfo=None)

    for act in activities:
        is_elig = True
        elig_reason = None
        is_verif = False
        verif_status = None

        if student:
            is_elig, elig_reason = is_student_eligible_for_subject(student, act.subject)
            v_stmt = select(HyperbuildActivityVerification).where(
                HyperbuildActivityVerification.activity_id == act.id,
                HyperbuildActivityVerification.student_id == student.id,
                HyperbuildActivityVerification.is_deleted == False,
            )
            v_res = await db.execute(v_stmt)
            v_rec = v_res.scalar_one_or_none()
            if v_rec:
                is_verif = v_rec.is_key_valid
                verif_status = v_rec.verification_status

        cnt_stmt = select(HyperbuildActivityVerification).where(
            HyperbuildActivityVerification.activity_id == act.id,
            HyperbuildActivityVerification.is_key_valid == True,
            HyperbuildActivityVerification.is_deleted == False,
        )
        cnt_res = await db.execute(cnt_stmt)
        verified_cnt = len(cnt_res.scalars().all())

        is_open, open_until, _ = is_activity_submission_open(act, sess)

        # Dynamic status: if pending and within scheduled window, mark active
        act_status = act.status
        start_dt = datetime.combine(sess.session_date, act.start_time)
        end_dt = datetime.combine(sess.session_date, act.end_time)
        if act.status == "pending" and start_dt <= now_ist < end_dt and not act.is_submission_locked:
            act_status = "active"

        resp = HyperbuildActivityResponse(
            id=act.id,
            session_id=act.session_id,
            activity_no=act.activity_no,
            title=act.title,
            description=act.description,
            subject_id=act.subject_id,
            start_time=act.start_time,
            end_time=act.end_time,
            duration_minutes=act.duration_minutes,
            submission_type=act.submission_type,
            instructions=act.instructions,
            status=act_status,
            challenge_key=act.challenge_key,
            challenge_key_active_until=act.challenge_key_active_until,
            auto_lock_at_end_time=act.auto_lock_at_end_time,
            is_submission_locked=act.is_submission_locked,
            extended_until=act.extended_until,
            reopened_until=act.reopened_until,
            is_reopened_indefinite=act.is_reopened_indefinite,
            lock_reason=act.lock_reason,
            is_window_open=is_open,
            subject_name=act.subject.name if act.subject else None,
            subject_code=act.subject.code if act.subject else None,
            course_category=act.subject.course_category if act.subject else "core",
            elective_domain=act.subject.elective_domain if act.subject else None,
            is_eligible=is_elig,
            eligibility_reason=elig_reason,
            is_verified_by_student=is_verif,
            student_verification_status=verif_status,
            verified_count=verified_cnt,
            total_eligible_count=0,
        )
        activity_responses.append(resp)

        if act_status == "active" and not active_activity_id:
            active_activity_id = act.id

    if not active_activity_id and activity_responses:
        # Fallback to first eligible unverified activity, or first activity in time order
        unverified = [a for a in activity_responses if a.is_eligible and not a.is_verified_by_student]
        active_activity_id = unverified[0].id if unverified else activity_responses[0].id

    return HyperbuildSessionDetailResponse(
        session_id=sess.id,
        session_date=sess.session_date,
        start_time=sess.start_time,
        end_time=sess.end_time,
        venue=sess.venue or "Classroom",
        duration_minutes=sess.duration_minutes or 180,
        status=sess.status,
        total_activities=len(activity_responses),
        active_activity_id=active_activity_id,
        activities=activity_responses,
    )


async def trigger_activity_challenge_key(
    db: AsyncSession,
    activity_id: uuid.UUID,
    validity_seconds: int = 60,
    faculty_user: Optional[User] = None,
) -> HyperbuildChallengeKeyTriggerResponse:
    stmt = (
        select(HyperbuildActivity)
        .options(joinedload(HyperbuildActivity.session))
        .where(HyperbuildActivity.id == activity_id)
    )
    res = await db.execute(stmt)
    act = res.scalar_one_or_none()
    if not act:
        raise ValueError("Activity not found")

    key = generate_challenge_key(3)
    now_utc = datetime.now(timezone.utc)
    active_until = now_utc + timedelta(seconds=validity_seconds)

    act.challenge_key = key
    act.challenge_key_active_until = active_until
    act.status = "active"

    # Log key trigger in audit log
    audit_log = HyperbuildActivityAuditLog(
        activity_id=act.id,
        session_id=act.session_id,
        faculty_id=faculty_user.id if faculty_user else None,
        faculty_name=faculty_user.full_name if faculty_user else "Faculty",
        action="key_triggered",
        reason=f"Generated live 60s transition challenge key: '{key}'",
        window_open_until=active_until,
    )
    db.add(audit_log)

    await db.commit()
    await db.refresh(act)

    await broadcast_session_event(
        act.session_id,
        "challenge_key_triggered",
        {
            "activity_id": str(act.id),
            "activity_no": act.activity_no,
            "title": act.title,
            "challenge_key": key,
            "active_until": active_until.isoformat(),
            "active_seconds": validity_seconds,
        },
    )

    return HyperbuildChallengeKeyTriggerResponse(
        activity_id=act.id,
        activity_no=act.activity_no,
        title=act.title,
        challenge_key=key,
        active_until=active_until,
        active_seconds=validity_seconds,
    )


async def extend_activity_window(
    db: AsyncSession,
    activity_id: uuid.UUID,
    faculty_user: User,
    req: HyperbuildExtendWindowRequest,
) -> HyperbuildWindowActionResponse:
    stmt = (
        select(HyperbuildActivity)
        .options(joinedload(HyperbuildActivity.session))
        .where(HyperbuildActivity.id == activity_id)
    )
    res = await db.execute(stmt)
    act = res.scalar_one_or_none()
    if not act:
        raise ValueError("Activity not found")

    now_utc = datetime.now(timezone.utc)
    base_time = act.extended_until if (act.extended_until and act.extended_until > now_utc) else now_utc
    new_extended = base_time + timedelta(minutes=req.extension_minutes)

    act.extended_until = new_extended
    act.is_submission_locked = False
    act.lock_reason = None
    act.status = "active"

    audit_log = HyperbuildActivityAuditLog(
        activity_id=act.id,
        session_id=act.session_id,
        faculty_id=faculty_user.id,
        faculty_name=faculty_user.full_name or "Faculty",
        action="window_extended",
        extension_minutes=req.extension_minutes,
        window_open_until=new_extended,
        reason=req.reason or f"Extended by +{req.extension_minutes} mins by faculty",
    )
    db.add(audit_log)
    await db.commit()

    await broadcast_session_event(
        act.session_id,
        "window_extended",
        {
            "activity_id": str(act.id),
            "extended_until": new_extended.isoformat(),
            "extension_minutes": req.extension_minutes,
        },
    )

    return HyperbuildWindowActionResponse(
        activity_id=act.id,
        session_id=act.session_id,
        is_submission_locked=False,
        is_window_open=True,
        window_open_until=new_extended,
        is_reopened_indefinite=False,
        action_performed="window_extended",
        message=f"Submission window extended by +{req.extension_minutes} minutes.",
    )


async def lock_activity_window(
    db: AsyncSession,
    activity_id: uuid.UUID,
    faculty_user: User,
    req: HyperbuildLockWindowRequest,
) -> HyperbuildWindowActionResponse:
    stmt = (
        select(HyperbuildActivity)
        .options(joinedload(HyperbuildActivity.session))
        .where(HyperbuildActivity.id == activity_id)
    )
    res = await db.execute(stmt)
    act = res.scalar_one_or_none()
    if not act:
        raise ValueError("Activity not found")

    reason_text = req.reason.strip() if (req.reason and req.reason.strip()) else "Locked by faculty"
    act.is_submission_locked = True
    act.lock_reason = reason_text
    act.is_reopened_indefinite = False

    audit_log = HyperbuildActivityAuditLog(
        activity_id=act.id,
        session_id=act.session_id,
        faculty_id=faculty_user.id,
        faculty_name=faculty_user.full_name or "Faculty",
        action="window_locked",
        reason=reason_text,
    )
    db.add(audit_log)
    await db.commit()

    await broadcast_session_event(
        act.session_id,
        "window_locked",
        {
            "activity_id": str(act.id),
            "reason": reason_text,
        },
    )

    return HyperbuildWindowActionResponse(
        activity_id=act.id,
        session_id=act.session_id,
        is_submission_locked=True,
        is_window_open=False,
        window_open_until=None,
        is_reopened_indefinite=False,
        action_performed="window_locked",
        message="Submission window has been locked.",
    )


async def reopen_activity_window(
    db: AsyncSession,
    activity_id: uuid.UUID,
    faculty_user: User,
    req: HyperbuildReopenWindowRequest,
) -> HyperbuildWindowActionResponse:
    stmt = (
        select(HyperbuildActivity)
        .options(joinedload(HyperbuildActivity.session))
        .where(HyperbuildActivity.id == activity_id)
    )
    res = await db.execute(stmt)
    act = res.scalar_one_or_none()
    if not act:
        raise ValueError("Activity not found")

    now_utc = datetime.now(timezone.utc)
    act.is_submission_locked = False
    act.lock_reason = None
    act.status = "active"

    if req.mode == "manual_indefinite":
        act.is_reopened_indefinite = True
        act.reopened_until = None
        open_until = None
        action_name = "window_reopened_indefinite"
        msg = "Submission window reopened until manually locked by faculty."
    else:
        duration = req.duration_minutes or 15
        open_until = now_utc + timedelta(minutes=duration)
        act.reopened_until = open_until
        act.is_reopened_indefinite = False
        action_name = "window_reopened_timed"
        msg = f"Submission window reopened for {duration} minutes."

    audit_log = HyperbuildActivityAuditLog(
        activity_id=act.id,
        session_id=act.session_id,
        faculty_id=faculty_user.id,
        faculty_name=faculty_user.full_name or "Faculty",
        action=action_name,
        reopened_duration_minutes=req.duration_minutes if req.mode == "timed" else None,
        window_open_until=open_until,
        reason=req.reason or msg,
    )
    db.add(audit_log)
    await db.commit()

    await broadcast_session_event(
        act.session_id,
        "window_reopened",
        {
            "activity_id": str(act.id),
            "reopened_until": open_until.isoformat() if open_until else None,
            "is_reopened_indefinite": act.is_reopened_indefinite,
        },
    )

    return HyperbuildWindowActionResponse(
        activity_id=act.id,
        session_id=act.session_id,
        is_submission_locked=False,
        is_window_open=True,
        window_open_until=open_until,
        is_reopened_indefinite=act.is_reopened_indefinite,
        action_performed=action_name,
        message=msg,
    )


async def get_activity_audit_logs(
    db: AsyncSession,
    activity_id: uuid.UUID,
) -> HyperbuildAuditLogListResponse:
    stmt = (
        select(HyperbuildActivityAuditLog)
        .where(HyperbuildActivityAuditLog.activity_id == activity_id)
        .order_by(HyperbuildActivityAuditLog.created_at.desc())
    )
    res = await db.execute(stmt)
    logs = res.scalars().all()

    items = [
        HyperbuildActivityAuditLogItem(
            id=l.id,
            activity_id=l.activity_id,
            session_id=l.session_id,
            faculty_id=l.faculty_id,
            faculty_name=l.faculty_name,
            action=l.action,
            extension_minutes=l.extension_minutes,
            reopened_duration_minutes=l.reopened_duration_minutes,
            previous_status=l.previous_status,
            new_status=l.new_status,
            window_open_until=l.window_open_until,
            reason=l.reason,
            created_at=l.created_at,
        )
        for l in logs
    ]

    return HyperbuildAuditLogListResponse(
        activity_id=activity_id,
        total_events=len(items),
        logs=items,
    )


async def verify_student_activity_presence(
    db: AsyncSession,
    activity_id: uuid.UUID,
    student_user_id: uuid.UUID,
    req: HyperbuildVerificationRequest,
) -> HyperbuildVerificationResponse:
    """Verify student presence with clear, student-friendly explanations and contact guidance."""
    # 1. Fetch Student profile
    st_stmt = select(Student).where(Student.user_id == student_user_id)
    st_res = await db.execute(st_stmt)
    student = st_res.scalar_one_or_none()
    if not student:
        raise ValueError("Your student academic profile could not be found. Please contact the academic administrator.")

    # 2. Fetch Activity with Subject and Session
    act_stmt = (
        select(HyperbuildActivity)
        .options(
            joinedload(HyperbuildActivity.subject),
            joinedload(HyperbuildActivity.session),
        )
        .where(HyperbuildActivity.id == activity_id)
    )
    act_res = await db.execute(act_stmt)
    activity = act_res.scalar_one_or_none()
    if not activity:
        raise ValueError("The requested activity could not be found.")

    # 3. Check Submission Window Status
    is_open, _, lock_msg = is_activity_submission_open(activity, activity.session)
    if not is_open:
        raise ValueError(f"The submission window for this activity is currently closed ({lock_msg}). If you require additional time, please contact your faculty in class.")

    # 4. Check Specialization Eligibility
    is_elig, reason = is_student_eligible_for_subject(student, activity.subject)
    if not is_elig:
        domain_name = (activity.subject.elective_domain or "Elective").upper()
        raise ValueError(
            f"Attendance cannot be marked: You are not enrolled in this elective ({activity.subject.name}). "
            f"This activity is scheduled for {domain_name} students. If you believe this is a scheduling error, please contact your faculty."
        )

    # 5. Check Challenge Key
    now_utc = datetime.now(timezone.utc)
    if not activity.challenge_key:
        raise ValueError("No verification key is currently active for this activity. Please ask your faculty to reveal the screen key.")
    
    clean_entered = req.challenge_key.strip().upper()
    clean_expected = activity.challenge_key.strip().upper()
    
    if clean_entered != clean_expected:
        raise ValueError("The verification key entered does not match the active classroom code. Please check the screen or ask your faculty for the current key.")
    
    if activity.challenge_key_active_until and now_utc > activity.challenge_key_active_until:
        if now_utc > (activity.challenge_key_active_until + timedelta(seconds=15)):
            raise ValueError("The verification key has expired. Please ask your faculty to refresh the classroom key.")

    # 6. Geolocation Validation
    dist_meters = None
    is_geo_ok = True
    if req.latitude is not None and req.longitude is not None:
        dist_meters = haversine_distance(req.latitude, req.longitude, CAMPUS_LAT, CAMPUS_LNG)
        if dist_meters > MAX_CAMPUS_RADIUS_METERS:
            is_geo_ok = False
            raise ValueError("Campus presence could not be confirmed at your current location. Please ensure location services are enabled on your laptop, or contact your faculty in class.")

    # 7. Save or Update Verification Record
    v_stmt = select(HyperbuildActivityVerification).where(
        HyperbuildActivityVerification.activity_id == activity.id,
        HyperbuildActivityVerification.student_id == student.id,
    )
    v_res = await db.execute(v_stmt)
    v_rec = v_res.scalar_one_or_none()

    if not v_rec:
        v_rec = HyperbuildActivityVerification(
            activity_id=activity.id,
            session_id=activity.session_id,
            student_id=student.id,
            subject_id=activity.subject_id,
        )
        db.add(v_rec)

    v_rec.challenge_key_entered = clean_entered
    v_rec.is_key_valid = True
    v_rec.latitude = req.latitude
    v_rec.longitude = req.longitude
    v_rec.accuracy_meters = req.accuracy_meters
    v_rec.distance_from_campus_meters = dist_meters
    v_rec.is_geofence_valid = is_geo_ok
    v_rec.submission_url = req.submission_url
    v_rec.submission_text = req.submission_text
    v_rec.verification_status = "verified_present"
    v_rec.verified_at = now_utc

    # 8. Credit Attendance into StudentAttendance table for the session
    att_stmt = select(StudentAttendance).where(
        StudentAttendance.session_id == activity.session_id,
        StudentAttendance.student_id == student.id,
    )
    att_res = await db.execute(att_stmt)
    att_rec = att_res.scalar_one_or_none()

    if not att_rec:
        att_rec = StudentAttendance(
            session_id=activity.session_id,
            student_id=student.id,
            status="present",
        )
        db.add(att_rec)
    else:
        att_rec.status = "present"

    await db.commit()

    await broadcast_session_event(
        activity.session_id,
        "student_verified",
        {
            "activity_id": str(activity.id),
            "student_id": str(student.id),
            "student_name": student.full_name or "Student",
            "roll_no": student.roll_no or getattr(student, "prn_number", "") or "",
            "verified_at": now_utc.isoformat(),
        },
    )

    return HyperbuildVerificationResponse(
        activity_id=activity.id,
        student_id=student.id,
        is_verified=True,
        verification_status="verified_present",
        is_geofence_valid=is_geo_ok,
        distance_from_campus_meters=dist_meters,
        message=f"Attendance successfully verified for {activity.subject.name}! (+{activity.duration_minutes} mins credited)",
        credited_subject_id=activity.subject.id,
        credited_subject_name=activity.subject.name,
        credited_duration_minutes=activity.duration_minutes,
        verified_at=now_utc,
    )


async def get_activity_live_roster(
    db: AsyncSession,
    activity_id: uuid.UUID,
) -> HyperbuildLiveRosterResponse:
    act_stmt = (
        select(HyperbuildActivity)
        .options(
            joinedload(HyperbuildActivity.subject),
            joinedload(HyperbuildActivity.session),
        )
        .where(HyperbuildActivity.id == activity_id)
    )
    act_res = await db.execute(act_stmt)
    activity = act_res.scalar_one_or_none()
    if not activity:
        raise ValueError("Activity not found")

    batch_id = activity.session.batch_id
    st_stmt = (
        select(Student)
        .where(Student.batch_id == batch_id, Student.is_active == True)
        .order_by(Student.roll_no.asc(), Student.full_name.asc())
    )
    st_res = await db.execute(st_stmt)
    all_students = st_res.scalars().all()

    v_stmt = select(HyperbuildActivityVerification).where(
        HyperbuildActivityVerification.activity_id == activity.id,
        HyperbuildActivityVerification.is_deleted == False,
    )
    v_res = await db.execute(v_stmt)
    verifications = v_res.scalars().all()
    verif_map = {v.student_id: v for v in verifications}

    roster_items = []
    total_eligible = 0
    total_verified = 0

    for st in all_students:
        is_elig, elig_reason = is_student_eligible_for_subject(st, activity.subject)
        v_rec = verif_map.get(st.id)

        is_verif = False
        v_status = "unverified_absent"
        if not is_elig:
            v_status = "not_applicable"
        elif v_rec and v_rec.is_key_valid:
            is_verif = True
            v_status = v_rec.verification_status
            total_verified += 1

        if is_elig:
            total_eligible += 1

        roster_items.append(
            HyperbuildLiveRosterStudentItem(
                student_id=st.id,
                full_name=st.full_name or "Student",
                email=getattr(st, "email_official", "") or "",
                prn_no=getattr(st, "prn_number", "") or "",
                roll_no=getattr(st, "prn_number", "") or "",
                major_specialization=getattr(st, "specialization_major", None) or getattr(st, "major_specialization", None) or "",
                minor_specialization=getattr(st, "specialization_minor", None) or getattr(st, "minor_specialization", None) or "",
                is_eligible=is_elig,
                is_verified=is_verif,
                verification_status=v_status,
                verified_at=v_rec.verified_at if v_rec else None,
                submission_url=v_rec.submission_url if v_rec else None,
                submission_text=v_rec.submission_text if v_rec else None,
                distance_meters=v_rec.distance_from_campus_meters if v_rec else None,
                is_geofence_valid=v_rec.is_geofence_valid if v_rec else True,
            )
        )

    roster_items.sort(
        key=lambda x: (
            0 if x.is_verified else 1 if x.is_eligible else 2,
            x.full_name,
        )
    )

    return HyperbuildLiveRosterResponse(
        activity_id=activity.id,
        activity_no=activity.activity_no,
        activity_title=activity.title,
        subject_name=activity.subject.name,
        subject_code=activity.subject.code,
        course_category=activity.subject.course_category or "core",
        elective_domain=activity.subject.elective_domain,
        status=activity.status,
        challenge_key=activity.challenge_key,
        challenge_key_active_until=activity.challenge_key_active_until,
        total_batch_students=len(all_students),
        total_eligible_students=total_eligible,
        total_verified_present=total_verified,
        roster=roster_items,
    )
