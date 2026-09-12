import uuid
import asyncio
from datetime import datetime, timezone, date, time
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy import select, and_, or_, func, text, not_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.models.academic import Program, Batch, Subject, SubjectBatch, Topic
from app.models.faculty import FacultyInternal, FacultyExternal
from app.models.session import (
    Session,
    StudentAttendance,
    AttendanceCorrectionRequest,
    HyperbuildActivity,
    HyperbuildActivityVerification,
)
from app.models.student import Student
from app.models.auth import User
from app.schemas.session import SessionAttendanceBulkRequest, SessionAttendanceSheetResponse
from app.schemas.attendance import (
    AttendanceCorrectionCreate,
    AttendanceCorrectionResponse,
    SubjectAttendanceSummaryResponse,
    SubjectStudentAttendanceItem,
    SubjectSessionAttendanceItem,
    StudentAttendanceDossierResponse,
    StudentSubjectAttendanceBreakdown,
    StudentSessionAttendanceRecordItem,
    DebarredStudentItemResponse,
)
from app.services.session_service import (
    recalculate_batch_student_attendance,
    get_session_attendance_sheet,
    is_student_eligible_for_subject,
)
from app.services.email_template_service import trigger_activity_email


PRESENT_STATUSES = ["present", "late", "excused", "leave_approved", "od_duty", "on_duty", "on duty"]


async def get_faculty_profile_id_by_user_id(db: AsyncSession, user_id: UUID) -> tuple[Optional[UUID], Optional[str]]:
    """
    Returns (faculty_id, 'internal' | 'external') for a given user ID,
    matching either by direct user_id FK or user email.
    """
    user_stmt = select(User).where(User.id == user_id)
    u_res = (await db.execute(user_stmt)).unique()
    user = u_res.scalar_one_or_none()
    if not user:
        return None, None

    # Check FacultyInternal
    fi_stmt = select(FacultyInternal).where(
        or_(FacultyInternal.user_id == user_id, FacultyInternal.email.ilike(user.email))
    )
    fi_res = await db.execute(fi_stmt)
    fi = fi_res.scalar_one_or_none()
    if fi:
        if fi.user_id != user_id:
            fi.user_id = user_id
            await db.commit()
        return fi.id, "internal"

    # Check FacultyExternal
    fe_stmt = select(FacultyExternal).where(
        or_(FacultyExternal.user_id == user_id, FacultyExternal.email.ilike(user.email))
    )
    fe_res = await db.execute(fe_stmt)
    fe = fe_res.scalar_one_or_none()
    if fe:
        if fe.user_id != user_id:
            fe.user_id = user_id
            await db.commit()
        return fe.id, "external"

    return None, None


async def get_allocated_sessions_for_user(
    db: AsyncSession,
    user_id: UUID,
    user_roles: List[str],
    date_filter: Optional[date] = None,
    subject_id: Optional[UUID] = None,
    batch_id: Optional[UUID] = None,
    category: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Returns sessions available for attendance marking.
    Faculty members only see sessions allocated to them.
    Admins/coordinators see all sessions.
    """
    is_admin = any(r in ["crc_admin", "crc_coordinator", "approver", "reporting_readonly"] for r in user_roles)
    
    query = (
        select(Session)
        .options(
            selectinload(Session.subject),
            selectinload(Session.batch),
            selectinload(Session.program),
            selectinload(Session.faculty_internal),
            selectinload(Session.faculty_external),
        )
        .where(Session.is_deleted == False)
    )

    if date_filter:
        query = query.where(Session.session_date == date_filter)
    if subject_id:
        query = query.where(Session.subject_id == subject_id)
    if batch_id:
        query = query.where(
            or_(
                Session.batch_id == batch_id,
                Session.batch_ids.contains([str(batch_id)]),
            )
        )

    if category == "hyperbuild":
        query = query.where(or_(Session.session_type == "hyperbuild", Session.venue.ilike("%hyperbuild%")))
    elif category == "academic":
        query = query.where(and_(Session.session_type != "hyperbuild", not_(Session.venue.ilike("%hyperbuild%"))))

    if not is_admin:
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, user_id)
        if not fac_id:
            # User is neither admin nor matched faculty
            return []

        # Find subject batches allocated to this faculty
        if fac_type == "internal":
            alloc_stmt = select(SubjectBatch.subject_id, SubjectBatch.batch_id).where(
                SubjectBatch.faculty_internal_id == fac_id, SubjectBatch.status == "active"
            )
            alloc_res = await db.execute(alloc_stmt)
            allocated_pairs = alloc_res.all()

            conditions = [Session.faculty_internal_id == fac_id]
            for s_id, b_id in allocated_pairs:
                conditions.append(and_(Session.subject_id == s_id, Session.batch_id == b_id))

            query = query.where(or_(*conditions))
        else:
            alloc_stmt = select(SubjectBatch.subject_id, SubjectBatch.batch_id).where(
                SubjectBatch.faculty_external_id == fac_id, SubjectBatch.status == "active"
            )
            alloc_res = await db.execute(alloc_stmt)
            allocated_pairs = alloc_res.all()

            conditions = [Session.faculty_external_id == fac_id]
            for s_id, b_id in allocated_pairs:
                conditions.append(and_(Session.subject_id == s_id, Session.batch_id == b_id))

            query = query.where(or_(*conditions))

    query = query.order_by(Session.session_date.desc(), Session.start_time.asc())
    res = await db.execute(query)
    sessions = res.scalars().all()

    all_b_res = await db.execute(select(Batch.id, Batch.name))
    all_b_map = {row[0]: row[1] for row in all_b_res.all()}

    # Preload attendance stats for these sessions
    session_ids = [s.id for s in sessions]
    att_stats: Dict[UUID, Dict[str, Any]] = {}
    if session_ids:
        att_stmt = select(
            StudentAttendance.session_id,
            StudentAttendance.status,
            StudentAttendance.is_locked,
        ).where(StudentAttendance.session_id.in_(session_ids))
        att_res = await db.execute(att_stmt)
        for s_id, status, is_lck in att_res.all():
            if s_id not in att_stats:
                att_stats[s_id] = {"present": 0, "absent": 0, "total": 0, "is_locked": False}
            att_stats[s_id]["total"] += 1
            if status in PRESENT_STATUSES:
                att_stats[s_id]["present"] += 1
            elif status == "absent":
                att_stats[s_id]["absent"] += 1
            if is_lck:
                att_stats[s_id]["is_locked"] = True

    output = []
    for s in sessions:
        stats = att_stats.get(s.id, {"present": 0, "absent": 0, "total": 0, "is_locked": False})
        
        fac_name = "Unassigned"
        if s.faculty_internal:
            fac_name = s.faculty_internal.full_name or "Internal Faculty"
        elif s.faculty_external:
            fac_name = s.faculty_external.name or "External Faculty"

        is_hb = s.session_type == "hyperbuild" or (s.venue and "hyperbuild" in s.venue.lower())

        raw_bids = s.batch_ids if (s.batch_ids and isinstance(s.batch_ids, list)) else ([str(s.batch_id)] if s.batch_id else [])
        b_names = []
        for b in raw_bids:
            try:
                buuid = UUID(str(b))
                if buuid in all_b_map:
                    b_names.append(all_b_map[buuid])
            except Exception:
                pass
        combined_batch_name = ", ".join(b_names) if b_names else (s.batch.name if s.batch else None)

        output.append({
            "id": s.id,
            "session_date": s.session_date,
            "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
            "end_time": s.end_time.strftime("%H:%M") if s.end_time else "",
            "session_type": s.session_type,
            "category": "hyperbuild_session" if is_hb else "academic_lecture",
            "category_label": "HyperBuild Session" if is_hb else "Academic Lecture",
            "program_name": s.program.name if s.program else None,
            "batch_id": s.batch_id,
            "batch_ids": raw_bids,
            "batch_name": combined_batch_name,
            "batch_names": b_names,
            "subject_id": s.subject_id,
            "subject_name": s.subject.name if s.subject else ("HyperBuild Session" if is_hb else "Class Session"),
            "subject_code": s.subject.code if s.subject else ("HB" if is_hb else "SUB"),
            "venue": s.venue,
            "faculty_name": fac_name,
            "status": s.status,
            "attendance_status": s.attendance_status or ("marked" if stats["total"] > 0 else "pending"),
            "is_locked": stats["is_locked"],
            "present_count": stats["present"],
            "absent_count": stats["absent"],
            "total_students": stats["total"],
        })

    return output


async def mark_and_lock_session_attendance(
    db: AsyncSession,
    session_id: UUID,
    req: SessionAttendanceBulkRequest,
    current_user_id: UUID,
    user_roles: List[str],
) -> SessionAttendanceSheetResponse:
    """
    Marks initial attendance for a session and locks it.
    If already locked, faculty cannot casually modify records;
    they must raise a dual-approval correction request instead.
    """
    is_admin = any(r in ["crc_admin", "crc_coordinator"] for r in user_roles)
    
    session_stmt = (
        select(Session)
        .options(
            selectinload(Session.subject),
            selectinload(Session.batch),
        )
        .where(Session.id == session_id, Session.is_deleted == False)
    )
    s_res = await db.execute(session_stmt)
    session = s_res.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    # Fetch existing attendance records
    att_stmt = select(StudentAttendance).where(StudentAttendance.session_id == session_id)
    att_res = await db.execute(att_stmt)
    existing_records = {att.student_id: att for att in att_res.scalars().all()}

    # Check if attendance is already locked and user is NOT admin
    is_already_locked = any(att.is_locked for att in existing_records.values())
    if is_already_locked and not is_admin:
        raise ValueError(
            "Attendance for this class session is finalized and locked. "
            "Any change or dispute requires a Dual-Approval Correction Request."
        )

    # Faculty Authorization Guard: Non-admins can only mark attendance for their allocated sessions
    if not is_admin:
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, current_user_id)
        if not fac_id:
            raise ValueError("Unauthorized: Faculty profile not found for attendance marking.")

        is_assigned = False
        if fac_type == "internal" and session.faculty_internal_id == fac_id:
            is_assigned = True
        elif fac_type == "external" and session.faculty_external_id == fac_id:
            is_assigned = True

        if not is_assigned and session.subject_id:
            alloc_stmt = select(SubjectBatch).where(
                SubjectBatch.subject_id == session.subject_id,
                SubjectBatch.status == "active",
            )
            if fac_type == "internal":
                alloc_stmt = alloc_stmt.where(SubjectBatch.faculty_internal_id == fac_id)
            else:
                alloc_stmt = alloc_stmt.where(SubjectBatch.faculty_external_id == fac_id)
            if session.batch_id:
                alloc_stmt = alloc_stmt.where(SubjectBatch.batch_id == session.batch_id)
            alloc_res = await db.execute(alloc_stmt)
            if alloc_res.scalars().first():
                is_assigned = True

        if not is_assigned:
            raise ValueError("Unauthorized: You are only permitted to mark attendance for your allocated subjects and sessions.")

    now_utc = datetime.now(timezone.utc)

    # For HyperBuild sessions with activities that required challenge keys:
    hb_acts = []
    if session.session_type == "hyperbuild":
        act_res = await db.execute(
            select(HyperbuildActivity).where(
                HyperbuildActivity.session_id == session_id,
                HyperbuildActivity.is_deleted == False,
            )
        )
        hb_acts = act_res.scalars().all()

    hb_key_req = any((a.challenge_key is not None or a.status in ["active", "closed"]) for a in hb_acts)
    verified_student_ids = set()
    if hb_key_req:
        v_res = await db.execute(
            select(HyperbuildActivityVerification.student_id).where(
                HyperbuildActivityVerification.session_id == session_id,
                HyperbuildActivityVerification.is_key_valid == True,
                HyperbuildActivityVerification.is_deleted == False,
            )
        )
        verified_student_ids = set(v_res.scalars().all())

    for item in req.attendances:
        roll_status = item.status
        eff_status = item.status
        eff_remarks = item.remarks

        if hb_key_req:
            if roll_status in PRESENT_STATUSES:
                if item.student_id not in verified_student_ids:
                    eff_status = "absent"
                    rc_label = "Late" if roll_status == "late" else "Present"
                    eff_remarks = item.remarks or f"Auto-Absent: Secret key not entered (Roll call: {rc_label})"
            else:
                eff_status = "absent"

        if item.student_id in existing_records:
            existing = existing_records[item.student_id]
            existing.roll_call_status = roll_status
            existing.status = eff_status
            existing.remarks = eff_remarks
            existing.marked_by = current_user_id
            existing.is_locked = True
            existing.locked_at = now_utc
            existing.locked_by = current_user_id
        else:
            new_att = StudentAttendance(
                session_id=session.id,
                student_id=item.student_id,
                roll_call_status=roll_status,
                status=eff_status,
                remarks=eff_remarks,
                marked_by=current_user_id,
                is_locked=True,
                locked_at=now_utc,
                locked_by=current_user_id,
            )
            db.add(new_att)

    session.attendance_status = "marked"
    if session.status == "scheduled":
        session.status = "completed"

    await db.commit()

    # Recalculate automatic attendance percentage for all students across member batches
    all_bids = [session.batch_id] if session.batch_id else []
    if session.batch_ids and isinstance(session.batch_ids, list):
        for bid in session.batch_ids:
            try:
                uid = bid if isinstance(bid, uuid.UUID) else uuid.UUID(str(bid))
                if uid not in all_bids:
                    all_bids.append(uid)
            except Exception:
                pass
    for bid in all_bids:
        await recalculate_batch_student_attendance(db, bid)

    # Trigger student_daily_attendance_absent notifications for absent students
    try:
        absent_student_ids = [item.student_id for item in req.attendances if item.status == "absent"]
        if absent_student_ids:
            stud_stmt = select(Student).where(Student.id.in_(absent_student_ids), Student.is_deleted == False)
            stud_res = await db.execute(stud_stmt)
            absent_students = stud_res.scalars().all()

            subj_name = session.subject.name if session.subject else "Academic Lecture"
            fac_name = "Course Faculty"
            if session.faculty_internal:
                fac_name = session.faculty_internal.full_name or fac_name
            elif session.faculty_external:
                fac_name = session.faculty_external.name or fac_name

            for st in absent_students:
                recipient = st.email_official or st.email or st.email_personal
                if recipient:
                    await trigger_activity_email(
                        db=db,
                        event_key="student_daily_attendance_absent",
                        recipient_email=recipient,
                        context={
                            "student_name": st.full_name,
                            "subject_name": subj_name,
                            "session_date": str(session.session_date),
                            "session_time": f"{session.start_time.strftime('%H:%M')} - {session.end_time.strftime('%H:%M')}" if (session.start_time and session.end_time) else "Class Slot",
                            "faculty_name": fac_name,
                            "app_name": "Orion Portal",
                            "support_email": "deepak.gupta@mile.education",
                        },
                    )
    except Exception as e:
        logger.error(f"Error dispatching student_daily_attendance_absent emails: {e}")

    return await get_session_attendance_sheet(db, session_id)


async def get_subject_wise_attendance(
    db: AsyncSession,
    subject_id: UUID,
    batch_id: Optional[UUID] = None,
    current_user_id: Optional[UUID] = None,
    user_roles: Optional[List[str]] = None,
) -> SubjectAttendanceSummaryResponse:
    """
    Calculates overall course attendance analytics, session list, and student roster matrix.
    """
    roles = user_roles or []
    is_admin = any(r in ["crc_admin", "crc_coordinator", "approver", "reporting_readonly", "finance"] for r in roles)

    if not is_admin and current_user_id:
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, current_user_id)
        if fac_id:
            alloc_stmt = select(SubjectBatch).where(
                SubjectBatch.subject_id == subject_id,
                SubjectBatch.status == "active",
            )
            if fac_type == "internal":
                alloc_stmt = alloc_stmt.where(SubjectBatch.faculty_internal_id == fac_id)
            else:
                alloc_stmt = alloc_stmt.where(SubjectBatch.faculty_external_id == fac_id)
            if batch_id:
                alloc_stmt = alloc_stmt.where(SubjectBatch.batch_id == batch_id)
            alloc_res = await db.execute(alloc_stmt)
            if not alloc_res.scalars().first():
                raise ValueError("Access denied: You are not allocated to teach this subject.")

    sub_stmt = (
        select(Subject)
        .options(
            selectinload(Subject.batch_allocations).selectinload(SubjectBatch.batch),
        )
        .where(Subject.id == subject_id, Subject.is_deleted == False)
    )
    sub_res = await db.execute(sub_stmt)
    subject = sub_res.scalar_one_or_none()
    if not subject:
        raise ValueError("Subject not found")

    # Fetch marked sessions for this subject
    sess_stmt = (
        select(Session)
        .options(
            selectinload(Session.batch),
            selectinload(Session.faculty_internal),
            selectinload(Session.faculty_external),
            selectinload(Session.topic),
        )
        .where(
            Session.subject_id == subject_id,
            Session.is_deleted == False,
        )
    )
    if batch_id:
        sess_stmt = sess_stmt.where(Session.batch_id == batch_id)

    sess_stmt = sess_stmt.order_by(Session.session_date.desc(), Session.start_time.desc())
    sess_res = await db.execute(sess_stmt)
    all_sessions = sess_res.scalars().all()

    conducted_sessions = [s for s in all_sessions if s.attendance_status == "marked" or s.status == "completed"]
    total_conducted = len(conducted_sessions)
    total_scheduled = len(all_sessions)
    total_delivered_hours = sum((s.duration_minutes or 60) / 60.0 for s in conducted_sessions)

    # Fetch conducted HyperBuild activities tied to this subject
    hb_stmt = (
        select(HyperbuildActivity)
        .options(
            selectinload(HyperbuildActivity.session).selectinload(Session.batch),
            selectinload(HyperbuildActivity.session).selectinload(Session.faculty_internal),
            selectinload(HyperbuildActivity.session).selectinload(Session.faculty_external),
            selectinload(HyperbuildActivity.verifications),
        )
        .where(
            HyperbuildActivity.subject_id == subject_id,
            HyperbuildActivity.is_deleted == False,
        )
    )
    hb_res = await db.execute(hb_stmt)
    conducted_hb_activities = [
        act for act in hb_res.scalars().all()
        if act.session and (not batch_id or act.session.batch_id == batch_id)
        and (
            (act.status in ["active", "closed"])
            or (act.challenge_key is not None)
            or len(act.verifications) > 0
            or (act.session.attendance_status == "marked")
            or (act.session.status == "completed")
        )
    ]
    total_conducted += len(conducted_hb_activities)
    total_scheduled += len(conducted_hb_activities)
    total_delivered_hours += sum((act.duration_minutes or 60) / 60.0 for act in conducted_hb_activities)

    # Determine batch IDs
    relevant_batch_ids = list(set([s.batch_id for s in all_sessions]))
    for act in conducted_hb_activities:
        if act.session and act.session.batch_id:
            relevant_batch_ids.append(act.session.batch_id)
    relevant_batch_ids = list(set(relevant_batch_ids))

    if not relevant_batch_ids and subject.batch_allocations:
        relevant_batch_ids = [ba.batch_id for ba in subject.batch_allocations]

    # Fetch students for these batches and filter by elective domain eligibility
    students: List[Student] = []
    if relevant_batch_ids:
        st_stmt = (
            select(Student)
            .where(Student.batch_id.in_(relevant_batch_ids), Student.is_deleted == False)
            .order_by(Student.roll_no, Student.prn_number, Student.full_name)
        )
        st_res = await db.execute(st_stmt)
        all_batch_students = list(st_res.scalars().all())
        students = [st for st in all_batch_students if is_student_eligible_for_subject(subject, st)]

    # Preload all attendance records for conducted regular sessions of this subject
    conducted_session_ids = [s.id for s in conducted_sessions]
    student_att_counts: Dict[UUID, Dict[str, int]] = {st.id: {"present": 0, "absent": 0, "excused": 0} for st in students}

    if conducted_session_ids:
        att_stmt = select(
            StudentAttendance.student_id,
            StudentAttendance.status,
        ).where(StudentAttendance.session_id.in_(conducted_session_ids))
        att_res = await db.execute(att_stmt)
        for st_id, st_status in att_res.all():
            if st_id in student_att_counts:
                if st_status in ["present", "late"]:
                    student_att_counts[st_id]["present"] += 1
                elif st_status == "absent":
                    student_att_counts[st_id]["absent"] += 1
                else:
                    student_att_counts[st_id]["excused"] += 1

    # Preload parent session attendance for HyperBuild fallback
    hb_parent_session_ids = [act.session_id for act in conducted_hb_activities if act.session_id]
    parent_sess_att_map: Dict[Tuple[UUID, UUID], str] = {}
    if hb_parent_session_ids:
        p_att_stmt = select(StudentAttendance.session_id, StudentAttendance.student_id, StudentAttendance.status).where(
            StudentAttendance.session_id.in_(hb_parent_session_ids)
        )
        p_att_res = await db.execute(p_att_stmt)
        for s_id, st_id, st_st in p_att_res.all():
            parent_sess_att_map[(s_id, st_id)] = st_st

    # Aggregate attendance for HyperBuild activities of this subject
    hb_verif_map: Dict[Tuple[UUID, UUID], Any] = {}
    for act in conducted_hb_activities:
        for v in act.verifications:
            hb_verif_map[(act.id, v.student_id)] = v

    for act in conducted_hb_activities:
        for st in students:
            v_rec = hb_verif_map.get((act.id, st.id))
            if v_rec and v_rec.verification_status in ["verified_present", "late_submission", "present"]:
                student_att_counts[st.id]["present"] += 1
            elif not v_rec:
                parent_status = parent_sess_att_map.get((act.session_id, st.id))
                if parent_status and parent_status in PRESENT_STATUSES:
                    student_att_counts[st.id]["present"] += 1
                else:
                    student_att_counts[st.id]["absent"] += 1
            else:
                student_att_counts[st.id]["absent"] += 1

    # Compute students summary
    students_summary: List[SubjectStudentAttendanceItem] = []
    sum_percentages = 0.0

    for st in students:
        counts = student_att_counts.get(st.id, {"present": 0, "absent": 0, "excused": 0})
        # Present, Excused, and On-Duty count towards presence / attended classes
        attended = counts["present"] + counts["excused"]
        absent = counts["absent"]
        excused = counts["excused"]

        pct = round((attended / total_conducted * 100.0), 1) if total_conducted > 0 else 0.0
        sum_percentages += pct

        students_summary.append(
            SubjectStudentAttendanceItem(
                student_id=st.id,
                student_name=st.full_name or f"{st.first_name} {st.last_name or ''}".strip(),
                student_prn=st.prn_number or st.roll_no or "",
                roll_no=st.roll_no,
                sessions_conducted=total_conducted,
                attended_count=attended,
                absent_count=absent,
                excused_count=excused,
                attendance_percentage=pct,
                is_debarred_risk=pct < 75.0 and total_conducted >= 3,
            )
        )

    class_avg_pct = round(sum_percentages / len(students), 1) if (students and total_conducted > 0) else 0.0

    # Recent session items with present/absent counts
    recent_session_items: List[SubjectSessionAttendanceItem] = []
    if conducted_session_ids:
        session_stats_stmt = select(
            StudentAttendance.session_id,
            StudentAttendance.status,
            StudentAttendance.is_locked,
        ).where(StudentAttendance.session_id.in_(conducted_session_ids))
        sstats_res = await db.execute(session_stats_stmt)
        s_stats_map: Dict[UUID, Dict[str, Any]] = {}
        for s_id, st_st, is_lck in sstats_res.all():
            if s_id not in s_stats_map:
                s_stats_map[s_id] = {"present": 0, "absent": 0, "total": 0, "is_locked": False}
            s_stats_map[s_id]["total"] += 1
            if st_st in PRESENT_STATUSES:
                s_stats_map[s_id]["present"] += 1
            elif st_st == "absent":
                s_stats_map[s_id]["absent"] += 1
            if is_lck:
                s_stats_map[s_id]["is_locked"] = True

        for sess in conducted_sessions[:20]:
            stt = s_stats_map.get(sess.id, {"present": 0, "absent": 0, "total": 0, "is_locked": False})
            fac_name = "Faculty"
            if sess.faculty_internal:
                fac_name = sess.faculty_internal.full_name or "Internal Faculty"
            elif sess.faculty_external:
                fac_name = sess.faculty_external.name or "External Faculty"

            recent_session_items.append(
                SubjectSessionAttendanceItem(
                    session_id=sess.id,
                    session_date=sess.session_date,
                    start_time=sess.start_time.strftime("%H:%M") if sess.start_time else "09:00",
                    end_time=sess.end_time.strftime("%H:%M") if sess.end_time else "10:30",
                    venue=sess.venue,
                    faculty_name=fac_name,
                    topic_title=sess.topic.title if sess.topic else None,
                    status=sess.status,
                    attendance_status=sess.attendance_status or "marked",
                    total_students=stt["total"],
                    present_count=stt["present"],
                    absent_count=stt["absent"],
                    is_locked=stt["is_locked"],
                )
            )

    # Also add HyperBuild activities to recent session items
    for act in conducted_hb_activities[:10]:
        act_sess = act.session
        hb_present = sum(1 for v in act.verifications if v.verification_status in ["verified_present", "late_submission", "present"])
        hb_fac_name = "Faculty"
        if act_sess.faculty_internal:
            hb_fac_name = act_sess.faculty_internal.full_name or "Internal Faculty"
        elif act_sess.faculty_external:
            hb_fac_name = act_sess.faculty_external.name or "External Faculty"

        recent_session_items.append(
            SubjectSessionAttendanceItem(
                session_id=act.session_id,
                session_date=act_sess.session_date,
                start_time=act.start_time.strftime("%H:%M") if act.start_time else (act_sess.start_time.strftime("%H:%M") if act_sess.start_time else "14:00"),
                end_time=act.end_time.strftime("%H:%M") if act.end_time else (act_sess.end_time.strftime("%H:%M") if act_sess.end_time else "17:00"),
                venue=f"{act_sess.venue or 'HyperBuild Lab'} · Act #{act.activity_no}",
                faculty_name=hb_fac_name,
                topic_title=act.title,
                status="completed",
                attendance_status="marked",
                total_students=len(students),
                present_count=hb_present,
                absent_count=max(0, len(students) - hb_present),
                is_locked=act.is_submission_locked,
            )
        )

    recent_session_items.sort(key=lambda x: x.session_date, reverse=True)

    first_batch = subject.batch_allocations[0].batch if subject.batch_allocations else None

    return SubjectAttendanceSummaryResponse(
        subject_id=subject.id,
        subject_name=subject.name,
        subject_code=subject.code or subject.course_code,
        batch_id=batch_id or (first_batch.id if first_batch else None),
        batch_name=first_batch.name if first_batch else "PGDM Core",
        program_name="PGDM",
        total_sessions_conducted=total_conducted,
        total_sessions_scheduled=total_scheduled,
        total_delivered_hours=round(total_delivered_hours, 1),
        class_average_percentage=class_avg_pct,
        students_summary=students_summary,
        recent_sessions=recent_session_items,
    )


async def get_student_attendance_dossier(
    db: AsyncSession,
    student_id: UUID,
) -> StudentAttendanceDossierResponse:
    """
    Returns full individual student attendance history, subject breakdown,
    and pending correction request status for each session.
    """
    st_stmt = (
        select(Student)
        .options(
            selectinload(Student.batch),
            selectinload(Student.program),
        )
        .where(Student.id == student_id, Student.is_deleted == False)
    )
    st_res = await db.execute(st_stmt)
    student = st_res.scalar_one_or_none()
    if not student:
        raise ValueError("Student not found")

    # Fetch all attendance records for this student
    att_stmt = (
        select(StudentAttendance)
        .options(
            selectinload(StudentAttendance.session).selectinload(Session.subject),
            selectinload(StudentAttendance.session).selectinload(Session.faculty_internal),
            selectinload(StudentAttendance.session).selectinload(Session.faculty_external),
            selectinload(StudentAttendance.session).selectinload(Session.hyperbuild_activities).selectinload(HyperbuildActivity.subject),
        )
        .where(StudentAttendance.student_id == student_id)
        .order_by(StudentAttendance.created_at.desc())
    )
    att_res = await db.execute(att_stmt)
    records = list(att_res.scalars().all())

    # Fetch all HyperBuild activity verifications for this student
    hb_v_stmt = (
        select(HyperbuildActivityVerification)
        .options(
            selectinload(HyperbuildActivityVerification.activity).selectinload(HyperbuildActivity.subject),
            selectinload(HyperbuildActivityVerification.session).selectinload(Session.faculty_internal),
            selectinload(HyperbuildActivityVerification.session).selectinload(Session.faculty_external),
        )
        .where(HyperbuildActivityVerification.student_id == student_id)
    )
    hb_v_res = await db.execute(hb_v_stmt)
    hb_verifs = {v.activity_id: v for v in hb_v_res.scalars().all()}

    # Fetch correction requests for this student
    corr_stmt = select(AttendanceCorrectionRequest).where(AttendanceCorrectionRequest.student_id == student_id)
    corr_res = await db.execute(corr_stmt)
    corr_map = {c.attendance_id: c for c in corr_res.scalars().all()}

    # Group by subject
    subjects_map: Dict[UUID, Dict[str, Any]] = {}
    session_items: List[StudentSessionAttendanceRecordItem] = []

    total_classes = 0
    attended_classes = 0

    for r in records:
        if not r.session:
            continue

        sess = r.session

        # ── Case A: HyperBuild Session with Activities (Multi-Subject) ──
        if sess.hyperbuild_activities and len(sess.hyperbuild_activities) > 0:
            activities_added_count = 0
            for act in sorted(sess.hyperbuild_activities, key=lambda a: a.activity_no):
                # Only count conducted activities (active, closed, or has challenge_key/verifications, or session is marked/completed)
                is_conducted = (
                    (act.status in ["active", "closed"])
                    or (act.challenge_key is not None)
                    or (act.id in hb_verifs)
                    or (sess.attendance_status == "marked")
                    or (sess.status == "completed")
                )
                if not is_conducted:
                    continue

                sub = act.subject
                if sub:
                    if not is_student_eligible_for_subject(sub, student):
                        continue
                    sub_id = sub.id
                    sub_name = sub.name
                    sub_code = sub.code or sub.course_code or "SUB"
                else:
                    sub_id = act.id
                    sub_name = act.title or "HyperBuild Practical Lab"
                    sub_code = "HYPERBUILD"

                # Check whether this activity required secret key verification
                act_required_key = (
                    (act.challenge_key is not None)
                    or (act.status in ["active", "closed"])
                    or (act.id in hb_verifs)
                )

                parent_is_present = (r.status in PRESENT_STATUSES) or (getattr(r, "roll_call_status", None) in PRESENT_STATUSES)
                v_rec = hb_verifs.get(act.id)
                v_is_present = v_rec is not None and v_rec.verification_status in ["verified_present", "late_submission", "present"]

                if act_required_key:
                    if parent_is_present and v_is_present:
                        is_att = True
                        act_status = "late" if (getattr(r, "roll_call_status", None) == "late" or r.status == "late") else "present"
                        item_remarks = f"HyperBuild: {act.title} (Verified)"
                    elif parent_is_present and not v_is_present:
                        is_att = False
                        act_status = "absent"
                        item_remarks = f"HyperBuild: {act.title} (Absent: Secret key not entered)"
                    elif not parent_is_present:
                        is_att = False
                        act_status = r.status or "absent"
                        item_remarks = f"HyperBuild: {act.title} (Roll Call: Absent)"
                    else:
                        is_att = False
                        act_status = "absent"
                        item_remarks = f"HyperBuild: {act.title}"
                else:
                    is_att = parent_is_present
                    act_status = r.status or ("present" if is_att else "absent")
                    item_remarks = f"HyperBuild: {act.title}"

                total_classes += 1
                if is_att:
                    attended_classes += 1
                activities_added_count += 1

                if sub_id not in subjects_map:
                    subjects_map[sub_id] = {
                        "id": sub_id,
                        "name": sub_name,
                        "code": sub_code,
                        "academic": {"total": 0, "attended": 0, "absent": 0, "excused": 0},
                        "hyperbuild": {"total": 0, "attended": 0, "absent": 0, "excused": 0},
                        "total": 0,
                        "attended": 0,
                        "absent": 0,
                        "excused": 0,
                    }

                subjects_map[sub_id]["total"] += 1
                subjects_map[sub_id]["hyperbuild"]["total"] += 1
                if is_att:
                    subjects_map[sub_id]["attended"] += 1
                    subjects_map[sub_id]["hyperbuild"]["attended"] += 1
                elif act_status in ["excused", "leave_approved", "od_duty", "on_duty", "on duty"]:
                    subjects_map[sub_id]["excused"] += 1
                    subjects_map[sub_id]["hyperbuild"]["excused"] += 1
                else:
                    subjects_map[sub_id]["absent"] += 1
                    subjects_map[sub_id]["hyperbuild"]["absent"] += 1

                fac_name = "Faculty"
                if sess.faculty_internal:
                    fac_name = sess.faculty_internal.full_name or "Internal Faculty"
                elif sess.faculty_external:
                    fac_name = sess.faculty_external.name or "External Faculty"

                corr = corr_map.get(r.id)

                s_time = act.start_time.strftime("%H:%M") if act.start_time else (sess.start_time.strftime("%H:%M") if sess.start_time else "")
                e_time = act.end_time.strftime("%H:%M") if act.end_time else (sess.end_time.strftime("%H:%M") if sess.end_time else "")

                session_items.append(
                    StudentSessionAttendanceRecordItem(
                        attendance_id=r.id,
                        session_id=sess.id,
                        activity_id=act.id,
                        subject_id=sub_id,
                        subject_name=sub_name,
                        subject_code=sub_code,
                        faculty_name=fac_name,
                        session_date=sess.session_date,
                        start_time=s_time,
                        end_time=e_time,
                        venue=f"{sess.venue or 'HyperBuild Lab'} · Act #{act.activity_no}",
                        status=act_status,
                        remarks=item_remarks,
                        is_locked=r.is_locked,
                        has_pending_correction=corr is not None and corr.status in ["pending_faculty_approval", "pending_admin_approval"],
                        correction_request_id=corr.id if corr else None,
                        correction_status=corr.status if corr else None,
                        category="hyperbuild_activity",
                        category_label="HyperBuild Activity",
                        activity_title=act.title,
                        activity_no=act.activity_no,
                    )
                )

            # Fallback if no activities matched eligibility/conduct criteria
            if activities_added_count == 0 and (sess.attendance_status == "marked" or sess.status == "completed"):
                sub = sess.subject
                if not (sub and not is_student_eligible_for_subject(sub, student)):
                    total_classes += 1
                    is_attended = r.status in PRESENT_STATUSES
                    if is_attended:
                        attended_classes += 1

                    if sub:
                        sub_id = sub.id
                        sub_name = sub.name
                        sub_code = sub.code or sub.course_code or "SUB"
                    else:
                        sub_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
                        sub_name = "HyperBuild Practical Lab"
                        sub_code = "HYPERBUILD"

                    if sub_id not in subjects_map:
                        subjects_map[sub_id] = {
                            "id": sub_id,
                            "name": sub_name,
                            "code": sub_code,
                            "academic": {"total": 0, "attended": 0, "absent": 0, "excused": 0},
                            "hyperbuild": {"total": 0, "attended": 0, "absent": 0, "excused": 0},
                            "total": 0,
                            "attended": 0,
                            "absent": 0,
                            "excused": 0,
                        }
                    subjects_map[sub_id]["total"] += 1
                    subjects_map[sub_id]["hyperbuild"]["total"] += 1
                    if is_attended:
                        subjects_map[sub_id]["attended"] += 1
                        subjects_map[sub_id]["hyperbuild"]["attended"] += 1
                    elif r.status in ["excused", "leave_approved", "od_duty", "on_duty", "on duty"]:
                        subjects_map[sub_id]["excused"] += 1
                        subjects_map[sub_id]["hyperbuild"]["excused"] += 1
                    else:
                        subjects_map[sub_id]["absent"] += 1
                        subjects_map[sub_id]["hyperbuild"]["absent"] += 1

                    fac_name = "Faculty"
                    if sess.faculty_internal:
                        fac_name = sess.faculty_internal.full_name or "Internal Faculty"
                    elif sess.faculty_external:
                        fac_name = sess.faculty_external.name or "External Faculty"

                    corr = corr_map.get(r.id)
                    s_time = sess.start_time.strftime("%H:%M") if sess.start_time else ""
                    e_time = sess.end_time.strftime("%H:%M") if sess.end_time else ""

                    session_items.append(
                        StudentSessionAttendanceRecordItem(
                            attendance_id=r.id,
                            session_id=sess.id,
                            subject_id=sub_id,
                            subject_name=sub_name,
                            subject_code=sub_code,
                            faculty_name=fac_name,
                            session_date=sess.session_date,
                            start_time=s_time,
                            end_time=e_time,
                            venue=sess.venue or "HyperBuild Lab",
                            status=r.status or "present",
                            remarks="HyperBuild Workshop Session",
                            is_locked=r.is_locked,
                            has_pending_correction=corr is not None and corr.status in ["pending_faculty_approval", "pending_admin_approval"],
                            correction_request_id=corr.id if corr else None,
                            correction_status=corr.status if corr else None,
                            category="hyperbuild_activity",
                            category_label="HyperBuild Activity",
                            activity_title="HyperBuild Workshop Session",
                            activity_no=1,
                        )
                    )

        # ── Case B: Standard Lecture / Class Session ──
        else:
            sub = sess.subject

            if sub and not is_student_eligible_for_subject(sub, student):
                continue
            if not sub and sess.batch_id and student.batch_id and sess.batch_id != student.batch_id:
                continue

            total_classes += 1

            is_attended = r.status in PRESENT_STATUSES
            if is_attended:
                attended_classes += 1

            # Determine subject ID, name, and code (handling fallback for standalone sessions)
            if sub:
                sub_id = sub.id
                sub_name = sub.name
                sub_code = sub.code or sub.course_code or "SUB"
            else:
                if sess.session_type == "hyperbuild" or (sess.venue and "hyperbuild" in sess.venue.lower()):
                    sub_id = uuid.UUID("00000000-0000-0000-0000-000000000001")
                    sub_name = "HyperBuild Practical Lab"
                    sub_code = "HYPERBUILD"
                else:
                    stype = (sess.session_type or "General").replace("_", " ").title()
                    sub_id = uuid.uuid5(uuid.NAMESPACE_DNS, f"session-type-{sess.session_type or 'general'}")
                    sub_name = f"{stype} Session"
                    sub_code = (sess.session_type or "GEN").upper()[:10]

            is_hb_fallback = sess.session_type == "hyperbuild" or (sess.venue and "hyperbuild" in sess.venue.lower())
            category_key = "hyperbuild" if is_hb_fallback else "academic"
            category_slug = "hyperbuild_activity" if is_hb_fallback else "academic_lecture"
            category_label_str = "HyperBuild Activity" if is_hb_fallback else "Academic Lecture"

            # Subject breakdown aggregation
            if sub_id not in subjects_map:
                subjects_map[sub_id] = {
                    "id": sub_id,
                    "name": sub_name,
                    "code": sub_code,
                    "academic": {"total": 0, "attended": 0, "absent": 0, "excused": 0},
                    "hyperbuild": {"total": 0, "attended": 0, "absent": 0, "excused": 0},
                    "total": 0,
                    "attended": 0,
                    "absent": 0,
                    "excused": 0,
                }

            subjects_map[sub_id]["total"] += 1
            subjects_map[sub_id][category_key]["total"] += 1
            if is_attended:
                subjects_map[sub_id]["attended"] += 1
                subjects_map[sub_id][category_key]["attended"] += 1
            elif r.status in ["excused", "leave_approved", "od_duty", "on_duty", "on duty"]:
                subjects_map[sub_id]["excused"] += 1
                subjects_map[sub_id][category_key]["excused"] += 1
            else:
                subjects_map[sub_id]["absent"] += 1
                subjects_map[sub_id][category_key]["absent"] += 1

            fac_name = "Faculty"
            if sess.faculty_internal:
                fac_name = sess.faculty_internal.full_name or "Internal Faculty"
            elif sess.faculty_external:
                fac_name = sess.faculty_external.name or "External Faculty"

            corr = corr_map.get(r.id)

            session_items.append(
                StudentSessionAttendanceRecordItem(
                    attendance_id=r.id,
                    session_id=sess.id,
                    subject_id=sub_id,
                    subject_name=sub_name,
                    subject_code=sub_code,
                    faculty_name=fac_name,
                    session_date=sess.session_date,
                    start_time=sess.start_time.strftime("%H:%M") if sess.start_time else "",
                    end_time=sess.end_time.strftime("%H:%M") if sess.end_time else "",
                    venue=sess.venue or "Campus",
                    status=r.status,
                    remarks=r.remarks,
                    is_locked=r.is_locked,
                    has_pending_correction=corr is not None and corr.status in ["pending_faculty_approval", "pending_admin_approval"],
                    correction_request_id=corr.id if corr else None,
                    correction_status=corr.status if corr else None,
                    category=category_slug,
                    category_label=category_label_str,
                    activity_title=None,
                    activity_no=None,
                )
            )

    # Convert subjects map to list with dual-category metrics and exam eligibility rule
    subjects_breakdown: List[StudentSubjectAttendanceBreakdown] = []
    overall_academic_total = 0
    overall_academic_attended = 0
    overall_hyperbuild_total = 0
    overall_hyperbuild_attended = 0

    for s_data in subjects_map.values():
        t = s_data["total"]
        a = s_data["attended"]
        pct = round((a / t * 100.0), 1) if t > 0 else 100.0

        acad = s_data["academic"]
        acad_total = acad["total"]
        acad_att = acad["attended"]
        overall_academic_total += acad_total
        overall_academic_attended += acad_att
        acad_pct = round((acad_att / acad_total * 100.0), 1) if acad_total > 0 else None
        acad_eligible = (acad_total == 0) or (acad_pct is not None and acad_pct >= 75.0)
        acad_status = "pending" if acad_total == 0 else ("safe" if acad_eligible else "at_risk")
        acad_shortfall = max(0, int((0.75 * acad_total - acad_att) / 0.25) + 1) if (acad_total > 0 and acad_pct < 75.0) else 0

        hb = s_data["hyperbuild"]
        hb_total = hb["total"]
        hb_att = hb["attended"]
        overall_hyperbuild_total += hb_total
        overall_hyperbuild_attended += hb_att
        hb_pct = round((hb_att / hb_total * 100.0), 1) if hb_total > 0 else None
        hb_eligible = (hb_total == 0) or (hb_pct is not None and hb_pct >= 75.0)
        hb_status = "pending" if hb_total == 0 else ("safe" if hb_eligible else "at_risk")
        hb_shortfall = max(0, int((0.75 * hb_total - hb_att) / 0.25) + 1) if (hb_total > 0 and hb_pct < 75.0) else 0

        # Institutional Policy: Student must have >= 75% in BOTH categories (among conducted categories)
        is_exam_eligible = acad_eligible and hb_eligible
        is_debarred = (t > 0) and (not is_exam_eligible)

        if not acad_eligible and not hb_eligible:
            debarred_cat = "both"
            debar_reason = f"Debarred: Both Academic Lectures ({acad_pct}%) and HyperBuild Activities ({hb_pct}%) are below 75%"
        elif not acad_eligible:
            debarred_cat = "academic_only"
            debar_reason = f"Debarred: Academic Lectures attendance is {acad_pct}% (minimum 75% required)"
        elif not hb_eligible:
            debarred_cat = "hyperbuild_only"
            debar_reason = f"Debarred: HyperBuild Activities attendance is {hb_pct}% (minimum 75% required)"
        else:
            debarred_cat = None
            debar_reason = "Eligible for Examination (Meets 75% institutional requirement in both categories)"

        subjects_breakdown.append(
            StudentSubjectAttendanceBreakdown(
                subject_id=s_data["id"],
                subject_name=s_data["name"],
                subject_code=s_data["code"],
                academic_total=acad_total,
                academic_attended=acad_att,
                academic_absent=acad["absent"],
                academic_excused=acad["excused"],
                academic_percentage=acad_pct,
                academic_eligible=acad_eligible,
                academic_status=acad_status,
                academic_shortfall=acad_shortfall,
                hyperbuild_total=hb_total,
                hyperbuild_attended=hb_att,
                hyperbuild_absent=hb["absent"],
                hyperbuild_excused=hb["excused"],
                hyperbuild_percentage=hb_pct,
                hyperbuild_eligible=hb_eligible,
                hyperbuild_status=hb_status,
                hyperbuild_shortfall=hb_shortfall,
                total_sessions=t,
                attended=a,
                absent=s_data["absent"],
                excused=s_data["excused"],
                percentage=pct,
                is_exam_eligible=is_exam_eligible,
                is_debarred=is_debarred,
                debarred_category=debarred_cat,
                debarment_reason=debar_reason,
                is_at_risk=is_debarred or (pct < 75.0 and t >= 3),
            )
        )

    overall_pct = round((attended_classes / total_classes * 100.0), 1) if total_classes > 0 else (round(student.attendance_percentage, 1) if student.attendance_percentage else 0.0)
    overall_acad_pct = round((overall_academic_attended / overall_academic_total * 100.0), 1) if overall_academic_total > 0 else 100.0
    overall_hb_pct = round((overall_hyperbuild_attended / overall_hyperbuild_total * 100.0), 1) if overall_hyperbuild_total > 0 else 100.0

    return StudentAttendanceDossierResponse(
        student_id=student.id,
        student_name=student.full_name or f"{student.first_name} {student.last_name or ''}".strip(),
        student_prn=student.prn_number or student.roll_no or "",
        roll_no=student.roll_no,
        program_name=student.program.name if student.program else "PGDM",
        batch_name=student.batch.name if student.batch else "Batch 2026",
        overall_attendance_percentage=overall_pct,
        total_classes_conducted=total_classes,
        total_classes_attended=attended_classes,
        overall_academic_total=overall_academic_total,
        overall_academic_attended=overall_academic_attended,
        overall_academic_percentage=overall_acad_pct,
        overall_hyperbuild_total=overall_hyperbuild_total,
        overall_hyperbuild_attended=overall_hyperbuild_attended,
        overall_hyperbuild_percentage=overall_hb_pct,
        subjects_breakdown=subjects_breakdown,
        session_records=session_items,
    )


async def create_attendance_correction_request(
    db: AsyncSession,
    req_in: AttendanceCorrectionCreate,
    requested_by_id: UUID,
    user_roles: List[str],
) -> AttendanceCorrectionResponse:
    """
    Initiates a formal Attendance Correction Request for a locked session.
    If raised by student: starts in 'pending_faculty_approval'.
    If raised by faculty: advances to 'pending_admin_approval'.
    """
    attendance = None

    # Strategy 1: Find by StudentAttendance.id directly
    if req_in.attendance_id:
        att_stmt = (
            select(StudentAttendance)
            .options(
                selectinload(StudentAttendance.session).selectinload(Session.subject),
                selectinload(StudentAttendance.session).selectinload(Session.batch),
                selectinload(StudentAttendance.student),
            )
            .where(StudentAttendance.id == req_in.attendance_id)
        )
        att_res = await db.execute(att_stmt)
        attendance = att_res.scalar_one_or_none()

    # Strategy 2: If req_in.attendance_id matches a HyperbuildActivityVerification ID
    if not attendance and req_in.attendance_id:
        v_stmt = select(HyperbuildActivityVerification).where(HyperbuildActivityVerification.id == req_in.attendance_id)
        v_res = await db.execute(v_stmt)
        v_rec = v_res.scalar_one_or_none()
        if v_rec:
            att_stmt = (
                select(StudentAttendance)
                .options(
                    selectinload(StudentAttendance.session).selectinload(Session.subject),
                    selectinload(StudentAttendance.session).selectinload(Session.batch),
                    selectinload(StudentAttendance.student),
                )
                .where(
                    StudentAttendance.session_id == v_rec.session_id,
                    StudentAttendance.student_id == v_rec.student_id,
                )
            )
            att_res = await db.execute(att_stmt)
            attendance = att_res.scalar_one_or_none()

    # Strategy 3: Resolve target session_id and student_id
    target_session_id = req_in.session_id
    target_student_id = req_in.student_id

    # If student_id not specified, check if requesting user is a student
    if not target_student_id:
        st_lookup = await db.execute(select(Student.id).where(Student.user_id == requested_by_id))
        target_student_id = st_lookup.scalar_one_or_none()

    # If session_id not specified, check if req_in.attendance_id is a Session ID
    if not target_session_id and req_in.attendance_id:
        sess_check = await db.execute(select(Session.id).where(Session.id == req_in.attendance_id))
        if sess_check.scalar_one_or_none():
            target_session_id = req_in.attendance_id

    # Strategy 4: Find by (session_id, student_id)
    if not attendance and target_session_id and target_student_id:
        att_stmt = (
            select(StudentAttendance)
            .options(
                selectinload(StudentAttendance.session).selectinload(Session.subject),
                selectinload(StudentAttendance.session).selectinload(Session.batch),
                selectinload(StudentAttendance.student),
            )
            .where(
                StudentAttendance.session_id == target_session_id,
                StudentAttendance.student_id == target_student_id,
            )
        )
        att_res = await db.execute(att_stmt)
        attendance = att_res.scalar_one_or_none()

    # Strategy 5: If valid session and student exist, auto-create the StudentAttendance record
    if not attendance and target_session_id and target_student_id:
        sess_obj = (await db.execute(select(Session).where(Session.id == target_session_id))).scalar_one_or_none()
        stud_obj = (await db.execute(select(Student).where(Student.id == target_student_id))).scalar_one_or_none()
        if sess_obj and stud_obj:
            attendance = StudentAttendance(
                session_id=target_session_id,
                student_id=target_student_id,
                status="absent",
                roll_call_status="absent",
                is_locked=True,
                remarks="Auto-created on attendance dispute",
            )
            db.add(attendance)
            await db.flush()
            att_stmt = (
                select(StudentAttendance)
                .options(
                    selectinload(StudentAttendance.session).selectinload(Session.subject),
                    selectinload(StudentAttendance.session).selectinload(Session.batch),
                    selectinload(StudentAttendance.student),
                )
                .where(StudentAttendance.id == attendance.id)
            )
            att_res = await db.execute(att_stmt)
            attendance = att_res.scalar_one_or_none()

    if not attendance:
        raise ValueError("Attendance record not found")

    # Check for existing pending request
    pending_stmt = select(AttendanceCorrectionRequest).where(
        AttendanceCorrectionRequest.attendance_id == attendance.id,
        AttendanceCorrectionRequest.status.in_(["pending_faculty_approval", "pending_admin_approval"]),
    )
    pending_res = await db.execute(pending_stmt)
    if pending_res.scalar_one_or_none():
        raise ValueError("A correction request for this attendance record is already under active review.")

    is_faculty = any(r in ["faculty_internal", "faculty_external"] for r in user_roles)
    is_admin = any(r in ["crc_admin", "crc_coordinator"] for r in user_roles)

    # Detect if dispute arises from HyperBuild session or activities
    is_hyperbuild = False
    sess_corr = attendance.session
    if sess_corr:
        if sess_corr.session_type == "hyperbuild" or (sess_corr.venue and "hyperbuild" in sess_corr.venue.lower()):
            is_hyperbuild = True
    if req_in.activity_ids and len(req_in.activity_ids) > 0:
        is_hyperbuild = True

    now_utc = datetime.now(timezone.utc)
    initial_status = "pending_faculty_approval"
    faculty_approver_id = None
    faculty_action = None
    faculty_acted_at = None
    faculty_remarks = None

    if is_hyperbuild:
        # HyperBuild disputes: Single-tier approval (Admin only). Faculty approval not required.
        initial_status = "pending_admin_approval"
        faculty_action = "not_applicable"
        faculty_acted_at = now_utc
        faculty_remarks = "Auto-routed: HyperBuild dispute requires Admin approval only"
    elif is_faculty:
        # Faculty initiated the correction; their tier is implicitly approved
        initial_status = "pending_admin_approval"
        faculty_approver_id = requested_by_id
        faculty_action = "approved"
        faculty_acted_at = now_utc
        faculty_remarks = "Initiated by allocated Faculty"

    audit_entry = {
        "event": "correction_requested",
        "requested_by": str(requested_by_id),
        "requested_at": now_utc.isoformat(),
        "from_status": attendance.status,
        "to_status": req_in.requested_status,
        "reason": req_in.reason,
        "activity_ids": [str(a) for a in req_in.activity_ids] if req_in.activity_ids else None,
    }

    activity_ids_val = [str(a) for a in req_in.activity_ids] if req_in.activity_ids else None

    corr = AttendanceCorrectionRequest(
        attendance_id=attendance.id,
        session_id=attendance.session_id,
        student_id=attendance.student_id,
        requested_by_id=requested_by_id,
        current_status=attendance.status,
        requested_status=req_in.requested_status,
        reason=req_in.reason,
        document_url=req_in.document_url,
        status=initial_status,
        activity_ids=activity_ids_val,
        faculty_approver_id=faculty_approver_id,
        faculty_action=faculty_action,
        faculty_acted_at=faculty_acted_at,
        faculty_remarks=faculty_remarks,
        audit_trail={"history": [audit_entry]},
    )
    db.add(corr)
    await db.commit()

    # Eagerly load all relationships to prevent lazy-load / greenlet errors
    fresh_corr = await get_correction_with_relations(db, corr.id)
    if fresh_corr:
        corr = fresh_corr
        # Trigger email notification acknowledging dispute submission to student & alerting faculty
        await _dispatch_dispute_email(db, "attendance_dispute_submitted", corr)

    return await format_correction_response(db, corr)


async def get_correction_with_relations(db: AsyncSession, request_id: UUID) -> Optional[AttendanceCorrectionRequest]:
    """
    Eagerly loads all relationships required for review workflows, email triggers,
    and format_correction_response to eliminate detached instance / MissingGreenlet exceptions.
    """
    stmt = (
        select(AttendanceCorrectionRequest)
        .options(
            selectinload(AttendanceCorrectionRequest.attendance),
            selectinload(AttendanceCorrectionRequest.session).selectinload(Session.subject),
            selectinload(AttendanceCorrectionRequest.session).selectinload(Session.batch),
            selectinload(AttendanceCorrectionRequest.session).selectinload(Session.faculty_internal),
            selectinload(AttendanceCorrectionRequest.session).selectinload(Session.faculty_external),
            selectinload(AttendanceCorrectionRequest.student),
            selectinload(AttendanceCorrectionRequest.requested_by),
            selectinload(AttendanceCorrectionRequest.faculty_approver),
            selectinload(AttendanceCorrectionRequest.admin_approver),
        )
        .where(AttendanceCorrectionRequest.id == request_id)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def _apply_attendance_correction(db: AsyncSession, corr: AttendanceCorrectionRequest, now_utc: datetime):
    """
    Applies attendance update to StudentAttendance, updates HyperBuild verifications,
    and recalculates cumulative batch attendance percentages.
    """
    att = corr.attendance
    if att:
        att.status = corr.requested_status
        att.roll_call_status = "present"
        prev_remarks = att.remarks or ""
        att.remarks = f"{prev_remarks} [Dual-Approved: {corr.requested_status} on {now_utc.strftime('%d/%m/%Y')}]".strip()

    # If specific HyperBuild activities were disputed, mark student present in HyperbuildActivityVerification
    if corr.activity_ids and isinstance(corr.activity_ids, list) and len(corr.activity_ids) > 0:
        for act_id_str in corr.activity_ids:
            try:
                act_id = UUID(str(act_id_str))
            except Exception:
                continue
            v_stmt = select(HyperbuildActivityVerification).where(
                HyperbuildActivityVerification.activity_id == act_id,
                HyperbuildActivityVerification.student_id == corr.student_id,
            )
            v_res = await db.execute(v_stmt)
            v_rec = v_res.scalar_one_or_none()
            if not v_rec:
                act_obj = (await db.execute(select(HyperbuildActivity).where(HyperbuildActivity.id == act_id))).scalar_one_or_none()
                v_rec = HyperbuildActivityVerification(
                    activity_id=act_id,
                    session_id=corr.session_id,
                    student_id=corr.student_id,
                    subject_id=act_obj.subject_id if act_obj else None,
                    challenge_key_entered="DISPUTE_APPROVED",
                    is_key_valid=True,
                    is_geofence_valid=True,
                    verification_status="verified_present",
                    verified_at=now_utc,
                )
                db.add(v_rec)
            else:
                v_rec.is_key_valid = True
                v_rec.verification_status = "verified_present"
                v_rec.verified_at = now_utc
                if not v_rec.challenge_key_entered:
                    v_rec.challenge_key_entered = "DISPUTE_APPROVED"

    # Recalculate automatic batch attendance % asynchronously in the background
    if corr.session and corr.session.batch_id:
        batch_id = corr.session.batch_id
        asyncio.create_task(_async_recalculate_batch_job(batch_id))


async def _async_recalculate_batch_job(batch_id: UUID):
    from app.core.database import AsyncSessionLocal
    from app.services.session_service import recalculate_batch_student_attendance
    try:
        async with AsyncSessionLocal() as bg_db:
            await recalculate_batch_student_attendance(bg_db, batch_id)
            await bg_db.commit()
    except Exception as e:
        logger.error(f"Async batch attendance recalculation failed for batch {batch_id}: {e}")


async def _async_dispatch_dispute_email_job(
    event_key: str,
    recipient_email: str,
    context: Dict[str, Any],
):
    from app.core.database import AsyncSessionLocal
    try:
        async with AsyncSessionLocal() as bg_db:
            await trigger_activity_email(
                db=bg_db,
                event_key=event_key,
                recipient_email=recipient_email,
                context=context,
            )
    except Exception as e:
        logger.error(f"Async dispute email dispatch failed for '{event_key}' to {recipient_email}: {e}")


async def _dispatch_dispute_email(
    db: AsyncSession,
    event_key: str,
    corr: AttendanceCorrectionRequest,
    context_extra: Optional[Dict[str, Any]] = None,
):
    """
    Safely dispatches dispute lifecycle emails asynchronously in the background
    without blocking the API response.
    """
    try:
        student = corr.student
        student_email = (student.email_official or student.email) if student else None
        student_name = student.full_name if student else "Student"
        prn_number = (student.prn_number or student.roll_no) if student else ""

        session = corr.session
        subject_name = session.subject.name if (session and session.subject) else "Class Lecture"
        subject_code = session.subject.code if (session and session.subject) else ""
        session_date = str(session.session_date) if session else ""

        faculty_name = "Subject Faculty"
        faculty_email = None
        if session:
            if session.faculty_internal:
                faculty_name = session.faculty_internal.full_name or "Faculty"
                faculty_email = session.faculty_internal.email
            elif session.faculty_external:
                faculty_name = session.faculty_external.full_name or "Faculty"
                faculty_email = session.faculty_external.email

        context: Dict[str, Any] = {
            "student_name": student_name,
            "prn_number": prn_number,
            "subject_name": subject_name,
            "subject_code": subject_code,
            "session_date": session_date,
            "current_status": corr.current_status,
            "requested_status": corr.requested_status,
            "reason": corr.reason,
            "faculty_name": faculty_name,
            "app_name": "Orion Portal",
            "support_email": "deepak.gupta@mile.education",
        }
        if context_extra:
            context.update(context_extra)

        # 1. Non-blocking background dispatch to Student
        if student_email:
            asyncio.create_task(
                _async_dispatch_dispute_email_job(event_key, student_email, dict(context))
            )

        # 2. Non-blocking background dispatch to Faculty on initial submission or when admin reviewed first (Non-HyperBuild disputes only)
        is_hb_corr = (
            corr.faculty_action == "not_applicable"
            or (session and (session.session_type == "hyperbuild" or (session.venue and "hyperbuild" in session.venue.lower())))
            or (corr.activity_ids and len(corr.activity_ids) > 0)
        )
        if not is_hb_corr:
            if event_key == "attendance_dispute_submitted" and faculty_email:
                fac_ctx = dict(context)
                asyncio.create_task(
                    _async_dispatch_dispute_email_job(event_key, faculty_email, fac_ctx)
                )
            elif event_key == "attendance_dispute_admin_reviewed" and faculty_email:
                fac_ctx = dict(context)
                fac_ctx["next_step_message"] = "Administrative review has been completed. Your faculty review is required to finalize the dispute."
                asyncio.create_task(
                    _async_dispatch_dispute_email_job(event_key, faculty_email, fac_ctx)
                )
    except Exception as e:
        logger.error(f"Failed to schedule dispute email '{event_key}': {e}")


async def review_attendance_correction_faculty(
    db: AsyncSession,
    request_id: UUID,
    action: str,
    remarks: Optional[str],
    faculty_user_id: UUID,
) -> AttendanceCorrectionResponse:
    """
    Tier 1 Faculty Review:
    - If approved:
      - If Admin already approved -> marks status 'approved', applies attendance correction, dispatches resolution email.
      - If Admin pending -> marks status 'pending_admin_approval', attendance unchanged, dispatches faculty review email.
    - If rejected -> marks status 'rejected', attendance unchanged, dispatches rejection email.
    """
    corr = await get_correction_with_relations(db, request_id)
    if not corr:
        raise ValueError("Correction request not found")

    if corr.status in ["approved", "rejected"]:
        raise ValueError(f"Dispute request has already been finalized ({corr.status})")

    now_utc = datetime.now(timezone.utc)
    corr.faculty_approver_id = faculty_user_id
    corr.faculty_action = action
    corr.faculty_acted_at = now_utc
    corr.faculty_remarks = remarks

    history = corr.audit_trail.get("history", []) if corr.audit_trail else []
    history.append({
        "event": f"faculty_{action}",
        "faculty_id": str(faculty_user_id),
        "acted_at": now_utc.isoformat(),
        "remarks": remarks,
    })
    corr.audit_trail = {"history": history}

    fac_user = (await db.execute(select(User).where(User.id == faculty_user_id))).unique().scalar_one_or_none()
    fac_name = fac_user.full_name if fac_user else "Subject Faculty"

    if action == "approved":
        if corr.admin_action == "approved":
            # True Dual-Approval Achieved!
            corr.status = "approved"
            corr.resolved_at = now_utc
            await _apply_attendance_correction(db, corr, now_utc)

            pct_val = f"{corr.student.attendance_percentage:.1f}" if (corr.student and corr.student.attendance_percentage is not None) else "Updated"
            adm_name = corr.admin_approver.full_name if corr.admin_approver else "Academic Administrator"
            await _dispatch_dispute_email(
                db,
                "attendance_dispute_resolved",
                corr,
                {
                    "corrected_status": corr.requested_status,
                    "faculty_name": fac_name,
                    "admin_name": adm_name,
                    "updated_attendance_pct": pct_val,
                }
            )
        else:
            # Faculty approved, awaiting Admin review
            corr.status = "pending_admin_approval"
            await _dispatch_dispute_email(
                db,
                "attendance_dispute_faculty_reviewed",
                corr,
                {
                    "faculty_name": fac_name,
                    "faculty_action": action,
                    "faculty_remarks": remarks or "Approved by Course Faculty",
                    "next_step_message": "Your dispute has received Faculty approval and is now awaiting final validation from Academic Administration.",
                }
            )
    else:
        # Rejected
        corr.status = "rejected"
        corr.resolved_at = now_utc
        await _dispatch_dispute_email(
            db,
            "attendance_dispute_rejected",
            corr,
            {
                "reviewer_role": "Subject Faculty",
                "reviewer_name": fac_name,
                "remarks": remarks or "Declined by Course Faculty",
            }
        )

    await db.commit()
    # Eagerly reload fresh with all relationships so format_correction_response will not trigger greenlet/lazy-load errors
    corr = await get_correction_with_relations(db, corr.id)
    return await format_correction_response(db, corr)


async def review_attendance_correction_admin(
    db: AsyncSession,
    request_id: UUID,
    action: str,
    remarks: Optional[str],
    admin_user_id: UUID,
) -> AttendanceCorrectionResponse:
    """
    Tier 2 Admin Final Review:
    - If approved:
      - If Faculty already approved -> marks status 'approved', applies attendance correction, dispatches resolution email.
      - If Faculty pending -> marks status 'pending_faculty_approval', attendance UNCHANGED, dispatches admin review notice.
    - If rejected -> marks status 'rejected', attendance unchanged, dispatches rejection email.
    """
    corr = await get_correction_with_relations(db, request_id)
    if not corr:
        raise ValueError("Correction request not found")

    if corr.status in ["approved", "rejected"]:
        raise ValueError(f"Dispute request has already been finalized ({corr.status})")

    now_utc = datetime.now(timezone.utc)
    corr.admin_approver_id = admin_user_id
    corr.admin_action = action
    corr.admin_acted_at = now_utc
    corr.admin_remarks = remarks

    history = corr.audit_trail.get("history", []) if corr.audit_trail else []
    history.append({
        "event": f"admin_{action}",
        "admin_id": str(admin_user_id),
        "acted_at": now_utc.isoformat(),
        "remarks": remarks,
    })
    corr.audit_trail = {"history": history}

    adm_user = (await db.execute(select(User).where(User.id == admin_user_id))).unique().scalar_one_or_none()
    adm_name = adm_user.full_name if adm_user else "Academic Administration"

    fac_name = "Subject Faculty"
    if corr.faculty_approver and corr.faculty_approver.full_name:
        fac_name = corr.faculty_approver.full_name
    elif corr.session and corr.session.faculty_internal and corr.session.faculty_internal.full_name:
        fac_name = corr.session.faculty_internal.full_name

    is_hb_corr = (
        corr.faculty_action == "not_applicable"
        or (corr.session and (corr.session.session_type == "hyperbuild" or (corr.session.venue and "hyperbuild" in corr.session.venue.lower())))
        or (corr.activity_ids and len(corr.activity_ids) > 0)
    )

    if action == "approved":
        if is_hb_corr or corr.faculty_action == "approved":
            # Single-tier approval (HyperBuild) or true Dual-Approval achieved!
            corr.status = "approved"
            corr.resolved_at = now_utc
            await _apply_attendance_correction(db, corr, now_utc)

            pct_val = f"{corr.student.attendance_percentage:.1f}" if (corr.student and corr.student.attendance_percentage is not None) else "Updated"
            await _dispatch_dispute_email(
                db,
                "attendance_dispute_resolved",
                corr,
                {
                    "corrected_status": corr.requested_status,
                    "faculty_name": "N/A (HyperBuild)" if is_hb_corr else fac_name,
                    "admin_name": adm_name,
                    "updated_attendance_pct": pct_val,
                }
            )
        else:
            # Admin approved, but Faculty approval is still pending!
            # Attendance is NOT changed until faculty also approves!
            corr.status = "pending_faculty_approval"
            await _dispatch_dispute_email(
                db,
                "attendance_dispute_admin_reviewed",
                corr,
                {
                    "admin_name": adm_name,
                    "admin_action": action,
                    "admin_remarks": remarks or "Approved by Academic Administration",
                    "next_step_message": "Administrative review is complete. Your dispute is now awaiting review and concurrence from your Subject Faculty before the official attendance record is updated.",
                }
            )
    else:
        # Rejected by Admin
        corr.status = "rejected"
        corr.resolved_at = now_utc
        await _dispatch_dispute_email(
            db,
            "attendance_dispute_rejected",
            corr,
            {
                "reviewer_role": "Academic Administration",
                "reviewer_name": adm_name,
                "remarks": remarks or "Declined by Academic Administration",
            }
        )

    await db.commit()
    # Eagerly reload fresh with all relationships so format_correction_response will not trigger greenlet/lazy-load errors
    corr = await get_correction_with_relations(db, corr.id)
    return await format_correction_response(db, corr)


async def list_attendance_corrections(
    db: AsyncSession,
    user_id: UUID,
    user_roles: List[str],
    status_filter: Optional[str] = None,
    subject_id: Optional[UUID] = None,
) -> List[AttendanceCorrectionResponse]:
    """
    Lists correction requests.
    Faculty see requests for their allocated subjects.
    Students see their own requests.
    Admins see all requests.
    """
    is_admin = any(r in ["crc_admin", "crc_coordinator", "approver"] for r in user_roles)
    is_faculty = any(r in ["faculty_internal", "faculty_external"] for r in user_roles)
    is_student = "student" in user_roles and not is_admin and not is_faculty

    query = (
        select(AttendanceCorrectionRequest)
        .options(
            joinedload(AttendanceCorrectionRequest.session).joinedload(Session.subject),
            joinedload(AttendanceCorrectionRequest.session).joinedload(Session.batch),
            joinedload(AttendanceCorrectionRequest.session).joinedload(Session.faculty_internal),
            joinedload(AttendanceCorrectionRequest.session).joinedload(Session.faculty_external),
            joinedload(AttendanceCorrectionRequest.student),
            joinedload(AttendanceCorrectionRequest.faculty_approver),
            joinedload(AttendanceCorrectionRequest.admin_approver),
        )
    )

    if status_filter:
        if status_filter in ["pending_faculty", "pending_faculty_approval"]:
            query = query.where(AttendanceCorrectionRequest.status.in_(["pending_faculty", "pending_faculty_approval"]))
        elif status_filter in ["pending_admin", "pending_admin_approval"]:
            query = query.where(AttendanceCorrectionRequest.status.in_(["pending_admin", "pending_admin_approval"]))
        else:
            query = query.where(AttendanceCorrectionRequest.status == status_filter)

    if is_student:
        student_subquery = select(Student.id).where(Student.user_id == user_id)
        query = query.where(
            or_(
                AttendanceCorrectionRequest.requested_by_id == user_id,
                AttendanceCorrectionRequest.student_id.in_(student_subquery),
            )
        )
    has_session_joined = False
    if is_faculty and not is_admin:
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, user_id)
        if fac_id:
            has_session_joined = True
            # Query active allocated (subject_id, batch_id) pairs from SubjectBatch
            if fac_type == "internal":
                alloc_stmt = select(SubjectBatch.subject_id, SubjectBatch.batch_id).where(
                    SubjectBatch.faculty_internal_id == fac_id, SubjectBatch.status == "active"
                )
                alloc_res = await db.execute(alloc_stmt)
                allocated_pairs = alloc_res.all()

                fac_conditions = [Session.faculty_internal_id == fac_id]
                for s_id, b_id in allocated_pairs:
                    if b_id:
                        fac_conditions.append(and_(Session.subject_id == s_id, Session.batch_id == b_id))
                    else:
                        fac_conditions.append(Session.subject_id == s_id)

                query = (
                    query.join(Session, AttendanceCorrectionRequest.session_id == Session.id)
                    .where(or_(*fac_conditions))
                    # Exclude HyperBuild disputes from faculty queue (HyperBuild is Admin-only)
                    .where(and_(
                        Session.session_type != "hyperbuild",
                        or_(Session.venue.is_(None), not_(Session.venue.ilike("%hyperbuild%"))),
                        or_(AttendanceCorrectionRequest.faculty_action.is_(None), AttendanceCorrectionRequest.faculty_action != "not_applicable"),
                    ))
                )
            else:
                alloc_stmt = select(SubjectBatch.subject_id, SubjectBatch.batch_id).where(
                    SubjectBatch.faculty_external_id == fac_id, SubjectBatch.status == "active"
                )
                alloc_res = await db.execute(alloc_stmt)
                allocated_pairs = alloc_res.all()

                fac_conditions = [Session.faculty_external_id == fac_id]
                for s_id, b_id in allocated_pairs:
                    if b_id:
                        fac_conditions.append(and_(Session.subject_id == s_id, Session.batch_id == b_id))
                    else:
                        fac_conditions.append(Session.subject_id == s_id)

                query = (
                    query.join(Session, AttendanceCorrectionRequest.session_id == Session.id)
                    .where(or_(*fac_conditions))
                    .where(and_(
                        Session.session_type != "hyperbuild",
                        or_(Session.venue.is_(None), not_(Session.venue.ilike("%hyperbuild%"))),
                        or_(AttendanceCorrectionRequest.faculty_action.is_(None), AttendanceCorrectionRequest.faculty_action != "not_applicable"),
                    ))
                )
        else:
            return []

    if subject_id:
        if not has_session_joined:
            query = query.join(Session, AttendanceCorrectionRequest.session_id == Session.id)
        query = query.where(Session.subject_id == subject_id)

    query = query.order_by(AttendanceCorrectionRequest.created_at.desc())
    res = await db.execute(query)
    corrections = res.scalars().unique().all()

    # Pre-collect all activity IDs across all corrections in a single query
    all_act_ids = set()
    for c in corrections:
        if c.activity_ids and isinstance(c.activity_ids, list):
            for a_id in c.activity_ids:
                try:
                    all_act_ids.add(UUID(str(a_id)))
                except Exception:
                    pass

    act_dict = {}
    if all_act_ids:
        act_stmt = (
            select(HyperbuildActivity)
            .options(joinedload(HyperbuildActivity.subject))
            .where(HyperbuildActivity.id.in_(all_act_ids))
        )
        act_res = await db.execute(act_stmt)
        for act_obj in act_res.scalars().unique().all():
            act_dict[act_obj.id] = {
                "id": str(act_obj.id),
                "activity_no": act_obj.activity_no,
                "title": act_obj.title,
                "subject_name": act_obj.subject.name if act_obj.subject else "General",
                "subject_code": act_obj.subject.code if act_obj.subject else None,
            }

    output = []
    for c in corrections:
        resp = await format_correction_response(db, c, activities_dict=act_dict)
        output.append(resp)

    return output


async def get_debarment_risk_students(
    db: AsyncSession,
    threshold_pct: float = 75.0,
    batch_id: Optional[UUID] = None,
    subject_id: Optional[UUID] = None,
    category_filter: Optional[str] = None,
    current_user_id: Optional[UUID] = None,
    user_roles: Optional[List[str]] = None,
) -> List[DebarredStudentItemResponse]:
    """
    Returns list of students debarred or at risk of exam debarment (< 75% attendance)
    in any subject, evaluated across Category 1 (Academic Lectures) and Category 2 (HyperBuild Activities).
    Uses high-performance bulk preloading instead of per-student N+1 queries.
    """
    roles = user_roles or []
    is_admin = any(r in ["crc_admin", "crc_coordinator", "approver", "reporting_readonly"] for r in roles)
    allocated_subject_ids = None
    if not is_admin and current_user_id:
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, current_user_id)
        if fac_id:
            alloc_stmt = select(SubjectBatch.subject_id).where(
                SubjectBatch.status == "active",
                SubjectBatch.faculty_internal_id == fac_id if fac_type == "internal" else SubjectBatch.faculty_external_id == fac_id,
            )
            alloc_res = await db.execute(alloc_stmt)
            allocated_subject_ids = set(alloc_res.scalars().all())
            if not allocated_subject_ids:
                return []
        else:
            return []

    # 1. Fetch Students
    st_stmt = (
        select(Student)
        .options(
            joinedload(Student.program),
            joinedload(Student.batch),
        )
        .where(Student.is_deleted == False, Student.status == "active")
    )
    if batch_id:
        st_stmt = st_stmt.where(Student.batch_id == batch_id)

    st_res = await db.execute(st_stmt)
    students = st_res.scalars().unique().all()
    student_map = {st.id: st for st in students}
    student_ids = list(student_map.keys())
    if not student_ids:
        return []

    # 2. Fetch all relevant StudentAttendance records in ONE query
    att_stmt = (
        select(StudentAttendance)
        .options(
            selectinload(StudentAttendance.session).selectinload(Session.subject),
            selectinload(StudentAttendance.session).selectinload(Session.hyperbuild_activities).selectinload(HyperbuildActivity.subject),
        )
        .where(
            StudentAttendance.student_id.in_(student_ids),
        )
    )
    att_res = await db.execute(att_stmt)
    all_attendances = att_res.scalars().unique().all()

    student_att_map: Dict[UUID, List[StudentAttendance]] = {}
    for a in all_attendances:
        if a.student_id not in student_att_map:
            student_att_map[a.student_id] = []
        student_att_map[a.student_id].append(a)

    # 3. Fetch all HyperBuild Verifications in ONE query
    hb_v_stmt = (
        select(HyperbuildActivityVerification)
        .where(HyperbuildActivityVerification.student_id.in_(student_ids))
    )
    hb_v_res = await db.execute(hb_v_stmt)
    all_verifs = hb_v_res.scalars().all()
    verif_map: Dict[tuple[UUID, UUID], Any] = {}
    for v in all_verifs:
        verif_map[(v.student_id, v.activity_id)] = v

    # 4. In-memory aggregation across all students
    output: List[DebarredStudentItemResponse] = []

    for st in students:
        records = student_att_map.get(st.id, [])
        subjects_map: Dict[UUID, Dict[str, Any]] = {}

        for r in records:
            sess = r.session
            if not sess or sess.is_deleted:
                continue

            # Case A: HyperBuild Session with Activities
            if sess.hyperbuild_activities and len(sess.hyperbuild_activities) > 0:
                activities_added_count = 0
                for act in sorted(sess.hyperbuild_activities, key=lambda a: a.activity_no):
                    v_rec = verif_map.get((st.id, act.id))
                    is_conducted = (
                        (act.status in ["active", "closed"])
                        or (act.challenge_key is not None)
                        or (v_rec is not None)
                        or (sess.attendance_status == "marked")
                        or (sess.status == "completed")
                    )
                    if not is_conducted:
                        continue

                    sub = act.subject
                    if sub:
                        if not is_student_eligible_for_subject(sub, st):
                            continue
                        sub_id = sub.id
                        sub_name = sub.name
                        sub_code = sub.code or sub.course_code or "SUB"
                    else:
                        sub_id = act.id
                        sub_name = act.title or "HyperBuild Practical Lab"
                        sub_code = "HYPERBUILD"

                    act_required_key = (
                        (act.challenge_key is not None)
                        or (act.status in ["active", "closed"])
                        or (v_rec is not None)
                    )

                    parent_is_present = (r.status in PRESENT_STATUSES) or (getattr(r, "roll_call_status", None) in PRESENT_STATUSES)
                    v_is_present = v_rec is not None and v_rec.verification_status in ["verified_present", "late_submission", "present"]

                    if act_required_key:
                        is_att = parent_is_present and v_is_present
                    else:
                        is_att = parent_is_present

                    activities_added_count += 1
                    if sub_id not in subjects_map:
                        subjects_map[sub_id] = {
                            "id": sub_id,
                            "name": sub_name,
                            "code": sub_code,
                            "academic": {"total": 0, "attended": 0},
                            "hyperbuild": {"total": 0, "attended": 0},
                        }
                    subjects_map[sub_id]["hyperbuild"]["total"] += 1
                    if is_att:
                        subjects_map[sub_id]["hyperbuild"]["attended"] += 1

                if activities_added_count == 0 and (sess.attendance_status == "marked" or sess.status == "completed"):
                    sub = sess.subject
                    if sub and is_student_eligible_for_subject(sub, st):
                        sub_id = sub.id
                        sub_name = sub.name
                        sub_code = sub.code or sub.course_code or "SUB"
                        is_att = r.status in PRESENT_STATUSES
                        if sub_id not in subjects_map:
                            subjects_map[sub_id] = {
                                "id": sub_id,
                                "name": sub_name,
                                "code": sub_code,
                                "academic": {"total": 0, "attended": 0},
                                "hyperbuild": {"total": 0, "attended": 0},
                            }
                        subjects_map[sub_id]["hyperbuild"]["total"] += 1
                        if is_att:
                            subjects_map[sub_id]["hyperbuild"]["attended"] += 1

            # Case B: Standard Lecture
            else:
                if not (sess.attendance_status == "marked" or sess.status == "completed"):
                    continue
                sub = sess.subject
                if sub and not is_student_eligible_for_subject(sub, st):
                    continue
                if not sub and sess.batch_id and st.batch_id and sess.batch_id != st.batch_id:
                    continue

                if sub:
                    sub_id = sub.id
                    sub_name = sub.name
                    sub_code = sub.code or sub.course_code or "SUB"
                else:
                    sub_id = UUID("00000000-0000-0000-0000-000000000000")
                    sub_name = "General Academic Lecture"
                    sub_code = "GEN"

                if sub_id not in subjects_map:
                    subjects_map[sub_id] = {
                        "id": sub_id,
                        "name": sub_name,
                        "code": sub_code,
                        "academic": {"total": 0, "attended": 0},
                        "hyperbuild": {"total": 0, "attended": 0},
                    }

                is_att = r.status in PRESENT_STATUSES
                subjects_map[sub_id]["academic"]["total"] += 1
                if is_att:
                    subjects_map[sub_id]["academic"]["attended"] += 1

        # Check debarment standing for each subject
        for sub_id, sb in subjects_map.items():
            if allocated_subject_ids is not None and sub_id not in allocated_subject_ids:
                continue
            if subject_id and sub_id != subject_id:
                continue

            acad_total = sb["academic"]["total"]
            acad_att = sb["academic"]["attended"]
            acad_pct = round((acad_att / acad_total * 100.0), 1) if acad_total > 0 else None

            hb_total = sb["hyperbuild"]["total"]
            hb_att = sb["hyperbuild"]["attended"]
            hb_pct = round((hb_att / hb_total * 100.0), 1) if hb_total > 0 else None

            total_sess = acad_total + hb_total
            total_att = acad_att + hb_att
            overall_pct = round((total_att / total_sess * 100.0), 1) if total_sess > 0 else 0.0

            acad_debarred = (acad_total > 0) and (acad_pct is not None and acad_pct < threshold_pct)
            hb_debarred = (hb_total > 0) and (hb_pct is not None and hb_pct < threshold_pct)

            if not (acad_debarred or hb_debarred):
                continue

            if acad_debarred and hb_debarred:
                debar_cat = "both"
                reason = f"Debarred: Both Academic Lectures ({acad_pct}%) and HyperBuild ({hb_pct}%) are below {threshold_pct}%"
            elif acad_debarred:
                debar_cat = "academic"
                reason = f"Debarred: Academic Lectures attendance is {acad_pct}% (minimum {threshold_pct}% required)"
            else:
                debar_cat = "hyperbuild"
                reason = f"Debarred: HyperBuild Activities attendance is {hb_pct}% (minimum {threshold_pct}% required)"

            if category_filter and category_filter not in ["all", ""]:
                if category_filter == "academic" and debar_cat not in ["academic", "both"]:
                    continue
                elif category_filter == "hyperbuild" and debar_cat not in ["hyperbuild", "both"]:
                    continue
                elif category_filter == "both" and debar_cat != "both":
                    continue

            shortfall = max(0, int((threshold_pct / 100.0 * acad_total - acad_att) / (1 - threshold_pct / 100.0)) + 1) if acad_debarred else (
                max(0, int((threshold_pct / 100.0 * hb_total - hb_att) / (1 - threshold_pct / 100.0)) + 1) if hb_debarred else 0
            )

            output.append(
                DebarredStudentItemResponse(
                    student_id=st.id,
                    student_name=st.full_name or f"{st.first_name} {st.last_name or ''}".strip(),
                    student_prn=st.prn_number or st.roll_no or "",
                    roll_no=st.roll_no,
                    program_name=st.program.name if st.program else "PGDM",
                    batch_name=st.batch.name if st.batch else "Batch 2026",
                    subject_id=sub_id,
                    subject_name=sb["name"],
                    subject_code=sb["code"],
                    overall_percentage=overall_pct,
                    attendance_percentage=overall_pct,
                    total_sessions=total_sess,
                    attended_sessions=total_att,
                    shortfall_sessions=shortfall,
                    academic_percentage=acad_pct,
                    academic_attended=acad_att,
                    academic_total=acad_total,
                    hyperbuild_percentage=hb_pct,
                    hyperbuild_attended=hb_att,
                    hyperbuild_total=hb_total,
                    debarred_category=debar_cat,
                    debarment_reason=reason,
                )
            )

    output.sort(key=lambda x: (x.student_name, x.subject_name or ""))
    return output


async def format_correction_response(
    db: AsyncSession,
    corr: AttendanceCorrectionRequest,
    activities_dict: Optional[Dict[UUID, Any]] = None,
) -> AttendanceCorrectionResponse:
    student_name = corr.student.full_name if corr.student else None
    student_prn = corr.student.prn_number or corr.student.roll_no if corr.student else None
    subject_name = corr.session.subject.name if (corr.session and corr.session.subject) else None
    subject_code = corr.session.subject.code if (corr.session and corr.session.subject) else None
    batch_name = corr.session.batch.name if (corr.session and corr.session.batch) else None
    session_date = corr.session.session_date if corr.session else None
    session_time = f"{corr.session.start_time.strftime('%H:%M')} - {corr.session.end_time.strftime('%H:%M')}" if corr.session else None
    venue = corr.session.venue if corr.session else None

    faculty_approver_name = corr.faculty_approver.full_name if corr.faculty_approver else None
    admin_approver_name = corr.admin_approver.full_name if corr.admin_approver else None

    # Format activities details if activity_ids are present
    activity_ids_out = []
    activities_details_out = []
    if corr.activity_ids and isinstance(corr.activity_ids, list):
        for a_id_str in corr.activity_ids:
            try:
                a_uuid = UUID(str(a_id_str))
                activity_ids_out.append(a_uuid)
                if activities_dict is not None and a_uuid in activities_dict:
                    activities_details_out.append(activities_dict[a_uuid])
            except Exception:
                continue

        if activities_dict is None and activity_ids_out:
            act_stmt = (
                select(HyperbuildActivity)
                .options(selectinload(HyperbuildActivity.subject))
                .where(HyperbuildActivity.id.in_(activity_ids_out))
            )
            act_res = await db.execute(act_stmt)
            for act_obj in act_res.scalars().all():
                activities_details_out.append({
                    "id": str(act_obj.id),
                    "activity_no": act_obj.activity_no,
                    "title": act_obj.title,
                    "subject_name": act_obj.subject.name if act_obj.subject else "General",
                    "subject_code": act_obj.subject.code if act_obj.subject else None,
                })

    return AttendanceCorrectionResponse(
        id=corr.id,
        attendance_id=corr.attendance_id,
        session_id=corr.session_id,
        student_id=corr.student_id,
        requested_by_id=corr.requested_by_id,
        activity_ids=activity_ids_out if activity_ids_out else None,
        activities_details=activities_details_out if activities_details_out else None,
        student_name=student_name,
        student_prn=student_prn,
        subject_name=subject_name,
        subject_code=subject_code,
        batch_name=batch_name,
        session_date=session_date,
        session_time=session_time,
        venue=venue,
        current_status=corr.current_status,
        requested_status=corr.requested_status,
        reason=corr.reason,
        document_url=corr.document_url,
        status=corr.status,
        faculty_approver_id=corr.faculty_approver_id,
        faculty_approver_name=faculty_approver_name,
        faculty_action=corr.faculty_action,
        faculty_acted_at=corr.faculty_acted_at,
        faculty_remarks=corr.faculty_remarks,
        admin_approver_id=corr.admin_approver_id,
        admin_approver_name=admin_approver_name,
        admin_action=corr.admin_action,
        admin_acted_at=corr.admin_acted_at,
        admin_remarks=corr.admin_remarks,
        resolved_at=corr.resolved_at,
        created_at=corr.created_at,
    )


async def get_class_attendance_register(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    subject_id: Optional[UUID] = None,
    batch_id: Optional[UUID] = None,
    faculty_id: Optional[UUID] = None,
    attendance_status: Optional[str] = None,
    category: Optional[str] = None,
    current_user_id: Optional[UUID] = None,
    user_roles: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Returns a comprehensive audit register of every class session conducted,
    including student attendance metrics, absentees lists, and compliance status.
    """
    roles = user_roles or []
    is_admin = any(r in ["crc_admin", "crc_coordinator", "approver", "reporting_readonly"] for r in roles)

    query = (
        select(Session)
        .options(
            selectinload(Session.subject),
            selectinload(Session.batch),
            selectinload(Session.program),
            selectinload(Session.faculty_internal),
            selectinload(Session.faculty_external),
        )
        .where(Session.is_deleted == False)
    )

    if start_date:
        query = query.where(Session.session_date >= start_date)
    if end_date:
        query = query.where(Session.session_date <= end_date)
    if subject_id:
        query = query.where(Session.subject_id == subject_id)
    if batch_id:
        query = query.where(Session.batch_id == batch_id)

    if category == "hyperbuild":
        query = query.where(or_(Session.session_type == "hyperbuild", Session.venue.ilike("%hyperbuild%")))
    elif category == "academic":
        query = query.where(and_(Session.session_type != "hyperbuild", not_(Session.venue.ilike("%hyperbuild%"))))

    if not is_admin and current_user_id:
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, current_user_id)
        if fac_id:
            if fac_type == "internal":
                alloc_stmt = select(SubjectBatch.subject_id, SubjectBatch.batch_id).where(
                    SubjectBatch.faculty_internal_id == fac_id, SubjectBatch.status == "active"
                )
                alloc_res = await db.execute(alloc_stmt)
                allocated_pairs = alloc_res.all()

                fac_conditions = [Session.faculty_internal_id == fac_id]
                for s_id, b_id in allocated_pairs:
                    if b_id:
                        fac_conditions.append(and_(Session.subject_id == s_id, Session.batch_id == b_id))
                    else:
                        fac_conditions.append(Session.subject_id == s_id)
                query = query.where(or_(*fac_conditions))
            else:
                alloc_stmt = select(SubjectBatch.subject_id, SubjectBatch.batch_id).where(
                    SubjectBatch.faculty_external_id == fac_id, SubjectBatch.status == "active"
                )
                alloc_res = await db.execute(alloc_stmt)
                allocated_pairs = alloc_res.all()

                fac_conditions = [Session.faculty_external_id == fac_id]
                for s_id, b_id in allocated_pairs:
                    if b_id:
                        fac_conditions.append(and_(Session.subject_id == s_id, Session.batch_id == b_id))
                    else:
                        fac_conditions.append(Session.subject_id == s_id)
                query = query.where(or_(*fac_conditions))
        else:
            return []

    query = query.order_by(Session.session_date.desc(), Session.start_time.desc())
    res = await db.execute(query)
    sessions = res.scalars().all()

    if not sessions:
        return []

    session_ids = [s.id for s in sessions]

    # Preload all attendance records for these sessions
    att_stmt = (
        select(StudentAttendance)
        .options(selectinload(StudentAttendance.student))
        .where(StudentAttendance.session_id.in_(session_ids))
    )
    att_res = await db.execute(att_stmt)
    records_by_session: Dict[UUID, List[StudentAttendance]] = {}
    for att in att_res.scalars().all():
        if att.session_id not in records_by_session:
            records_by_session[att.session_id] = []
        records_by_session[att.session_id].append(att)

    register_out = []
    for s in sessions:
        atts = records_by_session.get(s.id, [])
        total_students = len(atts)
        present_count = 0
        absent_count = 0
        late_count = 0
        excused_count = 0
        od_count = 0
        absentees = []

        for a in atts:
            st_name = (
                f"{a.student.first_name} {a.student.last_name or ''}".strip()
                if a.student
                else "Unknown Student"
            )
            st_prn = a.student.prn_number or a.student.roll_no or "PRN-N/A" if a.student else "N/A"
            st_roll = a.student.roll_no if a.student else None

            if a.status in PRESENT_STATUSES:
                present_count += 1
            elif a.status in ["od_duty", "on_duty"]:
                od_count += 1
            elif a.status == "late":
                late_count += 1
            elif a.status == "excused":
                excused_count += 1
            else:
                absent_count += 1
                absentees.append({
                    "student_id": str(a.student_id),
                    "student_name": st_name,
                    "student_prn": st_prn,
                    "roll_no": st_roll,
                    "remarks": a.remarks or "Absent without excuse",
                })

        # Calculate session classification
        today = date.today()
        is_marked = s.attendance_status == "marked" or s.status == "completed" or len(atts) > 0
        is_future = (s.session_date and s.session_date > today)

        if attendance_status == "marked" and not is_marked:
            continue
        elif attendance_status == "pending" and (is_marked or is_future):
            continue
        elif attendance_status in ["upcoming", "scheduled"] and not is_future:
            continue

        pct = round((present_count / total_students * 100), 1) if (is_marked and total_students > 0) else None
        calc_status = "marked" if is_marked else ("upcoming" if is_future else "pending")

        fac_name = "Unassigned"
        if s.faculty_internal:
            fac_name = s.faculty_internal.full_name or "Internal Faculty"
        elif s.faculty_external:
            fac_name = s.faculty_external.name or "External Faculty"

        is_hb = s.session_type == "hyperbuild" or (s.venue and "hyperbuild" in s.venue.lower())

        register_out.append({
            "id": str(s.id),
            "session_date": s.session_date.isoformat() if s.session_date else "",
            "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
            "end_time": s.end_time.strftime("%H:%M") if s.end_time else "",
            "session_type": s.session_type or "Regular Lecture",
            "category": "hyperbuild_activity" if is_hb else "academic_lecture",
            "category_label": "HyperBuild Activity" if is_hb else "Academic Lecture",
            "hyperbuild_activity_no": s.hyperbuild_activity_no,
            "program_name": s.program.name if s.program else None,
            "batch_id": str(s.batch_id) if s.batch_id else None,
            "batch_name": s.batch.name if s.batch else "General Batch",
            "subject_id": str(s.subject_id) if s.subject_id else None,
            "subject_name": s.subject.name if s.subject else ("HyperBuild Session" if is_hb else "Class Session"),
            "subject_code": s.subject.code if s.subject else ("HB" if is_hb else "SUB"),
            "venue": s.venue or "Campus Classroom",
            "faculty_name": fac_name,
            "attendance_status": calc_status,
            "is_locked": any(a.is_locked for a in atts) if atts else False,
            "total_students": total_students if is_marked else 0,
            "present_count": present_count if is_marked else 0,
            "absent_count": absent_count if is_marked else 0,
            "late_count": late_count if is_marked else 0,
            "excused_count": excused_count if is_marked else 0,
            "od_count": od_count if is_marked else 0,
            "attendance_percentage": pct,
            "absentees": absentees if is_marked else [],
        })

    return register_out


async def get_subject_attendance_matrix(
    db: AsyncSession,
    subject_id: Optional[UUID] = None,
    batch_id: Optional[UUID] = None,
    category: Optional[str] = None,
    current_user_id: Optional[UUID] = None,
    user_roles: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Returns a full cross-tab matrix of students and sessions for a subject,
    maintaining completely separate metrics and eligibility for:
      - Academic Lectures
      - HyperBuild Activities
    along with overall exam debarment standing.
    """
    roles = user_roles or []
    is_admin = any(r in ["crc_admin", "crc_coordinator", "approver", "reporting_readonly", "finance"] for r in roles)

    # If no subject_id provided, find the first available active subject
    if not subject_id:
        if not is_admin and current_user_id:
            fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, current_user_id)
            if fac_id:
                alloc_stmt = select(SubjectBatch.subject_id).where(SubjectBatch.status == "active")
                if fac_type == "internal":
                    alloc_stmt = alloc_stmt.where(SubjectBatch.faculty_internal_id == fac_id)
                else:
                    alloc_stmt = alloc_stmt.where(SubjectBatch.faculty_external_id == fac_id)
                alloc_res = await db.execute(alloc_stmt)
                subject_id = alloc_res.scalars().first()
        if not subject_id:
            sub_pick_stmt = select(Subject.id).where(Subject.is_deleted == False).order_by(Subject.name.asc()).limit(1)
            sub_pick_res = await db.execute(sub_pick_stmt)
            subject_id = sub_pick_res.scalar_one_or_none()

        if not subject_id:
            return {
                "subject_id": None,
                "subject_name": "No subjects available",
                "subject_code": "",
                "batch_id": str(batch_id) if batch_id else None,
                "category": category or "all",
                "total_sessions": 0,
                "total_conducted": 0,
                "total_scheduled": 0,
                "total_students": 0,
                "average_attendance_percentage": 0.0,
                "safe_count": 0,
                "warning_count": 0,
                "debarred_count": 0,
                "exam_eligible_count": 0,
                "exam_debarred_count": 0,
                "academic_summary": {"total_conducted": 0, "total_scheduled": 0, "average_percentage": 0.0, "safe_count": 0, "debarred_count": 0},
                "hyperbuild_summary": {"total_conducted": 0, "total_scheduled": 0, "average_percentage": 0.0, "safe_count": 0, "debarred_count": 0},
                "exam_summary": {"total_students": 0, "eligible_count": 0, "debarred_count": 0, "debarred_academic_only": 0, "debarred_hyperbuild_only": 0, "debarred_both": 0},
                "sessions": [],
                "students": [],
            }

    if not is_admin and current_user_id:
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, current_user_id)
        if fac_id:
            alloc_stmt = select(SubjectBatch).where(
                SubjectBatch.subject_id == subject_id,
                SubjectBatch.status == "active",
            )
            if fac_type == "internal":
                alloc_stmt = alloc_stmt.where(SubjectBatch.faculty_internal_id == fac_id)
            else:
                alloc_stmt = alloc_stmt.where(SubjectBatch.faculty_external_id == fac_id)
            if batch_id:
                alloc_stmt = alloc_stmt.where(SubjectBatch.batch_id == batch_id)
            alloc_res = await db.execute(alloc_stmt)
            if not alloc_res.scalars().first():
                raise ValueError("Access denied: You are not allocated to teach this subject.")

    sub_stmt = (
        select(Subject)
        .options(
            selectinload(Subject.batch_allocations).selectinload(SubjectBatch.batch),
        )
        .where(Subject.id == subject_id, Subject.is_deleted == False)
    )
    sub_res = await db.execute(sub_stmt)
    subject = sub_res.scalar_one_or_none()
    if not subject:
        raise ValueError("Subject not found")

    # Fetch marked/completed regular sessions
    sess_stmt = (
        select(Session)
        .options(
            selectinload(Session.batch),
            selectinload(Session.faculty_internal),
            selectinload(Session.faculty_external),
        )
        .where(
            Session.subject_id == subject_id,
            Session.is_deleted == False,
        )
        .order_by(Session.session_date.asc(), Session.start_time.asc())
    )
    if batch_id:
        sess_stmt = sess_stmt.where(Session.batch_id == batch_id)

    sess_res = await db.execute(sess_stmt)
    all_sessions = sess_res.scalars().all()

    # Preload all attendance records for regular sessions
    session_ids = [s.id for s in all_sessions]
    att_map: Dict[tuple[UUID, UUID], StudentAttendance] = {}
    if session_ids:
        att_stmt = (
            select(StudentAttendance)
            .where(StudentAttendance.session_id.in_(session_ids))
        )
        att_res = await db.execute(att_stmt)
        for a in att_res.scalars().all():
            att_map[(a.student_id, a.session_id)] = a

    # Fetch conducted HyperBuild activities tied to this subject
    hb_stmt = (
        select(HyperbuildActivity)
        .options(
            selectinload(HyperbuildActivity.session).selectinload(Session.batch),
            selectinload(HyperbuildActivity.session).selectinload(Session.faculty_internal),
            selectinload(HyperbuildActivity.session).selectinload(Session.faculty_external),
            selectinload(HyperbuildActivity.verifications),
        )
        .where(
            HyperbuildActivity.subject_id == subject_id,
            HyperbuildActivity.is_deleted == False,
        )
    )
    hb_res = await db.execute(hb_stmt)
    conducted_hb_activities = [
        act for act in hb_res.scalars().all()
        if act.session and (not batch_id or act.session.batch_id == batch_id)
        and ((act.status in ["active", "closed"]) or (act.challenge_key is not None) or len(act.verifications) > 0)
    ]

    # Pre-index all activity verifications for O(1) instant lookup
    all_act_verif_map: Dict[Tuple[UUID, UUID], Any] = {}
    for act in conducted_hb_activities:
        for v in act.verifications:
            all_act_verif_map[(act.id, v.student_id)] = v

    # Preload parent session attendance for HyperBuild fallback
    hb_parent_session_ids = [act.session_id for act in conducted_hb_activities if act.session_id]
    parent_sess_att_map: Dict[Tuple[UUID, UUID], str] = {}
    if hb_parent_session_ids:
        p_att_stmt = select(StudentAttendance.session_id, StudentAttendance.student_id, StudentAttendance.status).where(
            StudentAttendance.session_id.in_(hb_parent_session_ids)
        )
        p_att_res = await db.execute(p_att_stmt)
        for s_id, st_id, st_st in p_att_res.all():
            parent_sess_att_map[(s_id, st_id)] = st_st

    # Determine batch IDs
    relevant_batch_ids = list(set([s.batch_id for s in all_sessions if s.batch_id]))
    for act in conducted_hb_activities:
        if act.session and act.session.batch_id:
            relevant_batch_ids.append(act.session.batch_id)
    relevant_batch_ids = list(set(relevant_batch_ids))

    if not relevant_batch_ids and subject.batch_allocations:
        relevant_batch_ids = [ba.batch_id for ba in subject.batch_allocations if ba.batch_id]

    # Fetch enrolled students
    st_stmt = select(Student).where(Student.status == "active", Student.is_deleted == False)
    if batch_id:
        st_stmt = st_stmt.where(Student.batch_id == batch_id)
    elif relevant_batch_ids:
        st_stmt = st_stmt.where(Student.batch_id.in_(relevant_batch_ids))

    st_stmt = st_stmt.order_by(Student.roll_no.asc().nullslast(), Student.first_name.asc())
    st_res = await db.execute(st_stmt)
    all_cand_students = st_res.scalars().all()
    students = [st for st in all_cand_students if is_student_eligible_for_subject(subject, st)]

    # ── Separate and index regular lectures vs HyperBuild activities ──
    sessions_with_attendance = {s_id for (_, s_id) in att_map.keys()}

    regular_items: List[Dict[str, Any]] = []
    for s in all_sessions:
        s_date = s.session_date or date.min
        s_time = s.start_time or time.min
        is_conducted = (s.attendance_status == "marked") or (s.status == "completed") or (s.id in sessions_with_attendance)
        regular_items.append({
            "type": "regular",
            "category": "academic_lecture",
            "category_label": "Academic Lecture",
            "date": s_date,
            "time": s_time,
            "obj": s,
            "is_conducted": is_conducted,
        })
    regular_items.sort(key=lambda x: (x["date"], x["time"]))
    for i, item in enumerate(regular_items):
        item["session_code"] = f"L{i + 1}"
        item["lecture_no"] = i + 1

    hyperbuild_items: List[Dict[str, Any]] = []
    for act in conducted_hb_activities:
        s_date = act.session.session_date if act.session else date.min
        s_time = act.start_time or (act.session.start_time if act.session else time.min)
        hyperbuild_items.append({
            "type": "hyperbuild",
            "category": "hyperbuild_activity",
            "category_label": "HyperBuild Activity",
            "date": s_date,
            "time": s_time,
            "obj": act,
            "is_conducted": True,
        })
    hyperbuild_items.sort(key=lambda x: (x["date"], x["time"]))
    for i, item in enumerate(hyperbuild_items):
        item["session_code"] = f"HB{i + 1}"
        item["hb_no"] = i + 1

    # Filter visible sessions according to category filter
    if category == "academic":
        visible_sessions = list(regular_items)
    elif category == "hyperbuild":
        visible_sessions = list(hyperbuild_items)
    else:
        visible_sessions = sorted(regular_items + hyperbuild_items, key=lambda x: (x["date"], x["time"]))

    # Build sessions header for visible sessions
    sessions_header = []
    for idx, item in enumerate(visible_sessions):
        is_cond = item.get("is_conducted", True)
        if item["type"] == "regular":
            s = item["obj"]
            fac_name = "Faculty"
            if s.faculty_internal:
                fac_name = s.faculty_internal.full_name
            elif s.faculty_external:
                fac_name = s.faculty_external.name

            if is_cond:
                p_count = sum(
                    1 for st in students if (st.id, s.id) in att_map and att_map[(st.id, s.id)].status in PRESENT_STATUSES
                )
                pct = round((p_count / len(students) * 100), 1) if students else 0.0
            else:
                p_count = 0
                pct = 0.0

            sessions_header.append({
                "id": str(s.id),
                "session_no": idx + 1,
                "session_code": item.get("session_code", f"L{idx + 1}"),
                "category": "academic_lecture",
                "category_label": "Academic Lecture",
                "session_date": s.session_date.isoformat() if s.session_date else "",
                "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
                "end_time": s.end_time.strftime("%H:%M") if s.end_time else "",
                "venue": s.venue or "Room",
                "faculty_name": fac_name,
                "present_count": p_count,
                "total_students": len(students),
                "percentage": pct,
                "is_conducted": is_cond,
                "is_hyperbuild": False,
            })
        else:
            act = item["obj"]
            sess = act.session
            fac_name = "Faculty"
            if sess.faculty_internal:
                fac_name = sess.faculty_internal.full_name
            elif sess.faculty_external:
                fac_name = sess.faculty_external.name

            # Calculate presence for this activity
            act_verif_map = {v.student_id: v for v in act.verifications}
            act_req_key = (act.challenge_key is not None) or (act.status in ["active", "closed"]) or len(act.verifications) > 0
            p_count = 0
            for st in students:
                p_st = parent_sess_att_map.get((act.session_id, st.id))
                parent_is_p = p_st in PRESENT_STATUSES
                v_rec = act_verif_map.get(st.id)
                v_is_p = v_rec is not None and v_rec.verification_status in ["verified_present", "late_submission", "present"]

                if act_req_key:
                    if parent_is_p and v_is_p:
                        p_count += 1
                else:
                    if parent_is_p:
                        p_count += 1

            pct = round((p_count / len(students) * 100), 1) if students else 0.0

            s_time_str = act.start_time.strftime("%H:%M") if act.start_time else (sess.start_time.strftime("%H:%M") if sess.start_time else "")
            e_time_str = act.end_time.strftime("%H:%M") if act.end_time else (sess.end_time.strftime("%H:%M") if sess.end_time else "")

            sessions_header.append({
                "id": str(act.id),
                "session_no": idx + 1,
                "session_code": item.get("session_code", f"HB{idx + 1}"),
                "category": "hyperbuild_activity",
                "category_label": "HyperBuild Activity",
                "activity_title": act.title,
                "activity_no": act.activity_no,
                "session_date": sess.session_date.isoformat() if sess.session_date else "",
                "start_time": s_time_str,
                "end_time": e_time_str,
                "venue": f"{sess.venue or 'HyperBuild Lab'} · Act #{act.activity_no}",
                "faculty_name": fac_name,
                "present_count": p_count,
                "total_students": len(students),
                "percentage": pct,
                "is_conducted": True,
                "is_hyperbuild": True,
            })

    # ── Build students matrix rows with separate Academic vs HyperBuild metrics ──
    conducted_regular = [it for it in regular_items if it.get("is_conducted", True)]
    acad_conducted_total = len(conducted_regular)
    hb_conducted_total = len(hyperbuild_items)

    view_conducted_total = sum(1 for item in visible_sessions if item.get("is_conducted", True))
    view_scheduled_total = len(visible_sessions)

    students_matrix = []

    for st in students:
        # 1. Academic Lecture calculations
        acad_att = 0
        for item in conducted_regular:
            s = item["obj"]
            rec = att_map.get((st.id, s.id))
            if rec and rec.status in PRESENT_STATUSES:
                acad_att += 1

        acad_pct = round((acad_att / acad_conducted_total * 100.0), 1) if acad_conducted_total > 0 else None
        acad_eligible = (acad_conducted_total == 0) or (acad_pct is not None and acad_pct >= 75.0)
        acad_shortfall = max(0, int((0.75 * acad_conducted_total - acad_att) / 0.25) + 1) if (acad_conducted_total > 0 and acad_pct < 75.0) else 0

        # 2. HyperBuild Activity calculations
        hb_att = 0
        for item in hyperbuild_items:
            act = item["obj"]
            act_req_key = (act.challenge_key is not None) or (act.status in ["active", "closed"]) or len(act.verifications) > 0
            p_st = parent_sess_att_map.get((act.session_id, st.id))
            parent_is_p = p_st in PRESENT_STATUSES
            v_rec = all_act_verif_map.get((act.id, st.id))
            v_is_p = v_rec is not None and v_rec.verification_status in ["verified_present", "late_submission", "present"]

            if act_req_key:
                if parent_is_p and v_is_p:
                    hb_att += 1
            else:
                if parent_is_p:
                    hb_att += 1

        hb_pct = round((hb_att / hb_conducted_total * 100.0), 1) if hb_conducted_total > 0 else None
        hb_eligible = (hb_conducted_total == 0) or (hb_pct is not None and hb_pct >= 75.0)
        hb_shortfall = max(0, int((0.75 * hb_conducted_total - hb_att) / 0.25) + 1) if (hb_conducted_total > 0 and hb_pct < 75.0) else 0

        # 3. Overall Exam Debarment Standing (Minimum 75% in BOTH categories)
        total_all_conducted = acad_conducted_total + hb_conducted_total
        is_exam_eligible = acad_eligible and hb_eligible
        is_debarred = (total_all_conducted > 0) and (not is_exam_eligible)

        if not acad_eligible and not hb_eligible:
            debarred_cat = "both"
            debar_reason = f"Debarred: Both Academic Lectures ({acad_pct}%) and HyperBuild Activities ({hb_pct}%) are below 75%"
        elif not acad_eligible:
            debarred_cat = "academic_only"
            debar_reason = f"Debarred: Academic Lectures attendance is {acad_pct}% (minimum 75% required)"
        elif not hb_eligible:
            debarred_cat = "hyperbuild_only"
            debar_reason = f"Debarred: HyperBuild Activities attendance is {hb_pct}% (minimum 75% required)"
        else:
            debarred_cat = None
            debar_reason = "Eligible for Examination (Meets 75% requirement in both categories)"

        # 4. Status mapping for currently visible sessions in matrix table
        records: Dict[str, str] = {}
        view_attended = 0

        for item in visible_sessions:
            if item["type"] == "regular":
                s = item["obj"]
                rec = att_map.get((st.id, s.id))
                if item.get("is_conducted", True):
                    if rec:
                        records[str(s.id)] = rec.status
                        if rec.status in PRESENT_STATUSES:
                            view_attended += 1
                    else:
                        records[str(s.id)] = "unmarked"
                else:
                    records[str(s.id)] = "unmarked"
            else:
                act = item["obj"]
                act_req_key = (act.challenge_key is not None) or (act.status in ["active", "closed"]) or len(act.verifications) > 0
                p_st = parent_sess_att_map.get((act.session_id, st.id))
                parent_is_p = p_st in PRESENT_STATUSES
                v_rec = all_act_verif_map.get((act.id, st.id))
                v_is_p = v_rec is not None and v_rec.verification_status in ["verified_present", "late_submission", "present"]

                if act_req_key:
                    if parent_is_p and v_is_p:
                        records[str(act.id)] = "present"
                        view_attended += 1
                    else:
                        records[str(act.id)] = "absent"
                else:
                    if parent_is_p:
                        records[str(act.id)] = "present"
                        view_attended += 1
                    else:
                        records[str(act.id)] = "absent"

        view_pct = round((view_attended / view_conducted_total * 100.0), 1) if view_conducted_total > 0 else 0.0

        if is_debarred:
            tier = "debarred"
        elif view_conducted_total == 0:
            tier = "not_started"
        elif view_pct >= 75.0:
            tier = "safe"
        else:
            tier = "warning"

        students_matrix.append({
            "student_id": str(st.id),
            "student_name": f"{st.first_name} {st.last_name or ''}".strip(),
            "student_prn": st.prn_number or st.roll_no or "PRN-N/A",
            "roll_no": st.roll_no or "-",

            # Academic Lectures breakdown
            "academic_total": acad_conducted_total,
            "academic_attended": acad_att,
            "academic_percentage": acad_pct,
            "academic_eligible": acad_eligible,
            "academic_shortfall": acad_shortfall,

            # HyperBuild Activities breakdown
            "hyperbuild_total": hb_conducted_total,
            "hyperbuild_attended": hb_att,
            "hyperbuild_percentage": hb_pct,
            "hyperbuild_eligible": hb_eligible,
            "hyperbuild_shortfall": hb_shortfall,

            # Exam Eligibility & Debarment Standing
            "is_exam_eligible": is_exam_eligible,
            "is_debarred": is_debarred,
            "debarred_category": debarred_cat,
            "debarment_reason": debar_reason,

            # Currently visible view metrics
            "total_attended": view_attended,
            "total_conducted": view_conducted_total,
            "percentage": view_pct,
            "tier": tier,
            "needed_classes_for_75": max(acad_shortfall, hb_shortfall),
            "attendance_by_session": records,
        })

    # Summary calculations
    acad_avg_pct = round(
        sum((st["academic_percentage"] or 0.0) for st in students_matrix if st["academic_percentage"] is not None) /
        max(1, sum(1 for st in students_matrix if st["academic_percentage"] is not None)),
        1
    ) if acad_conducted_total > 0 else 0.0

    hb_avg_pct = round(
        sum((st["hyperbuild_percentage"] or 0.0) for st in students_matrix if st["hyperbuild_percentage"] is not None) /
        max(1, sum(1 for st in students_matrix if st["hyperbuild_percentage"] is not None)),
        1
    ) if hb_conducted_total > 0 else 0.0

    view_avg_pct = round(
        sum(st["percentage"] for st in students_matrix if st["tier"] != "not_started") /
        max(1, sum(1 for st in students_matrix if st["tier"] != "not_started")),
        1
    ) if (students_matrix and any(st["tier"] != "not_started" for st in students_matrix)) else 0.0

    safe_count = sum(1 for st in students_matrix if st["tier"] == "safe")
    warning_count = sum(1 for st in students_matrix if st["tier"] == "warning")
    debarred_count = sum(1 for st in students_matrix if st["is_debarred"])

    academic_summary = {
        "total_conducted": acad_conducted_total,
        "total_scheduled": len(regular_items),
        "average_percentage": acad_avg_pct,
        "safe_count": sum(1 for st in students_matrix if st["academic_eligible"]),
        "debarred_count": sum(1 for st in students_matrix if (acad_conducted_total > 0 and not st["academic_eligible"])),
    }

    hyperbuild_summary = {
        "total_conducted": hb_conducted_total,
        "total_scheduled": len(hyperbuild_items),
        "average_percentage": hb_avg_pct,
        "safe_count": sum(1 for st in students_matrix if st["hyperbuild_eligible"]),
        "debarred_count": sum(1 for st in students_matrix if (hb_conducted_total > 0 and not st["hyperbuild_eligible"])),
    }

    exam_summary = {
        "total_students": len(students),
        "eligible_count": sum(1 for st in students_matrix if st["is_exam_eligible"]),
        "debarred_count": debarred_count,
        "debarred_academic_only": sum(1 for st in students_matrix if st["debarred_category"] == "academic_only"),
        "debarred_hyperbuild_only": sum(1 for st in students_matrix if st["debarred_category"] == "hyperbuild_only"),
        "debarred_both": sum(1 for st in students_matrix if st["debarred_category"] == "both"),
    }

    return {
        "subject_id": str(subject.id),
        "subject_name": subject.name,
        "subject_code": subject.code or subject.course_code or "SUB",
        "batch_id": str(batch_id) if batch_id else None,
        "category": category or "all",
        "total_sessions": view_conducted_total,
        "total_conducted": view_conducted_total,
        "total_scheduled": view_scheduled_total,
        "total_students": len(students),
        "average_attendance_percentage": view_avg_pct,
        "safe_count": safe_count,
        "warning_count": warning_count,
        "debarred_count": debarred_count,
        "exam_eligible_count": exam_summary["eligible_count"],
        "exam_debarred_count": exam_summary["debarred_count"],
        "academic_summary": academic_summary,
        "hyperbuild_summary": hyperbuild_summary,
        "exam_summary": exam_summary,
        "sessions": sessions_header,
        "students": students_matrix,
    }



async def get_student_class_attendance_ledger(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    batch_id: Optional[UUID] = None,
    program_id: Optional[UUID] = None,
    subject_id: Optional[UUID] = None,
    session_id: Optional[UUID] = None,
    faculty_id: Optional[UUID] = None,
    attendance_status: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    search_query: Optional[str] = None,
    current_user_id: Optional[UUID] = None,
    user_roles: Optional[List[str]] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = 0,
    **kwargs,
) -> Dict[str, Any]:
    """
    Fetches granular student-by-student, class-by-class, day-by-day attendance ledger records
    with comprehensive filtering, faculty scoping, and cohort analytics.
    """
    eff_status = attendance_status or status_filter
    eff_search = search or search_query
    eff_category = kwargs.get("category") or kwargs.get("category_filter")

    roles = user_roles or []
    is_admin = any(r in ["crc_admin", "crc_coordinator", "approver", "reporting_readonly", "finance", "admin", "super_admin"] for r in roles)

    query = (
        select(
            StudentAttendance,
            Session,
            Student,
            Subject,
            Batch,
            Program,
            FacultyInternal,
            FacultyExternal,
            Topic,
        )
        .join(Session, StudentAttendance.session_id == Session.id)
        .join(Student, StudentAttendance.student_id == Student.id)
        .outerjoin(Subject, Session.subject_id == Subject.id)
        .outerjoin(Batch, Session.batch_id == Batch.id)
        .outerjoin(Program, Session.program_id == Program.id)
        .outerjoin(FacultyInternal, Session.faculty_internal_id == FacultyInternal.id)
        .outerjoin(FacultyExternal, Session.faculty_external_id == FacultyExternal.id)
        .outerjoin(Topic, Session.topic_id == Topic.id)
        .where(Session.is_deleted == False, Student.is_deleted == False)
    )

    # Faculty Scoping: If user is only faculty, restrict to their allocated classes
    if not is_admin and any(r in ["faculty_internal", "faculty_external"] for r in roles) and current_user_id:
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, current_user_id)
        if fac_id:
            if fac_type == "internal":
                alloc_stmt = select(SubjectBatch.subject_id, SubjectBatch.batch_id).where(
                    SubjectBatch.faculty_internal_id == fac_id, SubjectBatch.status == "active"
                )
                alloc_res = await db.execute(alloc_stmt)
                allocated_pairs = alloc_res.all()

                fac_conditions = [Session.faculty_internal_id == fac_id]
                for s_id, b_id in allocated_pairs:
                    if b_id:
                        fac_conditions.append(and_(Session.subject_id == s_id, Session.batch_id == b_id))
                    else:
                        fac_conditions.append(Session.subject_id == s_id)
                query = query.where(or_(*fac_conditions))
            else:
                alloc_stmt = select(SubjectBatch.subject_id, SubjectBatch.batch_id).where(
                    SubjectBatch.faculty_external_id == fac_id, SubjectBatch.status == "active"
                )
                alloc_res = await db.execute(alloc_stmt)
                allocated_pairs = alloc_res.all()

                fac_conditions = [Session.faculty_external_id == fac_id]
                for s_id, b_id in allocated_pairs:
                    if b_id:
                        fac_conditions.append(and_(Session.subject_id == s_id, Session.batch_id == b_id))
                    else:
                        fac_conditions.append(Session.subject_id == s_id)
                query = query.where(or_(*fac_conditions))
        else:
            return {
                "items": [],
                "summary": {
                    "total_records": 0,
                    "present_count": 0,
                    "absent_count": 0,
                    "late_count": 0,
                    "excused_count": 0,
                    "od_count": 0,
                    "attendance_percentage": 0.0,
                    "unique_students": 0,
                    "unique_sessions": 0,
                },
                "total": 0,
            }

    # Filters
    if start_date:
        query = query.where(Session.session_date >= start_date)
    if end_date:
        query = query.where(Session.session_date <= end_date)
    if batch_id:
        query = query.where(Session.batch_id == batch_id)
    if program_id:
        query = query.where(Session.program_id == program_id)
    if subject_id:
        hb_has_subject = (
            select(1)
            .select_from(HyperbuildActivity)
            .where(
                HyperbuildActivity.session_id == Session.id,
                HyperbuildActivity.subject_id == subject_id,
                HyperbuildActivity.is_deleted == False,
            )
            .exists()
        )
        query = query.where(
            or_(
                Session.subject_id == subject_id,
                and_(Session.session_type == "hyperbuild", hb_has_subject),
            )
        )
    if session_id:
        query = query.where(Session.id == session_id)
    if faculty_id:
        query = query.where(
            or_(
                Session.faculty_internal_id == faculty_id,
                Session.faculty_external_id == faculty_id,
            )
        )

    query = query.order_by(
        Session.session_date.desc(),
        Session.start_time.desc(),
        Student.roll_no.asc(),
        Student.prn_number.asc(),
        Student.full_name.asc(),
    )

    result = await db.execute(query)
    all_rows = result.all()

    # Pre-fetch HyperBuild activities and verifications for all HyperBuild sessions in the result
    hb_session_ids = list({sess.id for _, sess, _, _, _, _, _, _, _ in all_rows if sess.session_type == "hyperbuild"})

    hb_acts_by_sess: Dict[UUID, List[HyperbuildActivity]] = {}
    hb_verifs_map: Dict[tuple, HyperbuildActivityVerification] = {}

    if hb_session_ids:
        act_query = (
            select(HyperbuildActivity, Subject)
            .outerjoin(Subject, HyperbuildActivity.subject_id == Subject.id)
            .where(
                HyperbuildActivity.session_id.in_(hb_session_ids),
                HyperbuildActivity.is_deleted == False,
            )
            .order_by(HyperbuildActivity.activity_no)
        )
        act_rows = (await db.execute(act_query)).all()
        for act, act_subj in act_rows:
            act.subject = act_subj
            hb_acts_by_sess.setdefault(act.session_id, []).append(act)

        v_query = select(HyperbuildActivityVerification).where(
            HyperbuildActivityVerification.session_id.in_(hb_session_ids),
            HyperbuildActivityVerification.is_deleted == False,
        )
        v_rows = (await db.execute(v_query)).scalars().all()
        for v in v_rows:
            hb_verifs_map[(v.activity_id, v.student_id)] = v

    present_count = 0
    absent_count = 0
    late_count = 0
    excused_count = 0
    od_count = 0
    unique_students_set = set()
    unique_sessions_set = set()

    formatted_items = []

    for att, sess, st, subj, batch, prog, fi, fe, topic in all_rows:
        fac_name = "Unassigned"
        if fi and fi.full_name:
            fac_name = fi.full_name
        elif fe and fe.name:
            fac_name = fe.name

        if sess.session_type == "hyperbuild":
            if eff_category and eff_category.lower().strip() in ["academic", "academic_lecture"]:
                continue
            acts = hb_acts_by_sess.get(sess.id, [])
            if subject_id:
                acts = [a for a in acts if a.subject_id == subject_id]

            if acts:
                for act in acts:
                    act_subj = act.subject
                    if act_subj and not is_student_eligible_for_subject(act_subj, st):
                        continue

                    s_code = act_subj.code or act_subj.course_code if act_subj else "HB"
                    s_name = act_subj.name if act_subj else act.title
                    t_title = f"Act #{act.activity_no}: {act.title}"

                    s_time = act.start_time.strftime("%H:%M") if act.start_time else (sess.start_time.strftime("%H:%M") if sess.start_time else "")
                    e_time = act.end_time.strftime("%H:%M") if act.end_time else (sess.end_time.strftime("%H:%M") if sess.end_time else "")
                    slot_str = f"{s_time} - {e_time}" if s_time and e_time else ""

                    v_rec = hb_verifs_map.get((act.id, st.id))
                    v_is_present = v_rec is not None and v_rec.verification_status in ["verified_present", "late_submission", "present"]
                    act_required_key = bool(act.challenge_key) or (act.status in ["active", "closed"]) or (act.challenge_key_active_until is not None)

                    roll_call = att.roll_call_status or att.status or "present"
                    parent_is_present = roll_call in PRESENT_STATUSES

                    if act_required_key:
                        if parent_is_present and v_is_present:
                            act_status = "present"
                            item_remarks = f"HyperBuild: {act.title} (Verified)"
                            marked_time = v_rec.verified_at or att.created_at
                        elif parent_is_present and not v_is_present:
                            act_status = "absent"
                            item_remarks = f"HyperBuild: {act.title} (Absent: Secret key not entered)"
                            marked_time = att.created_at
                        elif not parent_is_present:
                            act_status = att.status or "absent"
                            item_remarks = f"HyperBuild: {act.title} (Roll Call: Absent)"
                            marked_time = att.created_at
                        else:
                            act_status = "absent"
                            item_remarks = f"HyperBuild: {act.title}"
                            marked_time = att.created_at
                    else:
                        act_status = "present" if parent_is_present else (att.status or "absent")
                        item_remarks = f"HyperBuild: {act.title}"
                        marked_time = att.created_at

                    if att.status in ("excused", "leave_approved"):
                        act_status = "excused"
                    elif att.status in ("od_duty", "on_duty", "on duty"):
                        act_status = "od_duty"

                    # Status filter
                    if eff_status and eff_status.lower() != "all":
                        st_low = eff_status.lower()
                        if st_low == "present" and act_status not in PRESENT_STATUSES:
                            continue
                        elif st_low == "absent" and act_status != "absent":
                            continue
                        elif st_low in ("late", "excused", "od_duty") and act_status != st_low:
                            continue

                    # Search filter
                    if eff_search and eff_search.strip():
                        term = eff_search.strip().lower()
                        searchable = f"{st.full_name} {st.first_name} {st.last_name or ''} {st.prn_number or ''} {st.roll_no or ''} {st.email_official or ''} {st.email or ''} {s_name} {s_code} {t_title} {sess.venue or ''}".lower()
                        if term not in searchable:
                            continue

                    if act_status in PRESENT_STATUSES:
                        present_count += 1
                        if act_status == "late":
                            late_count += 1
                        elif act_status in ("excused", "leave_approved"):
                            excused_count += 1
                        elif act_status in ("od_duty", "on_duty", "on duty"):
                            od_count += 1
                    elif act_status == "absent":
                        absent_count += 1

                    unique_students_set.add(st.id)
                    unique_sessions_set.add(sess.id)

                    formatted_items.append({
                        "id": uuid.uuid5(uuid.NAMESPACE_DNS, f"{att.id}-{act.id}"),
                        "attendance_id": att.id,
                        "activity_id": act.id,
                        "student_id": st.id,
                        "student_prn": st.prn_number or "",
                        "student_name": st.full_name or f"{st.first_name} {st.last_name or ''}".strip(),
                        "roll_no": st.roll_no or "",
                        "official_email": st.email_official or st.email or "",
                        "personal_email": st.email_personal or "",
                        "phone": st.mobile_number or st.phone or "",
                        "program_name": prog.name if prog else "",
                        "batch_name": batch.name if batch else "",
                        "division": getattr(st, "division", "") or "",
                        "trimester": st.trimester,
                        "session_id": sess.id,
                        "session_date": sess.session_date,
                        "day_of_week": sess.session_date.strftime("%A"),
                        "start_time": s_time,
                        "end_time": e_time,
                        "time_slot": slot_str,
                        "subject_id": act.subject_id,
                        "subject_code": s_code,
                        "subject_name": s_name,
                        "session_type": sess.session_type,
                        "category": "HyperBuild Activity",
                        "activity_title": act.title,
                        "activity_no": act.activity_no,
                        "topic_delivered": t_title,
                        "venue": f"{sess.venue or 'HyperBuild Lab'} · Act #{act.activity_no}",
                        "faculty_name": fac_name,
                        "status": act_status,
                        "remarks": item_remarks,
                        "is_locked": att.is_locked,
                        "marked_at": marked_time,
                    })
                continue

        # Regular session (or fallback if no activities)
        if eff_category and eff_category.lower().strip() in ["hyperbuild", "hyperbuild_activity"]:
            continue

        if subject_id and sess.subject_id != subject_id:
            continue

        cur_status = att.status or "present"
        if eff_status and eff_status.lower() != "all":
            st_low = eff_status.lower()
            if st_low == "present" and cur_status not in PRESENT_STATUSES:
                continue
            elif st_low == "absent" and cur_status != "absent":
                continue
            elif st_low in ("late", "excused", "od_duty") and cur_status != st_low:
                continue

        sub_code = subj.code if subj else ("HB" if sess.session_type == "hyperbuild" else "SUB")
        sub_name = subj.name if subj else ("HyperBuild Session" if sess.session_type == "hyperbuild" else "Class Session")
        topic_title = topic.name if topic else (sess.notes or (f"HyperBuild Act #{sess.hyperbuild_activity_no}" if sess.hyperbuild_activity_no else "Regular Lecture"))

        if eff_search and eff_search.strip():
            term = eff_search.strip().lower()
            searchable = f"{st.full_name} {st.first_name} {st.last_name or ''} {st.prn_number or ''} {st.roll_no or ''} {st.email_official or ''} {st.email or ''} {sub_name} {sub_code} {topic_title} {sess.venue or ''}".lower()
            if term not in searchable:
                continue

        if cur_status in PRESENT_STATUSES:
            present_count += 1
            if cur_status == "late":
                late_count += 1
            elif cur_status in ("excused", "leave_approved"):
                excused_count += 1
            elif cur_status in ("od_duty", "on_duty", "on duty"):
                od_count += 1
        elif cur_status == "absent":
            absent_count += 1

        unique_students_set.add(st.id)
        unique_sessions_set.add(sess.id)

        start_str = sess.start_time.strftime("%H:%M") if sess.start_time else ""
        end_str = sess.end_time.strftime("%H:%M") if sess.end_time else ""
        slot_str = f"{start_str} - {end_str}" if start_str and end_str else ""

        formatted_items.append({
            "id": att.id,
            "attendance_id": att.id,
            "activity_id": None,
            "student_id": st.id,
            "student_prn": st.prn_number or "",
            "student_name": st.full_name or f"{st.first_name} {st.last_name or ''}".strip(),
            "roll_no": st.roll_no or "",
            "official_email": st.email_official or st.email or "",
            "personal_email": st.email_personal or "",
            "phone": st.mobile_number or st.phone or "",
            "program_name": prog.name if prog else "",
            "batch_name": batch.name if batch else "",
            "division": getattr(st, "division", "") or "",
            "trimester": st.trimester,
            "session_id": sess.id,
            "session_date": sess.session_date,
            "day_of_week": sess.session_date.strftime("%A"),
            "start_time": start_str,
            "end_time": end_str,
            "time_slot": slot_str,
            "subject_id": sess.subject_id,
            "subject_code": sub_code,
            "subject_name": sub_name,
            "session_type": sess.session_type,
            "category": "Academic Lecture",
            "activity_title": None,
            "activity_no": None,
            "topic_delivered": topic_title,
            "venue": sess.venue or "Classroom",
            "faculty_name": fac_name,
            "status": cur_status,
            "remarks": att.remarks or "",
            "is_locked": att.is_locked,
            "marked_at": att.created_at,
        })

    total_records = len(formatted_items)
    att_pct = round((present_count / total_records * 100), 1) if total_records > 0 else 0.0

    summary = {
        "total_records": total_records,
        "present_count": present_count,
        "absent_count": absent_count,
        "late_count": late_count,
        "excused_count": excused_count,
        "od_count": od_count,
        "attendance_percentage": att_pct,
        "unique_students": len(unique_students_set),
        "unique_sessions": len(unique_sessions_set),
    }

    paged_items = formatted_items
    if limit is not None:
        paged_items = formatted_items[offset : offset + limit]

    return {
        "items": paged_items,
        "summary": summary,
        "total": total_records,
    }



def export_student_class_attendance_ledger_excel(
    items: List[Dict[str, Any]],
    selected_fields: List[str],
) -> bytes:
    """
    Builds a beautifully styled, professional .xlsx spreadsheet containing
    only the user-selected columns with proper formatting, headers, and column widths.
    """
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    FIELD_LABELS: Dict[str, str] = {
        "student_prn": "PRN Number",
        "student_name": "Student Name",
        "roll_no": "Roll No",
        "official_email": "Official Email",
        "personal_email": "Personal Email",
        "phone": "Mobile Number",
        "program_name": "Program",
        "batch_name": "Batch",
        "division": "Division",
        "trimester": "Trimester",
        "session_date": "Session Date",
        "day_of_week": "Day",
        "time_slot": "Time Slot",
        "start_time": "Start Time",
        "end_time": "End Time",
        "subject_code": "Subject Code",
        "subject_name": "Subject Name",
        "topic_delivered": "Topic / Activity",
        "session_type": "Session Type",
        "venue": "Venue / Classroom",
        "faculty_name": "Faculty Name",
        "status": "Attendance Status",
        "marked_at": "Marked / Timestamp",
        "remarks": "Remarks / Notes",
    }

    if not selected_fields:
        selected_fields = [
            "student_prn", "student_name", "batch_name", "session_date", "day_of_week",
            "time_slot", "subject_code", "subject_name", "faculty_name", "status"
        ]

    valid_fields = [f for f in selected_fields if f in FIELD_LABELS]
    if not valid_fields:
        valid_fields = list(FIELD_LABELS.keys())[:10]

    wb = Workbook()
    ws = wb.active
    ws.title = "Daily Attendance Ledger"
    ws.views.sheetView[0].showGridLines = True

    # Header styling
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin_border = Border(
        left=Side(style="thin", color="E2E8F0"),
        right=Side(style="thin", color="E2E8F0"),
        top=Side(style="thin", color="E2E8F0"),
        bottom=Side(style="thin", color="E2E8F0"),
    )

    present_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
    absent_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")
    late_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")
    excused_fill = PatternFill(start_color="E0E7FF", end_color="E0E7FF", fill_type="solid")

    for col_idx, f_key in enumerate(valid_fields, start=1):
        cell = ws.cell(row=1, column=col_idx, value=FIELD_LABELS[f_key])
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_align
        cell.border = thin_border
    ws.row_dimensions[1].height = 28

    data_font = Font(name="Calibri", size=10)
    for row_idx, item in enumerate(items, start=2):
        status_val = str(item.get("status", "")).lower()
        for col_idx, f_key in enumerate(valid_fields, start=1):
            raw_val = item.get(f_key)
            if isinstance(raw_val, date):
                cell_val = raw_val.strftime("%Y-%m-%d")
            elif isinstance(raw_val, datetime):
                cell_val = raw_val.strftime("%Y-%m-%d %H:%M")
            elif raw_val is None:
                cell_val = ""
            else:
                cell_val = str(raw_val)

            cell = ws.cell(row=row_idx, column=col_idx, value=cell_val)
            cell.font = data_font
            cell.border = thin_border

            if f_key in ("session_date", "day_of_week", "start_time", "end_time", "time_slot", "roll_no", "student_prn", "status"):
                cell.alignment = Alignment(horizontal="center", vertical="center")
            else:
                cell.alignment = Alignment(horizontal="left", vertical="center")

            if f_key == "status":
                cell.value = status_val.upper()
                if status_val in ("present", "on_duty", "od_duty"):
                    cell.fill = present_fill
                    cell.font = Font(name="Calibri", size=10, bold=True, color="166534")
                elif status_val == "absent":
                    cell.fill = absent_fill
                    cell.font = Font(name="Calibri", size=10, bold=True, color="991B1B")
                elif status_val == "late":
                    cell.fill = late_fill
                    cell.font = Font(name="Calibri", size=10, bold=True, color="92400E")
                elif status_val in ("excused", "leave_approved"):
                    cell.fill = excused_fill
                    cell.font = Font(name="Calibri", size=10, bold=True, color="3730A3")

        ws.row_dimensions[row_idx].height = 20

    for col_idx, f_key in enumerate(valid_fields, start=1):
        col_letter = get_column_letter(col_idx)
        max_len = max(len(FIELD_LABELS[f_key]), 10)
        for row in range(2, min(len(items) + 2, 200)):
            val = ws.cell(row=row, column=col_idx).value
            if val:
                max_len = max(max_len, min(len(str(val)), 45))
        ws.column_dimensions[col_letter].width = max_len + 4

    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()

