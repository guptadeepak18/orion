from datetime import datetime, date, time, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, or_
from sqlalchemy.orm import selectinload, joinedload

from app.models.session import (
    Session,
    Timetable,
    TimetableRevision,
    StudentAttendance,
    HyperbuildActivity,
    HyperbuildActivityVerification,
)
from app.models.academic import Subject, Topic, Batch
from app.models.student import Student
from app.models.faculty import FacultyInternal, FacultyExternal
from app.schemas.session import (
    SessionCreate, SessionUpdate, SessionResponse, SessionBulkEditRequest,
    RawImportRow, TimetableImportPreviewResponse, TimetableCommitRequest,
    SessionAttendanceBulkRequest, SessionAttendanceSheetResponse, StudentAttendanceRecordResponse,
    SessionVarianceRecordRequest, TimetableVarianceSummaryResponse, TimetableVarianceItem,
)
from app.agents.scheduler_sentinel import scheduler_sentinel, SchedulerConflictException
from app.agents.faculty_compliance_agent import faculty_compliance_agent, FacultyComplianceException
from app.services.remuneration_service import process_completed_external_session
from app.services.email_template_service import trigger_activity_email
from sqlalchemy import func


async def get_next_lecture_number(db: AsyncSession, batch_id: UUID, subject_id: UUID) -> int:
    # 1. Query highest existing lecture_number for active sessions of this subject
    stmt_max = select(func.max(Session.lecture_number)).where(
        Session.batch_id == batch_id,
        Session.subject_id == subject_id,
        Session.is_deleted == False,
        Session.status != "cancelled",
    )
    res_max = await db.execute(stmt_max)
    max_num = res_max.scalar() or 0

    # 2. Query total active sessions count for this subject
    stmt_count = select(func.count(Session.id)).where(
        Session.batch_id == batch_id,
        Session.subject_id == subject_id,
        Session.is_deleted == False,
        Session.status != "cancelled",
    )
    res_count = await db.execute(stmt_count)
    session_count = res_count.scalar() or 0

    return max(max_num, session_count) + 1


async def create_session(db: AsyncSession, s_in: SessionCreate) -> Session:
    # 1. Faculty Agreement Compliance Check
    if s_in.faculty_type == "external" and s_in.faculty_external_id:
        await faculty_compliance_agent.validate_faculty_agreement(
            db, s_in.faculty_external_id, s_in.session_date
        )

    # 2. Synchronously validate with Scheduler Sentinel
    await scheduler_sentinel.validate_session_slot(
        db=db,
        session_date=s_in.session_date,
        start_time=s_in.start_time,
        end_time=s_in.end_time,
        venue=s_in.venue,
        faculty_type=s_in.faculty_type,
        faculty_internal_id=s_in.faculty_internal_id,
        faculty_external_id=s_in.faculty_external_id,
    )

    session_data = s_in.model_dump()
    if session_data.get("subject_id") and session_data.get("batch_id") and session_data.get("session_type") != "hyperbuild":
        if not session_data.get("lecture_number"):
            session_data["lecture_number"] = await get_next_lecture_number(db, session_data["batch_id"], session_data["subject_id"])

    session = Session(**session_data)
    db.add(session)
    await db.commit()
    # Trigger class_session_scheduled email notification
    try:
        subj_obj = (await db.execute(select(Subject).where(Subject.id == session.subject_id))).scalar_one_or_none() if session.subject_id else None
        subj_name = subj_obj.name if subj_obj else "Academic Session"
        fac_name = "Assigned Faculty"
        fac_email = None

        if session.faculty_type == "internal" and session.faculty_internal_id:
            fi = (await db.execute(select(FacultyInternal).where(FacultyInternal.id == session.faculty_internal_id))).scalar_one_or_none()
            if fi:
                fac_name = fi.full_name
                fac_email = fi.email
        elif session.faculty_type == "external" and session.faculty_external_id:
            fe = (await db.execute(select(FacultyExternal).where(FacultyExternal.id == session.faculty_external_id))).scalar_one_or_none()
            if fe:
                fac_name = fe.name
                fac_email = fe.email

        batch_name = "All Batches"
        if session.batch_id:
            b_obj = (await db.execute(select(Batch).where(Batch.id == session.batch_id))).scalar_one_or_none()
            if b_obj:
                batch_name = b_obj.name

        context = {
            "recipient_name": fac_name,
            "subject_name": subj_name,
            "faculty_name": fac_name,
            "session_date": str(session.session_date),
            "session_time": f"{session.start_time.strftime('%H:%M')} - {session.end_time.strftime('%H:%M')}" if (session.start_time and session.end_time) else "Scheduled Time",
            "venue": session.venue or "Campus Classroom",
            "batch_name": batch_name,
            "division_name": "",
            "app_name": "Orion Portal",
        }

        # Send to faculty if email exists
        if fac_email:
            await trigger_activity_email(
                db=db,
                event_key="class_session_scheduled",
                recipient_email=fac_email,
                context=context,
            )
    except Exception as e:
        logger.error(f"Error sending class_session_scheduled email: {e}")

    return session


async def update_session(db: AsyncSession, session_id: UUID, s_in: SessionUpdate) -> Session:
    stmt = select(Session).where(Session.id == session_id, Session.is_deleted == False)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    old_status = session.status
    update_data = s_in.model_dump(exclude_unset=True)

    # If date/time/venue/faculty changes, re-validate with Sentinel
    check_date = update_data.get("session_date", session.session_date)
    check_start = update_data.get("start_time", session.start_time)
    check_end = update_data.get("end_time", session.end_time)
    check_venue = update_data.get("venue", session.venue)
    check_f_type = update_data.get("faculty_type", session.faculty_type)
    check_f_int = update_data.get("faculty_internal_id", session.faculty_internal_id)
    check_f_ext = update_data.get("faculty_external_id", session.faculty_external_id)

    if any([
        check_date != session.session_date,
        check_start != session.start_time,
        check_end != session.end_time,
        check_venue != session.venue,
        check_f_type != session.faculty_type,
        check_f_int != session.faculty_internal_id,
        check_f_ext != session.faculty_external_id,
    ]):
        await scheduler_sentinel.validate_session_slot(
            db=db,
            session_date=check_date,
            start_time=check_start,
            end_time=check_end,
            venue=check_venue,
            faculty_type=check_f_type,
            faculty_internal_id=check_f_int,
            faculty_external_id=check_f_ext,
            exclude_session_id=session.id,
        )

    for field, value in update_data.items():
        setattr(session, field, value)

    await db.commit()
    await db.refresh(session)

    # Trigger cancellation email if status changed to cancelled
    if old_status != "cancelled" and session.status == "cancelled":
        try:
            subj_obj = (await db.execute(select(Subject).where(Subject.id == session.subject_id))).scalar_one_or_none() if session.subject_id else None
            subj_name = subj_obj.name if subj_obj else "Academic Session"
            fac_name = "Assigned Faculty"
            fac_email = None

            if session.faculty_type == "internal" and session.faculty_internal_id:
                fi = (await db.execute(select(FacultyInternal).where(FacultyInternal.id == session.faculty_internal_id))).scalar_one_or_none()
                if fi:
                    fac_name = fi.full_name
                    fac_email = fi.email
            elif session.faculty_type == "external" and session.faculty_external_id:
                fe = (await db.execute(select(FacultyExternal).where(FacultyExternal.id == session.faculty_external_id))).scalar_one_or_none()
                if fe:
                    fac_name = fe.name
                    fac_email = fe.email

            if fac_email:
                await trigger_activity_email(
                    db=db,
                    event_key="class_session_cancelled",
                    recipient_email=fac_email,
                    context={
                        "recipient_name": fac_name,
                        "subject_name": subj_name,
                        "faculty_name": fac_name,
                        "session_date": str(session.session_date),
                        "reason": "Administrative timetable adjustment",
                        "app_name": "Orion Portal",
                    },
                )
        except Exception as e:
            logger.error(f"Error sending class_session_cancelled email: {e}")

    if session.status == "completed" and session.faculty_type == "external":
        await process_completed_external_session(db, session)

    return session


async def delete_session(db: AsyncSession, session_id: UUID) -> bool:
    """
    Soft-deletes a scheduled session (admin only).
    If the session had marked attendance, recalculates batch student attendance automatically.
    """
    stmt = select(Session).where(Session.id == session_id, Session.is_deleted == False)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found or already deleted")

    session.is_deleted = True
    session.status = "cancelled"
    batch_id = session.batch_id
    was_marked = session.attendance_status == "marked"

    await db.commit()

    if was_marked and batch_id:
        await recalculate_batch_student_attendance(db, batch_id)

    return True


async def format_single_session_response(db: AsyncSession, session_id: UUID) -> SessionResponse:
    stmt = (
        select(Session)
        .options(
            joinedload(Session.subject),
            joinedload(Session.topic),
            joinedload(Session.faculty_internal),
            joinedload(Session.faculty_external),
            joinedload(Session.original_subject),
            joinedload(Session.original_faculty_internal),
            joinedload(Session.original_faculty_external),
            joinedload(Session.program),
            joinedload(Session.batch),
            selectinload(Session.hyperbuild_activities).joinedload(HyperbuildActivity.subject),
        )
        .where(Session.id == session_id, Session.is_deleted == False)
    )
    res = await db.execute(stmt)
    s = res.unique().scalar_one_or_none()
    if not s:
        raise ValueError("Session not found")

    r = SessionResponse.model_validate(s)
    if s.subject:
        r.subject_name = s.subject.name
        r.subject_code = s.subject.code
    if s.topic:
        r.topic_name = s.topic.name
    if s.faculty_type == "internal" and s.faculty_internal:
        r.faculty_name = s.faculty_internal.full_name or s.faculty_internal.email.split("@")[0]
    elif s.faculty_type == "external" and s.faculty_external:
        r.faculty_name = s.faculty_external.name
    if s.original_subject:
        r.original_subject_name = s.original_subject.name
        r.original_subject_code = s.original_subject.code
    if s.original_faculty_type == "internal" and s.original_faculty_internal:
        r.original_faculty_name = s.original_faculty_internal.full_name or s.original_faculty_internal.email.split("@")[0]
    elif s.original_faculty_type == "external" and s.original_faculty_external:
        r.original_faculty_name = s.original_faculty_external.name
    if s.program:
        r.program_name = s.program.name
    if s.batch:
        r.batch_name = s.batch.name
    if s.session_type == "hyperbuild" and getattr(s, "hyperbuild_activities", None):
        r.hyperbuild_activities = [
            {
                "id": str(act.id),
                "activity_no": act.activity_no,
                "title": act.title,
                "start_time": act.start_time.strftime("%H:%M") if hasattr(act.start_time, "strftime") else str(act.start_time)[:5],
                "end_time": act.end_time.strftime("%H:%M") if hasattr(act.end_time, "strftime") else str(act.end_time)[:5],
                "subject_id": str(act.subject_id) if act.subject_id else None,
                "subject_name": act.subject.name if act.subject else None,
                "subject_code": act.subject.code if act.subject else None,
                "duration_minutes": act.duration_minutes,
                "submission_type": act.submission_type,
                "status": act.status,
            }
            for act in s.hyperbuild_activities
            if not getattr(act, "is_deleted", False)
        ]
    else:
        r.hyperbuild_activities = []
    return r


async def list_sessions(
    db: AsyncSession,
    batch_id: Optional[UUID] = None,
    session_date: Optional[date] = None,
    status: Optional[str] = None
) -> List[SessionResponse]:
    stmt = (
        select(Session)
        .options(
            joinedload(Session.subject),
            joinedload(Session.topic),
            joinedload(Session.faculty_internal),
            joinedload(Session.faculty_external),
            joinedload(Session.original_subject),
            joinedload(Session.original_faculty_internal),
            joinedload(Session.original_faculty_external),
            joinedload(Session.program),
            joinedload(Session.batch),
            selectinload(Session.hyperbuild_activities).joinedload(HyperbuildActivity.subject),
        )
        .where(Session.is_deleted == False)
    )
    if batch_id:
        stmt = stmt.where(Session.batch_id == batch_id)
    if session_date:
        stmt = stmt.where(Session.session_date == session_date)
    if status:
        stmt = stmt.where(Session.status == status)

    stmt = stmt.order_by(Session.session_date, Session.start_time)
    res = await db.execute(stmt)
    sessions = list(res.unique().scalars().all())

    results: List[SessionResponse] = []
    running_counts: dict = {}
    for s in sessions:
        r = SessionResponse.model_validate(s)
        if s.subject_id and s.session_type != "hyperbuild":
            key = (s.batch_id, s.subject_id)
            if s.lecture_number:
                running_counts[key] = max(running_counts.get(key, 0), s.lecture_number)
            else:
                next_val = running_counts.get(key, 0) + 1
                running_counts[key] = next_val
                r.lecture_number = next_val
        if s.subject:
            r.subject_name = s.subject.name
            r.subject_code = s.subject.code
        if s.topic:
            r.topic_name = s.topic.name
        if s.faculty_type == "internal" and s.faculty_internal:
            r.faculty_name = s.faculty_internal.full_name or s.faculty_internal.email.split("@")[0]
        elif s.faculty_type == "external" and s.faculty_external:
            r.faculty_name = s.faculty_external.name
        if s.original_subject:
            r.original_subject_name = s.original_subject.name
            r.original_subject_code = s.original_subject.code
        if s.original_faculty_type == "internal" and s.original_faculty_internal:
            r.original_faculty_name = s.original_faculty_internal.full_name or s.original_faculty_internal.email.split("@")[0]
        elif s.original_faculty_type == "external" and s.original_faculty_external:
            r.original_faculty_name = s.original_faculty_external.name
        if s.program:
            r.program_name = s.program.name
        if s.batch:
            r.batch_name = s.batch.name
        if s.session_type == "hyperbuild" and s.hyperbuild_activities:
            r.hyperbuild_activities = [
                {
                    "id": str(act.id),
                    "activity_no": act.activity_no,
                    "title": act.title,
                    "start_time": act.start_time.strftime("%H:%M") if hasattr(act.start_time, "strftime") else str(act.start_time)[:5],
                    "end_time": act.end_time.strftime("%H:%M") if hasattr(act.end_time, "strftime") else str(act.end_time)[:5],
                    "subject_id": str(act.subject_id) if act.subject_id else None,
                    "subject_name": act.subject.name if act.subject else None,
                    "subject_code": act.subject.code if act.subject else None,
                    "duration_minutes": act.duration_minutes,
                    "submission_type": act.submission_type,
                    "status": act.status,
                }
                for act in s.hyperbuild_activities
                if not getattr(act, "is_deleted", False)
            ]
        results.append(r)
    return results


async def record_session_variance(
    db: AsyncSession,
    session_id: UUID,
    req: SessionVarianceRecordRequest,
    current_user_id: Optional[UUID] = None,
) -> SessionResponse:
    stmt = (
        select(Session)
        .options(
            selectinload(Session.subject),
            selectinload(Session.topic),
            selectinload(Session.faculty_internal),
            selectinload(Session.faculty_external),
            selectinload(Session.original_subject),
            selectinload(Session.original_faculty_internal),
            selectinload(Session.original_faculty_external),
            selectinload(Session.program),
            selectinload(Session.batch),
        )
        .where(Session.id == session_id, Session.is_deleted == False)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    now_utc = datetime.now(timezone.utc)

    # Initialize original baseline snapshot if not already captured
    if session.original_subject_id is None:
        session.original_subject_id = session.subject_id
    if session.original_faculty_type is None:
        session.original_faculty_type = session.faculty_type
    if session.original_faculty_internal_id is None and session.faculty_type == "internal":
        session.original_faculty_internal_id = session.faculty_internal_id
    if session.original_faculty_external_id is None and session.faculty_type == "external":
        session.original_faculty_external_id = session.faculty_external_id
    if session.original_venue is None:
        session.original_venue = session.venue

    # Validate slot with Sentinel if alternate faculty or venue is introduced
    if req.variance_type in ["faculty_substitution", "subject_swapped"]:
        check_f_type = req.substitute_faculty_type or session.faculty_type
        check_f_int = req.substitute_faculty_internal_id
        check_f_ext = req.substitute_faculty_external_id
        check_venue = req.new_venue or session.venue

        await scheduler_sentinel.validate_session_slot(
            db=db,
            session_date=session.session_date,
            start_time=session.start_time,
            end_time=session.end_time,
            venue=check_venue,
            faculty_type=check_f_type,
            faculty_internal_id=check_f_int,
            faculty_external_id=check_f_ext,
            exclude_session_id=session.id,
        )

    # History audit item
    history_item = {
        "timestamp": now_utc.isoformat(),
        "recorded_by": str(current_user_id) if current_user_id else "System Admin",
        "action": req.variance_type,
        "reason": req.reason,
        "previous_subject_id": str(session.subject_id),
        "previous_faculty_type": session.faculty_type,
        "previous_faculty_internal_id": str(session.faculty_internal_id) if session.faculty_internal_id else None,
        "previous_faculty_external_id": str(session.faculty_external_id) if session.faculty_external_id else None,
    }

    curr_history = session.variance_history.get("entries", []) if (session.variance_history and isinstance(session.variance_history, dict)) else []
    curr_history.append(history_item)
    session.variance_history = {"entries": curr_history}

    session.variance_recorded_by_id = current_user_id
    session.variance_recorded_at = now_utc
    session.variance_reason = req.reason

    if req.variance_type == "revert_as_planned":
        # Restore to initial baseline
        if session.original_subject_id:
            session.subject_id = session.original_subject_id
        if session.original_faculty_type:
            session.faculty_type = session.original_faculty_type
        session.faculty_internal_id = session.original_faculty_internal_id
        session.faculty_external_id = session.original_faculty_external_id
        if session.original_venue:
            session.venue = session.original_venue
        session.variance_status = "as_planned"
        session.variance_reason = None
        if session.status == "cancelled":
            session.status = "scheduled"

    elif req.variance_type == "faculty_substitution":
        session.variance_status = "faculty_substituted"
        if req.substitute_faculty_type:
            session.faculty_type = req.substitute_faculty_type
        session.faculty_internal_id = req.substitute_faculty_internal_id
        session.faculty_external_id = req.substitute_faculty_external_id
        if req.new_venue:
            session.venue = req.new_venue

    elif req.variance_type == "subject_swapped":
        session.variance_status = "subject_swapped"
        if req.swapped_subject_id:
            session.subject_id = req.swapped_subject_id
        if req.swapped_topic_id is not None:
            session.topic_id = req.swapped_topic_id
        if req.substitute_faculty_type:
            session.faculty_type = req.substitute_faculty_type
        session.faculty_internal_id = req.substitute_faculty_internal_id
        session.faculty_external_id = req.substitute_faculty_external_id
        if req.new_venue:
            session.venue = req.new_venue

    elif req.variance_type == "cancelled":
        session.variance_status = "cancelled"
        session.status = "cancelled"

    elif req.variance_type == "rescheduled":
        session.variance_status = "rescheduled"
        session.status = "cancelled"

    await db.commit()
    await db.refresh(session)
    return await format_single_session_response(db, session.id)


async def get_timetable_variance_analytics(
    db: AsyncSession,
    program_id: Optional[UUID] = None,
    batch_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    subject_id: Optional[UUID] = None,
    faculty_id: Optional[UUID] = None,
) -> TimetableVarianceSummaryResponse:
    stmt = (
        select(Session)
        .options(
            selectinload(Session.subject),
            selectinload(Session.original_subject),
            selectinload(Session.faculty_internal),
            selectinload(Session.faculty_external),
            selectinload(Session.original_faculty_internal),
            selectinload(Session.original_faculty_external),
            selectinload(Session.program),
            selectinload(Session.batch),
        )
        .where(Session.is_deleted == False)
    )
    if program_id:
        stmt = stmt.where(Session.program_id == program_id)
    if batch_id:
        stmt = stmt.where(Session.batch_id == batch_id)
    if start_date:
        stmt = stmt.where(Session.session_date >= start_date)
    if end_date:
        stmt = stmt.where(Session.session_date <= end_date)
    if subject_id:
        stmt = stmt.where(
            or_(
                Session.subject_id == subject_id,
                Session.original_subject_id == subject_id,
            )
        )

    stmt = stmt.order_by(Session.session_date.desc(), Session.start_time.desc())
    res = await db.execute(stmt)
    sessions = list(res.scalars().all())

    total_planned = len(sessions)
    conducted_as_planned = 0
    faculty_substituted = 0
    subject_swapped = 0
    cancelled = 0
    rescheduled = 0
    reasons_dist: Dict[str, int] = {}

    items: List[TimetableVarianceItem] = []

    for s in sessions:
        v_status = s.variance_status or "as_planned"
        v_reason = s.variance_reason

        is_adherent = v_status == "as_planned"
        if is_adherent:
            conducted_as_planned += 1
        elif v_status == "faculty_substituted":
            faculty_substituted += 1
        elif v_status == "subject_swapped":
            subject_swapped += 1
        elif v_status == "cancelled":
            cancelled += 1
        elif v_status == "rescheduled":
            rescheduled += 1

        if v_reason:
            clean_reason = v_reason.strip()
            reasons_dist[clean_reason] = reasons_dist.get(clean_reason, 0) + 1

        # Planned Subject & Faculty
        plan_sub_name = s.original_subject.name if s.original_subject else (s.subject.name if s.subject else "Scheduled Subject")
        plan_sub_code = s.original_subject.code if s.original_subject else (s.subject.code if s.subject else None)

        plan_fac_name = "Assigned Faculty"
        plan_fac_type = s.original_faculty_type or s.faculty_type or "internal"
        if s.original_faculty_type == "internal" and s.original_faculty_internal:
            plan_fac_name = s.original_faculty_internal.full_name or "Internal Faculty"
        elif s.original_faculty_type == "external" and s.original_faculty_external:
            plan_fac_name = s.original_faculty_external.name or "Visiting Faculty"
        elif s.faculty_type == "internal" and s.faculty_internal:
            plan_fac_name = s.faculty_internal.full_name or "Internal Faculty"
        elif s.faculty_type == "external" and s.faculty_external:
            plan_fac_name = s.faculty_external.name or "Visiting Faculty"

        # Actual Subject & Faculty
        act_sub_name = s.subject.name if s.subject else "Conducted Subject"
        act_sub_code = s.subject.code if s.subject else None

        act_fac_name = "Assigned Faculty"
        act_fac_type = s.faculty_type or "internal"
        if s.faculty_type == "internal" and s.faculty_internal:
            act_fac_name = s.faculty_internal.full_name or "Internal Faculty"
        elif s.faculty_type == "external" and s.faculty_external:
            act_fac_name = s.faculty_external.name or "Visiting Faculty"

        items.append(
            TimetableVarianceItem(
                session_id=s.id,
                session_date=s.session_date,
                start_time=s.start_time.strftime("%H:%M") if s.start_time else "",
                end_time=s.end_time.strftime("%H:%M") if s.end_time else "",
                venue=s.venue,
                program_name=s.program.name if s.program else None,
                batch_name=s.batch.name if s.batch else None,
                planned_subject_name=plan_sub_name,
                planned_subject_code=plan_sub_code,
                planned_faculty_name=plan_fac_name,
                planned_faculty_type=plan_fac_type,
                actual_subject_name=act_sub_name,
                actual_subject_code=act_sub_code,
                actual_faculty_name=act_fac_name,
                actual_faculty_type=act_fac_type,
                status=s.status,
                variance_status=v_status,
                variance_reason=v_reason,
                variance_recorded_at=s.variance_recorded_at,
                is_adherent=is_adherent,
            )
        )

    adherence_pct = round((conducted_as_planned / total_planned * 100.0), 1) if total_planned > 0 else 100.0

    return TimetableVarianceSummaryResponse(
        total_planned_sessions=total_planned,
        conducted_as_planned=conducted_as_planned,
        faculty_substituted=faculty_substituted,
        subject_swapped=subject_swapped,
        cancelled_sessions=cancelled,
        rescheduled_sessions=rescheduled,
        adherence_percentage=adherence_pct,
        reasons_distribution=reasons_dist,
        sessions_breakdown=items,
    )



async def bulk_edit_sessions(db: AsyncSession, req: SessionBulkEditRequest) -> int:
    update_dict = {}
    if req.session_date:
        update_dict["session_date"] = req.session_date
    if req.venue:
        update_dict["venue"] = req.venue
    if req.mode:
        update_dict["mode"] = req.mode
    if req.status:
        update_dict["status"] = req.status

    if not update_dict:
        return 0

    stmt = (
        update(Session)
        .where(Session.id.in_(req.session_ids), Session.is_deleted == False)
        .values(**update_dict)
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount


async def preview_timetable_import(
    db: AsyncSession, batch_id: UUID, raw_rows: List[RawImportRow]
) -> TimetableImportPreviewResponse:
    valid_rows = []
    conflicts = []
    unmapped_subjects = set()
    unmapped_faculty = set()

    for idx, row in enumerate(raw_rows, start=1):
        # Resolve subject
        sub_res = await db.execute(select(Subject).where(Subject.code == row.subject_code, Subject.batch_id == batch_id))
        subject = sub_res.scalar_one_or_none()
        if not subject:
            unmapped_subjects.add(row.subject_code)

        # Resolve faculty
        if row.faculty_type == "internal":
            f_res = await db.execute(select(FacultyInternal).where(FacultyInternal.email == row.faculty_email))
            faculty = f_res.scalar_one_or_none()
        else:
            f_res = await db.execute(select(FacultyExternal).where(FacultyExternal.email == row.faculty_email))
            faculty = f_res.scalar_one_or_none()

        if not faculty:
            unmapped_faculty.add(row.faculty_email)

        # Parse times
        try:
            s_date = datetime.strptime(row.session_date, "%Y-%m-%d").date()
            s_time = datetime.strptime(row.start_time, "%H:%M").time()
            e_time = datetime.strptime(row.end_time, "%H:%M").time()

            # Sentinel check for conflicts
            await scheduler_sentinel.validate_session_slot(
                db=db,
                session_date=s_date,
                start_time=s_time,
                end_time=e_time,
                venue=row.venue,
                faculty_type=row.faculty_type,
                faculty_internal_id=faculty.id if row.faculty_type == "internal" and faculty else None,
                faculty_external_id=faculty.id if row.faculty_type == "external" and faculty else None,
            )
            valid_rows.append(row)
        except SchedulerConflictException as ce:
            conflicts.append({
                "row_number": idx,
                "reason": ce.message,
                "type": ce.conflict_type,
                "alternates": ce.alternate_slots
            })
        except Exception as ex:
            conflicts.append({"row_number": idx, "reason": str(ex), "type": "invalid_format"})

    return TimetableImportPreviewResponse(
        total_rows=len(raw_rows),
        valid_rows=valid_rows,
        conflicts=conflicts,
        unmapped_subjects=list(unmapped_subjects),
        unmapped_faculty=list(unmapped_faculty)
    )


async def commit_timetable_import(
    db: AsyncSession, user_id: UUID, req: TimetableCommitRequest
) -> Timetable:
    batch_res = await db.execute(select(Batch).where(Batch.id == req.batch_id))
    batch = batch_res.scalar_one()

    # Create Timetable record
    timetable = Timetable(
        batch_id=req.batch_id,
        term_label=req.term_label,
        source="upload_csv",
        status="published",
        created_by=user_id
    )
    db.add(timetable)
    await db.flush()

    # Create TimetableRevision
    revision = TimetableRevision(
        timetable_id=timetable.id,
        revision_no=1,
        diff_summary={"created_rows": len(req.valid_rows)},
        created_by=user_id
    )
    db.add(revision)

    # Create Sessions
    for row in req.valid_rows:
        s_date = datetime.strptime(row.session_date, "%Y-%m-%d").date()
        s_time = datetime.strptime(row.start_time, "%H:%M").time()
        e_time = datetime.strptime(row.end_time, "%H:%M").time()

        sub_res = await db.execute(select(Subject).where(Subject.code == row.subject_code, Subject.batch_id == req.batch_id))
        subject = sub_res.scalar_one()

        fac_int_id = None
        fac_ext_id = None
        if row.faculty_type == "internal":
            f_res = await db.execute(select(FacultyInternal).where(FacultyInternal.email == row.faculty_email))
            fac_int_id = f_res.scalar_one().id
        else:
            f_res = await db.execute(select(FacultyExternal).where(FacultyExternal.email == row.faculty_email))
            fac_ext_id = f_res.scalar_one().id

        dur_mins = int((datetime.combine(s_date, e_time) - datetime.combine(s_date, s_time)).total_seconds() / 60)

        session = Session(
            timetable_id=timetable.id,
            program_id=batch.program_id,
            batch_id=req.batch_id,
            semester_id=batch.semester_id,
            subject_id=subject.id,
            session_date=s_date,
            start_time=s_time,
            end_time=e_time,
            faculty_type=row.faculty_type,
            faculty_internal_id=fac_int_id,
            faculty_external_id=fac_ext_id,
            venue=row.venue,
            mode=row.mode,
            duration_minutes=dur_mins,
            status="scheduled"
        )
        db.add(session)

    await db.commit()
    await db.refresh(timetable)
    return timetable


async def get_session_by_id(db: AsyncSession, session_id: UUID) -> Optional[Session]:
    stmt = (
        select(Session)
        .options(
            joinedload(Session.batch),
            joinedload(Session.subject),
            joinedload(Session.program),
            joinedload(Session.topic),
            joinedload(Session.faculty_internal),
            joinedload(Session.faculty_external),
            selectinload(Session.hyperbuild_activities).joinedload(HyperbuildActivity.subject),
        )
        .where(Session.id == session_id, Session.is_deleted == False)
    )
    res = await db.execute(stmt)
    return res.unique().scalar_one_or_none()


def normalize_specialization_domain(domain_str: Optional[str]) -> str:
    """
    Normalizes specialization and elective domain strings into standard keys:
    - 'marketing'
    - 'finance'
    - 'human_resources'
    - 'research_and_business_analytics'
    """
    if not domain_str:
        return ""
    d = domain_str.strip().lower()
    d = d.replace("&", "and").replace("-", " ").replace("_", " ")

    if "market" in d or d == "mkt":
        return "marketing"
    if "finan" in d or d == "fin":
        return "finance"
    if "human" in d or "hr" in d or "resource" in d:
        return "human_resources"
    if "analytic" in d or "rba" in d or "research" in d or "business analytic" in d or "data" in d:
        return "research_and_business_analytics"

    return d.replace(" ", "_")


def is_student_eligible_for_subject(
    subject: Optional[Subject],
    student: Student,
) -> bool:
    """
    Core subjects are applicable for all students in the batch/division.
    Elective subjects are only applicable if subject's elective_domain matches
    either the student's major_specialization OR minor_specialization.
    """
    if not subject:
        return True

    cat = (subject.course_category or "").strip().lower()
    if cat != "elective":
        # It's Core (or unassigned/mandatory) -> Applicable to ALL students
        return True

    # It's Elective
    sub_domain_raw = subject.elective_domain or ""
    if not sub_domain_raw.strip():
        # If marked elective without specific domain, default to eligible
        return True

    sub_norm = normalize_specialization_domain(sub_domain_raw)
    major_norm = normalize_specialization_domain(student.specialization_major)
    minor_norm = normalize_specialization_domain(student.specialization_minor)

    return sub_norm in (major_norm, minor_norm)


async def get_session_attendance_sheet(db: AsyncSession, session_id: UUID) -> SessionAttendanceSheetResponse:
    session = await get_session_by_id(db, session_id)
    if not session:
        raise ValueError("Session not found")

    # Fetch all students belonging to the batch
    students_stmt = (
        select(Student)
        .where(Student.batch_id == session.batch_id, Student.is_deleted == False)
        .order_by(Student.roll_no, Student.prn_number, Student.full_name)
    )
    st_res = await db.execute(students_stmt)
    all_students = list(st_res.scalars().all())

    # Reconcile / filter students eligible for this session's subject (Core vs Elective domain)
    eligible_students = [
        st for st in all_students
        if is_student_eligible_for_subject(session.subject, st)
    ]

    # Fetch existing attendance records for this session
    att_stmt = select(StudentAttendance).where(StudentAttendance.session_id == session_id)
    att_res = await db.execute(att_stmt)
    existing_records = {att.student_id: att for att in att_res.scalars().all()}

    student_records: List[StudentAttendanceRecordResponse] = []
    present_count = 0
    absent_count = 0

    for st in eligible_students:
        existing = existing_records.get(st.id)
        current_status = existing.status if existing else "present"
        if current_status in ("present", "late", "excused", "leave_approved", "od_duty", "on_duty", "on duty"):
            present_count += 1
        elif current_status == "absent":
            absent_count += 1

        # Format specialization badge text
        spec_parts = []
        if st.specialization_major:
            spec_parts.append(f"Major: {st.specialization_major}")
        if st.specialization_minor:
            spec_parts.append(f"Minor: {st.specialization_minor}")
        spec_text = " • ".join(spec_parts) if spec_parts else None

        student_records.append(
            StudentAttendanceRecordResponse(
                id=existing.id if existing else None,
                session_id=session.id,
                student_id=st.id,
                student_name=st.full_name or f"{st.first_name} {st.last_name or ''}".strip(),
                student_prn=st.prn_number or st.roll_no or "",
                status=current_status,
                remarks=existing.remarks if existing else None,
                session_date=session.session_date,
                subject_name=session.subject.name if session.subject else None,
                venue=session.venue,
                specialization_major=st.specialization_major,
                specialization_minor=st.specialization_minor,
                specializations=spec_text,
            )
        )

    return SessionAttendanceSheetResponse(
        session_id=session.id,
        batch_id=session.batch_id,
        batch_name=session.batch.name if session.batch else None,
        subject_name=session.subject.name if session.subject else ("HyperBuild Session" if session.session_type == "hyperbuild" else "Class Session"),
        subject_code=session.subject.code if session.subject else ("HB" if session.session_type == "hyperbuild" else "SUB"),
        course_category=session.subject.course_category if session.subject else "core",
        elective_domain=session.subject.elective_domain if session.subject else None,
        session_type=session.session_type,
        session_date=session.session_date,
        start_time=session.start_time,
        end_time=session.end_time,
        venue=session.venue,
        status=session.status,
        attendance_status=session.attendance_status or ("marked" if existing_records else "pending"),
        total_students=len(eligible_students),
        present_count=present_count,
        absent_count=absent_count,
        students=student_records,
    )


async def recalculate_batch_student_attendance(db: AsyncSession, batch_id: UUID):
    """
    Recalculates and updates attendance_percentage for all students in a given batch
    based on all marked class session attendances, strictly reconciling Core vs. Elective eligibility.
    """
    # Find all marked sessions for this batch with their subjects and activities preloaded
    marked_sessions_stmt = (
        select(Session)
        .options(
            selectinload(Session.subject),
            selectinload(Session.hyperbuild_activities).selectinload(HyperbuildActivity.subject),
        )
        .where(
            Session.batch_id == batch_id,
            Session.is_deleted == False,
            Session.attendance_status == "marked"
        )
    )
    res = await db.execute(marked_sessions_stmt)
    all_marked_sessions = list(res.scalars().all())

    # Get all active students for this batch
    students_stmt = select(Student).where(Student.batch_id == batch_id, Student.is_deleted == False)
    st_res = await db.execute(students_stmt)
    students = list(st_res.scalars().all())

    PRESENT_STATUSES = ["present", "late", "excused", "leave_approved", "od_duty", "on_duty", "on duty"]

    # Preload all attendance records for these marked sessions
    marked_session_ids = [s.id for s in all_marked_sessions]
    att_by_student: Dict[UUID, Dict[UUID, str]] = {st.id: {} for st in students}
    if marked_session_ids:
        att_stmt = select(StudentAttendance).where(StudentAttendance.session_id.in_(marked_session_ids))
        att_res = await db.execute(att_stmt)
        for att in att_res.scalars().all():
            if att.student_id in att_by_student:
                att_by_student[att.student_id][att.session_id] = att.status

    # Preload all HyperBuild activity verifications for these marked sessions
    verifs_by_student_act: Dict[Tuple[UUID, UUID], str] = {}
    if marked_session_ids:
        v_stmt = select(
            HyperbuildActivityVerification.student_id,
            HyperbuildActivityVerification.activity_id,
            HyperbuildActivityVerification.verification_status,
        ).where(HyperbuildActivityVerification.session_id.in_(marked_session_ids))
        v_res = await db.execute(v_stmt)
        for st_id, act_id, v_st in v_res.all():
            verifs_by_student_act[(st_id, act_id)] = v_st

    for student in students:
        total_eligible = 0
        attended_count = 0
        student_records = att_by_student.get(student.id, {})

        for s in all_marked_sessions:
            if s.hyperbuild_activities and len(s.hyperbuild_activities) > 0:
                for act in s.hyperbuild_activities:
                    # Only conducted activities
                    is_conducted = (act.status in ["active", "closed"]) or (act.challenge_key is not None) or ((student.id, act.id) in verifs_by_student_act)
                    if not is_conducted:
                        continue
                    if not act.subject or not is_student_eligible_for_subject(act.subject, student):
                        continue

                    total_eligible += 1
                    v_st = verifs_by_student_act.get((student.id, act.id))
                    if v_st and v_st in ["verified_present", "late_submission", "present"]:
                        attended_count += 1
                    elif not v_st:
                        parent_st = student_records.get(s.id)
                        if parent_st and parent_st in PRESENT_STATUSES:
                            attended_count += 1
            else:
                if not is_student_eligible_for_subject(s.subject, student):
                    continue
                total_eligible += 1
                st_status = student_records.get(s.id)
                if st_status and st_status in PRESENT_STATUSES:
                    attended_count += 1

        if total_eligible == 0:
            student.attendance_percentage = 100.0
            continue

        pct = round((attended_count / total_eligible) * 100.0, 2)
        student.attendance_percentage = pct

    await db.commit()


async def mark_session_attendance(
    db: AsyncSession,
    session_id: UUID,
    req: SessionAttendanceBulkRequest,
    current_user_id: Optional[UUID] = None,
) -> SessionAttendanceSheetResponse:
    session = await get_session_by_id(db, session_id)
    if not session:
        raise ValueError("Session not found")

    # Fetch existing records
    att_stmt = select(StudentAttendance).where(StudentAttendance.session_id == session_id)
    att_res = await db.execute(att_stmt)
    existing_map = {att.student_id: att for att in att_res.scalars().all()}

    for item in req.attendances:
        if item.student_id in existing_map:
            existing = existing_map[item.student_id]
            existing.status = item.status
            existing.remarks = item.remarks
            if current_user_id:
                existing.marked_by = current_user_id
        else:
            new_att = StudentAttendance(
                session_id=session.id,
                student_id=item.student_id,
                status=item.status,
                remarks=item.remarks,
                marked_by=current_user_id,
            )
            db.add(new_att)

    session.attendance_status = "marked"
    if session.status == "scheduled":
        session.status = "completed"

    await db.commit()

    if session.faculty_type == "external":
        await process_completed_external_session(db, session)

    # Recalculate automatic attendance percentage for all students in this batch
    await recalculate_batch_student_attendance(db, session.batch_id)

    return await get_session_attendance_sheet(db, session_id)


async def get_student_attendance_history(
    db: AsyncSession, student_id: UUID
) -> List[StudentAttendanceRecordResponse]:
    student_stmt = select(Student).where(Student.id == student_id, Student.is_deleted == False)
    st_res = await db.execute(student_stmt)
    student = st_res.scalar_one_or_none()
    if not student:
        raise ValueError("Student not found")

    stmt = (
        select(StudentAttendance)
        .options(
            selectinload(StudentAttendance.session).selectinload(Session.subject)
        )
        .where(StudentAttendance.student_id == student_id)
        .order_by(StudentAttendance.created_at.desc())
    )
    res = await db.execute(stmt)
    records = list(res.scalars().all())

    output: List[StudentAttendanceRecordResponse] = []
    for r in records:
        output.append(
            StudentAttendanceRecordResponse(
                id=r.id,
                session_id=r.session_id,
                student_id=r.student_id,
                student_name=student.full_name or f"{student.first_name} {student.last_name or ''}".strip(),
                student_prn=student.prn_number or student.roll_no or "",
                status=r.status,
                remarks=r.remarks,
                session_date=r.session.session_date if r.session else None,
                subject_name=r.session.subject.name if (r.session and r.session.subject) else None,
                venue=r.session.venue if r.session else None,
            )
        )

    return output

