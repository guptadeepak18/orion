import uuid
from datetime import datetime, timezone, date, time
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy import select, and_, or_, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.academic import Program, Batch, Subject, SubjectBatch
from app.models.faculty import FacultyInternal, FacultyExternal
from app.models.session import Session, StudentAttendance, AttendanceCorrectionRequest
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
from app.services.session_service import recalculate_batch_student_attendance, get_session_attendance_sheet


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
        return fi.id, "internal"

    # Check FacultyExternal
    fe_stmt = select(FacultyExternal).where(
        or_(FacultyExternal.user_id == user_id, FacultyExternal.email.ilike(user.email))
    )
    fe_res = await db.execute(fe_stmt)
    fe = fe_res.scalar_one_or_none()
    if fe:
        return fe.id, "external"

    return None, None


async def get_allocated_sessions_for_user(
    db: AsyncSession,
    user_id: UUID,
    user_roles: List[str],
    date_filter: Optional[date] = None,
    subject_id: Optional[UUID] = None,
    batch_id: Optional[UUID] = None,
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
        query = query.where(Session.batch_id == batch_id)

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

        output.append({
            "id": s.id,
            "session_date": s.session_date,
            "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
            "end_time": s.end_time.strftime("%H:%M") if s.end_time else "",
            "program_name": s.program.name if s.program else None,
            "batch_id": s.batch_id,
            "batch_name": s.batch.name if s.batch else None,
            "subject_id": s.subject_id,
            "subject_name": s.subject.name if s.subject else None,
            "subject_code": s.subject.code if s.subject else None,
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

    now_utc = datetime.now(timezone.utc)

    for item in req.attendances:
        if item.student_id in existing_records:
            existing = existing_records[item.student_id]
            existing.status = item.status
            existing.remarks = item.remarks
            existing.marked_by = current_user_id
            existing.is_locked = True
            existing.locked_at = now_utc
            existing.locked_by = current_user_id
        else:
            new_att = StudentAttendance(
                session_id=session.id,
                student_id=item.student_id,
                status=item.status,
                remarks=item.remarks,
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

    # Recalculate automatic attendance percentage for all students in this batch
    await recalculate_batch_student_attendance(db, session.batch_id)

    return await get_session_attendance_sheet(db, session_id)


async def get_subject_wise_attendance(
    db: AsyncSession,
    subject_id: UUID,
    batch_id: Optional[UUID] = None,
) -> SubjectAttendanceSummaryResponse:
    """
    Calculates overall course attendance analytics, session list, and student roster matrix.
    """
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

    # Determine batch IDs
    relevant_batch_ids = list(set([s.batch_id for s in all_sessions]))
    if not relevant_batch_ids and subject.batch_allocations:
        relevant_batch_ids = [ba.batch_id for ba in subject.batch_allocations]

    # Fetch students for these batches
    students: List[Student] = []
    if relevant_batch_ids:
        st_stmt = (
            select(Student)
            .where(Student.batch_id.in_(relevant_batch_ids), Student.is_deleted == False)
            .order_by(Student.roll_no, Student.prn_number, Student.full_name)
        )
        st_res = await db.execute(st_stmt)
        students = list(st_res.scalars().all())

    # Preload all attendance records for conducted sessions of this subject
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

    # Compute students summary
    students_summary: List[SubjectStudentAttendanceItem] = []
    sum_percentages = 0.0

    for st in students:
        counts = student_att_counts.get(st.id, {"present": 0, "absent": 0, "excused": 0})
        # Present, Excused, and On-Duty count towards presence / attended classes
        attended = counts["present"] + counts["excused"]
        absent = counts["absent"]
        excused = counts["excused"]

        pct = round((attended / total_conducted * 100.0), 1) if total_conducted > 0 else 100.0
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

    class_avg_pct = round(sum_percentages / len(students), 1) if students else 100.0

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
                    start_time=sess.start_time.strftime("%H:%M") if sess.start_time else "",
                    end_time=sess.end_time.strftime("%H:%M") if sess.end_time else "",
                    topic_delivered=sess.notes or (sess.topic.name if sess.topic else None),
                    venue=sess.venue,
                    faculty_name=fac_name,
                    attendance_status=sess.attendance_status or "marked",
                    is_locked=stt["is_locked"],
                    present_count=stt["present"],
                    absent_count=stt["absent"],
                    total_students=stt["total"],
                )
            )

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
        )
        .where(StudentAttendance.student_id == student_id)
        .order_by(StudentAttendance.created_at.desc())
    )
    att_res = await db.execute(att_stmt)
    records = list(att_res.scalars().all())

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
        if not r.session or not r.session.subject:
            continue

        sess = r.session
        sub = sess.subject
        total_classes += 1

        is_attended = r.status in PRESENT_STATUSES
        if is_attended:
            attended_classes += 1

        # Subject breakdown aggregation
        if sub.id not in subjects_map:
            subjects_map[sub.id] = {
                "id": sub.id,
                "name": sub.name,
                "code": sub.code or sub.course_code,
                "total": 0,
                "attended": 0,
                "absent": 0,
                "excused": 0,
            }

        subjects_map[sub.id]["total"] += 1
        if is_attended:
            subjects_map[sub.id]["attended"] += 1
        elif r.status == "absent":
            subjects_map[sub.id]["absent"] += 1
        else:
            subjects_map[sub.id]["excused"] += 1

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
                subject_id=sub.id,
                subject_name=sub.name,
                subject_code=sub.code or sub.course_code,
                faculty_name=fac_name,
                session_date=sess.session_date,
                start_time=sess.start_time.strftime("%H:%M") if sess.start_time else "",
                end_time=sess.end_time.strftime("%H:%M") if sess.end_time else "",
                venue=sess.venue,
                status=r.status,
                remarks=r.remarks,
                is_locked=r.is_locked,
                has_pending_correction=corr is not None and corr.status in ["pending_faculty_approval", "pending_admin_approval"],
                correction_request_id=corr.id if corr else None,
                correction_status=corr.status if corr else None,
            )
        )

    # Convert subjects map to list
    subjects_breakdown: List[StudentSubjectAttendanceBreakdown] = []
    for s_data in subjects_map.values():
        t = s_data["total"]
        a = s_data["attended"]
        pct = round((a / t * 100.0), 1) if t > 0 else 100.0
        subjects_breakdown.append(
            StudentSubjectAttendanceBreakdown(
                subject_id=s_data["id"],
                subject_name=s_data["name"],
                subject_code=s_data["code"],
                total_sessions=t,
                attended=a,
                absent=s_data["absent"],
                excused=s_data["excused"],
                percentage=pct,
                is_at_risk=pct < 75.0 and t >= 3,
            )
        )

    overall_pct = round((attended_classes / total_classes * 100.0), 1) if total_classes > 0 else (student.attendance_percentage or 100.0)

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
    if not attendance:
        raise ValueError("Attendance record not found")

    # Check for existing pending request
    pending_stmt = select(AttendanceCorrectionRequest).where(
        AttendanceCorrectionRequest.attendance_id == req_in.attendance_id,
        AttendanceCorrectionRequest.status.in_(["pending_faculty_approval", "pending_admin_approval"]),
    )
    pending_res = await db.execute(pending_stmt)
    if pending_res.scalar_one_or_none():
        raise ValueError("A correction request for this attendance record is already under active review.")

    is_faculty = any(r in ["faculty_internal", "faculty_external"] for r in user_roles)
    is_admin = any(r in ["crc_admin", "crc_coordinator"] for r in user_roles)

    now_utc = datetime.now(timezone.utc)
    initial_status = "pending_faculty_approval"
    faculty_approver_id = None
    faculty_action = None
    faculty_acted_at = None
    faculty_remarks = None

    if is_faculty:
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
    }

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
        faculty_approver_id=faculty_approver_id,
        faculty_action=faculty_action,
        faculty_acted_at=faculty_acted_at,
        faculty_remarks=faculty_remarks,
        audit_trail={"history": [audit_entry]},
    )
    db.add(corr)
    await db.commit()
    await db.refresh(corr)

    return await format_correction_response(db, corr)


async def review_attendance_correction_faculty(
    db: AsyncSession,
    request_id: UUID,
    action: str,
    remarks: Optional[str],
    faculty_user_id: UUID,
) -> AttendanceCorrectionResponse:
    """
    Tier 1 Faculty Review:
    If approved -> advances status to 'pending_admin_approval'.
    If rejected -> sets status to 'rejected' (attendance unchanged).
    """
    corr_stmt = select(AttendanceCorrectionRequest).where(AttendanceCorrectionRequest.id == request_id)
    corr_res = await db.execute(corr_stmt)
    corr = corr_res.scalar_one_or_none()
    if not corr:
        raise ValueError("Correction request not found")

    if corr.status != "pending_faculty_approval":
        raise ValueError(f"Request is not awaiting faculty review (current status: {corr.status})")

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

    if action == "approved":
        corr.status = "pending_admin_approval"
    else:
        corr.status = "rejected"
        corr.resolved_at = now_utc

    await db.commit()
    await db.refresh(corr)
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
    If approved -> sets status to 'approved' and ATOMICALLY updates StudentAttendance.status
                   in database and recalculates student attendance percentage.
    If rejected -> sets status to 'rejected' (attendance unchanged).
    """
    corr_stmt = (
        select(AttendanceCorrectionRequest)
        .options(
            selectinload(AttendanceCorrectionRequest.attendance),
            selectinload(AttendanceCorrectionRequest.session),
        )
        .where(AttendanceCorrectionRequest.id == request_id)
    )
    corr_res = await db.execute(corr_stmt)
    corr = corr_res.scalar_one_or_none()
    if not corr:
        raise ValueError("Correction request not found")

    if corr.status not in ["pending_admin_approval", "pending_faculty_approval"]:
        raise ValueError(f"Request is not pending review (current status: {corr.status})")

    now_utc = datetime.now(timezone.utc)
    corr.admin_approver_id = admin_user_id
    corr.admin_action = action
    corr.admin_acted_at = now_utc
    corr.admin_remarks = remarks
    corr.resolved_at = now_utc

    history = corr.audit_trail.get("history", []) if corr.audit_trail else []
    history.append({
        "event": f"admin_{action}",
        "admin_id": str(admin_user_id),
        "acted_at": now_utc.isoformat(),
        "remarks": remarks,
    })
    corr.audit_trail = {"history": history}

    if action == "approved":
        corr.status = "approved"

        # ATOMICALLY UPDATE ATTENDANCE RECORD
        att = corr.attendance
        if att:
            att.status = corr.requested_status
            prev_remarks = att.remarks or ""
            att.remarks = f"{prev_remarks} [Dual-Approved: {corr.requested_status} on {now_utc.strftime('%d/%m/%Y')}]".strip()

            # Recalculate automatic batch attendance %
            if corr.session and corr.session.batch_id:
                await recalculate_batch_student_attendance(db, corr.session.batch_id)
    else:
        corr.status = "rejected"

    await db.commit()
    await db.refresh(corr)
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
            selectinload(AttendanceCorrectionRequest.attendance),
            selectinload(AttendanceCorrectionRequest.session).selectinload(Session.subject),
            selectinload(AttendanceCorrectionRequest.session).selectinload(Session.batch),
            selectinload(AttendanceCorrectionRequest.student),
            selectinload(AttendanceCorrectionRequest.faculty_approver),
            selectinload(AttendanceCorrectionRequest.admin_approver),
        )
    )

    if status_filter:
        query = query.where(AttendanceCorrectionRequest.status == status_filter)

    if is_student:
        student_subquery = select(Student.id).where(Student.user_id == user_id)
        query = query.where(
            or_(
                AttendanceCorrectionRequest.requested_by_id == user_id,
                AttendanceCorrectionRequest.student_id.in_(student_subquery),
            )
        )
    elif is_faculty and not is_admin:
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, user_id)
        if fac_id:
            if fac_type == "internal":
                query = query.join(Session, AttendanceCorrectionRequest.session_id == Session.id).where(
                    Session.faculty_internal_id == fac_id
                )
            else:
                query = query.join(Session, AttendanceCorrectionRequest.session_id == Session.id).where(
                    Session.faculty_external_id == fac_id
                )

    query = query.order_by(AttendanceCorrectionRequest.created_at.desc())
    res = await db.execute(query)
    corrections = res.scalars().all()

    output = []
    for c in corrections:
        resp = await format_correction_response(db, c)
        output.append(resp)

    return output


async def get_debarment_risk_students(
    db: AsyncSession,
    threshold_pct: float = 75.0,
    batch_id: Optional[UUID] = None,
) -> List[DebarredStudentItemResponse]:
    """
    Returns list of students with attendance below threshold (< 75%).
    """
    query = (
        select(Student)
        .options(
            selectinload(Student.program),
            selectinload(Student.batch),
        )
        .where(
            Student.is_deleted == False,
            Student.attendance_percentage < threshold_pct,
        )
    )
    if batch_id:
        query = query.where(Student.batch_id == batch_id)

    query = query.order_by(Student.attendance_percentage.asc(), Student.full_name.asc())
    res = await db.execute(query)
    students = res.scalars().all()

    output = []
    student_ids = [st.id for st in students]
    att_counts_map: Dict[UUID, Dict[str, int]] = {st.id: {"total": 0, "attended": 0} for st in students}

    if student_ids:
        att_stmt = select(
            StudentAttendance.student_id,
            StudentAttendance.status,
        ).where(StudentAttendance.student_id.in_(student_ids))
        att_res = await db.execute(att_stmt)
        for s_id, status in att_res.all():
            if s_id in att_counts_map:
                att_counts_map[s_id]["total"] += 1
                if status in ["present", "late"]:
                    att_counts_map[s_id]["attended"] += 1

    for st in students:
        counts = att_counts_map.get(st.id, {"total": 0, "attended": 0})
        total_conducted = counts["total"]
        attended = counts["attended"]
        
        # Calculate classes needed to reach 75%
        # (attended + x) / (total + x) >= 0.75 => x >= (0.75*total - attended) / 0.25
        needed = 0
        if total_conducted > 0:
            target = 0.75 * total_conducted
            if attended < target:
                needed = int((target - attended) / 0.25) + 1

        output.append(
            DebarredStudentItemResponse(
                student_id=st.id,
                student_name=st.full_name or f"{st.first_name} {st.last_name or ''}".strip(),
                student_prn=st.prn_number or st.roll_no or "",
                roll_no=st.roll_no,
                program_name=st.program.name if st.program else "PGDM",
                batch_name=st.batch.name if st.batch else "Batch 2026",
                attendance_percentage=round(st.attendance_percentage or 0.0, 1),
                total_sessions=total_conducted,
                attended_sessions=attended,
                shortfall_sessions=max(0, needed),
            )
        )

    return output


async def format_correction_response(db: AsyncSession, corr: AttendanceCorrectionRequest) -> AttendanceCorrectionResponse:
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

    return AttendanceCorrectionResponse(
        id=corr.id,
        attendance_id=corr.attendance_id,
        session_id=corr.session_id,
        student_id=corr.student_id,
        requested_by_id=corr.requested_by_id,
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

    if not is_admin and current_user_id:
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, current_user_id)
        if fac_id:
            if fac_type == "internal":
                query = query.where(Session.faculty_internal_id == fac_id)
            else:
                query = query.where(Session.faculty_external_id == fac_id)

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
                if a.status == "late":
                    late_count += 1
                elif a.status in ["excused", "leave_approved"]:
                    excused_count += 1
                elif a.status in ["od_duty", "on_duty", "on duty"]:
                    od_count += 1
            else:
                absent_count += 1
                absentees.append({
                    "student_id": str(a.student_id),
                    "student_name": st_name,
                    "student_prn": st_prn,
                    "roll_no": st_roll,
                    "remarks": a.remarks,
                })

        pct = round((present_count / total_students * 100), 1) if total_students > 0 else 0.0

        fac_name = "Unassigned"
        if s.faculty_internal:
            fac_name = s.faculty_internal.full_name or "Internal Faculty"
        elif s.faculty_external:
            fac_name = s.faculty_external.name or "External Faculty"

        # Check status filter
        is_marked = total_students > 0
        if attendance_status == "marked" and not is_marked:
            continue
        elif attendance_status == "pending" and is_marked:
            continue

        register_out.append({
            "id": str(s.id),
            "session_date": s.session_date.isoformat() if s.session_date else "",
            "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
            "end_time": s.end_time.strftime("%H:%M") if s.end_time else "",
            "session_type": s.session_type or "Regular Lecture",
            "hyperbuild_activity_no": s.hyperbuild_activity_no,
            "program_name": s.program.name if s.program else None,
            "batch_id": str(s.batch_id) if s.batch_id else None,
            "batch_name": s.batch.name if s.batch else "General Batch",
            "subject_id": str(s.subject_id) if s.subject_id else None,
            "subject_name": s.subject.name if s.subject else "Class Session",
            "subject_code": s.subject.code if s.subject else "SUB",
            "venue": s.venue or "Campus Classroom",
            "faculty_name": fac_name,
            "attendance_status": "marked" if is_marked else "pending",
            "is_locked": any(a.is_locked for a in atts) if atts else False,
            "total_students": total_students,
            "present_count": present_count,
            "absent_count": absent_count,
            "late_count": late_count,
            "excused_count": excused_count,
            "od_count": od_count,
            "attendance_percentage": pct,
            "absentees": absentees,
        })

    return register_out


async def get_subject_attendance_matrix(
    db: AsyncSession,
    subject_id: UUID,
    batch_id: Optional[UUID] = None,
) -> Dict[str, Any]:
    """
    Returns a full cross-tab matrix of students and sessions for a subject,
    ideal for generating cumulative spreadsheets, gradebooks, and debarment flags.
    """
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

    # Fetch marked/completed sessions
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

    # Preload all attendance records
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

    # Fetch enrolled students
    st_stmt = select(Student).where(Student.status == "active")
    if batch_id:
        st_stmt = st_stmt.where(Student.batch_id == batch_id)
    elif subject.batch_allocations:
        b_ids = [ba.batch_id for ba in subject.batch_allocations if ba.batch_id]
        if b_ids:
            st_stmt = st_stmt.where(Student.batch_id.in_(b_ids))

    st_stmt = st_stmt.order_by(Student.roll_no.asc().nullslast(), Student.first_name.asc())
    st_res = await db.execute(st_stmt)
    students = st_res.scalars().all()

    # Build sessions header
    sessions_header = []
    for idx, s in enumerate(all_sessions):
        fac_name = "Faculty"
        if s.faculty_internal:
            fac_name = s.faculty_internal.full_name
        elif s.faculty_external:
            fac_name = s.faculty_external.name

        # Calculate session presence
        p_count = sum(
            1 for st in students if (st.id, s.id) in att_map and att_map[(st.id, s.id)].status in PRESENT_STATUSES
        )
        pct = round((p_count / len(students) * 100), 1) if students else 0.0

        sessions_header.append({
            "id": str(s.id),
            "session_no": idx + 1,
            "session_date": s.session_date.isoformat() if s.session_date else "",
            "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
            "end_time": s.end_time.strftime("%H:%M") if s.end_time else "",
            "venue": s.venue or "Room",
            "faculty_name": fac_name,
            "present_count": p_count,
            "total_students": len(students),
            "percentage": pct,
        })

    # Build students matrix rows
    total_conducted = len(all_sessions)
    students_matrix = []
    safe_count = 0
    warning_count = 0
    debarred_count = 0

    for st in students:
        attended = 0
        records: Dict[str, str] = {}
        for s in all_sessions:
            rec = att_map.get((st.id, s.id))
            if rec:
                records[str(s.id)] = rec.status
                if rec.status in PRESENT_STATUSES:
                    attended += 1
            else:
                records[str(s.id)] = "unmarked"

        pct = round((attended / total_conducted * 100), 1) if total_conducted > 0 else 100.0

        if pct >= 75.0:
            tier = "safe"
            safe_count += 1
        elif pct >= 60.0:
            tier = "warning"
            warning_count += 1
        else:
            tier = "debarred"
            debarred_count += 1

        # Needed classes formula to reach 75%
        # (attended + x) / (total_conducted + x) >= 0.75 => x >= (0.75 * total_conducted - attended) / 0.25
        needed = 0
        if pct < 75.0 and total_conducted > 0:
            target = 0.75 * total_conducted
            if target > attended:
                needed = int((target - attended) / 0.25) + 1

        students_matrix.append({
            "student_id": str(st.id),
            "student_name": f"{st.first_name} {st.last_name or ''}".strip(),
            "student_prn": st.prn_number or st.roll_no or "PRN-N/A",
            "roll_no": st.roll_no or "-",
            "total_attended": attended,
            "total_conducted": total_conducted,
            "percentage": pct,
            "tier": tier,
            "needed_classes_for_75": max(0, needed),
            "attendance_by_session": records,
        })

    avg_pct = round(
        sum(st["percentage"] for st in students_matrix) / len(students_matrix), 1
    ) if students_matrix else 0.0

    return {
        "subject_id": str(subject.id),
        "subject_name": subject.name,
        "subject_code": subject.code,
        "total_sessions": total_conducted,
        "total_students": len(students),
        "average_attendance_percentage": avg_pct,
        "safe_count": safe_count,
        "warning_count": warning_count,
        "debarred_count": debarred_count,
        "sessions": sessions_header,
        "students": students_matrix,
    }

