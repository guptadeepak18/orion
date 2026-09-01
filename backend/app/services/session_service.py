from datetime import datetime, date, time
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.models.session import Session, Timetable, TimetableRevision, StudentAttendance
from app.models.academic import Subject, Topic, Batch
from app.models.student import Student
from app.models.faculty import FacultyInternal, FacultyExternal
from app.schemas.session import (
    SessionCreate, SessionUpdate, SessionResponse, SessionBulkEditRequest,
    RawImportRow, TimetableImportPreviewResponse, TimetableCommitRequest,
    SessionAttendanceBulkRequest, SessionAttendanceSheetResponse, StudentAttendanceRecordResponse
)
from app.agents.scheduler_sentinel import scheduler_sentinel, SchedulerConflictException
from app.agents.faculty_compliance_agent import faculty_compliance_agent, FacultyComplianceException
from app.services.remuneration_service import process_completed_external_session


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

    session = Session(**s_in.model_dump())
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # HyperBuild Activity Release:
    # Logic moved to a time-gated check in the activity retrieval service 
    # to prevent early release before class start time.


    return session


async def update_session(db: AsyncSession, session_id: UUID, s_in: SessionUpdate) -> Session:
    stmt = select(Session).where(Session.id == session_id, Session.is_deleted == False)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    update_data = s_in.model_dump(exclude_unset=True)

    # If date/time/venue/faculty changes, re-validate with Sentinel
    check_date = update_data.get("session_date", session.session_date)
    check_start = update_data.get("start_time", session.start_time)
    check_end = update_data.get("end_time", session.end_time)
    check_venue = update_data.get("venue", session.venue)
    check_f_type = update_data.get("faculty_type", session.faculty_type)
    check_f_int = update_data.get("faculty_internal_id", session.faculty_internal_id)
    check_f_ext = update_data.get("faculty_external_id", session.faculty_external_id)

    await scheduler_sentinel.validate_session_slot(
        db=db,
        session_date=check_date,
        start_time=check_start,
        end_time=check_end,
        venue=check_venue,
        faculty_type=check_f_type,
        faculty_internal_id=check_f_int,
        faculty_external_id=check_f_ext,
        exclude_session_id=session.id
    )

    for field, val in update_data.items():
        setattr(session, field, val)

    # HyperBuild Activity Release:
    # If session_type was updated to hyperbuild (or already was) and activity_no is present
    current_type = session.session_type
    current_act_no = session.hyperbuild_activity_no

    await db.commit()
    await db.refresh(session)

    # HyperBuild Activity Release:
    # Logic moved to a time-gated check in the activity retrieval service 
    # to prevent early release before class start time.


    if session.status == "completed" and session.faculty_type == "external":
        await process_completed_external_session(db, session)

    return session


async def list_sessions(
    db: AsyncSession,
    batch_id: Optional[UUID] = None,
    session_date: Optional[date] = None,
    status: Optional[str] = None
) -> List[SessionResponse]:
    stmt = (
        select(Session)
        .options(
            selectinload(Session.subject),
            selectinload(Session.topic),
            selectinload(Session.faculty_internal),
            selectinload(Session.faculty_external),
            selectinload(Session.program),
            selectinload(Session.batch),
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
    sessions = list(res.scalars().all())

    results: List[SessionResponse] = []
    for s in sessions:
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
        if s.program:
            r.program_name = s.program.name
        if s.batch:
            r.batch_name = s.batch.name
        results.append(r)
    return results


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
            selectinload(Session.batch),
            selectinload(Session.subject),
            selectinload(Session.program),
        )
        .where(Session.id == session_id, Session.is_deleted == False)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


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
    students = list(st_res.scalars().all())

    # Fetch existing attendance records for this session
    att_stmt = select(StudentAttendance).where(StudentAttendance.session_id == session_id)
    att_res = await db.execute(att_stmt)
    existing_records = {att.student_id: att for att in att_res.scalars().all()}

    student_records: List[StudentAttendanceRecordResponse] = []
    present_count = 0
    absent_count = 0

    for st in students:
        existing = existing_records.get(st.id)
        current_status = existing.status if existing else "present"
        if current_status in ("present", "late"):
            present_count += 1
        elif current_status == "absent":
            absent_count += 1

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
            )
        )

    return SessionAttendanceSheetResponse(
        session_id=session.id,
        batch_id=session.batch_id,
        batch_name=session.batch.name if session.batch else None,
        subject_name=session.subject.name if session.subject else None,
        session_date=session.session_date,
        start_time=session.start_time,
        end_time=session.end_time,
        venue=session.venue,
        status=session.status,
        attendance_status=session.attendance_status or ("marked" if existing_records else "pending"),
        total_students=len(students),
        present_count=present_count,
        absent_count=absent_count,
        students=student_records,
    )


async def recalculate_batch_student_attendance(db: AsyncSession, batch_id: UUID):
    """
    Recalculates and updates attendance_percentage for all students in a given batch
    based on all marked class session attendances.
    """
    # Find all distinct sessions marked for this batch
    distinct_sessions_stmt = (
        select(Session.id)
        .where(
            Session.batch_id == batch_id,
            Session.is_deleted == False,
            Session.attendance_status == "marked"
        )
    )
    distinct_res = await db.execute(distinct_sessions_stmt)
    marked_session_ids = set(distinct_res.scalars().all())

    # Get all active students for this batch
    students_stmt = select(Student).where(Student.batch_id == batch_id, Student.is_deleted == False)
    st_res = await db.execute(students_stmt)
    students = list(st_res.scalars().all())

    for student in students:
        if not marked_session_ids:
            student.attendance_percentage = 100.0
            continue

        # Count how many of the marked sessions this student attended (present, late, excused, on duty)
        PRESENT_STATUSES = ["present", "late", "excused", "leave_approved", "od_duty", "on_duty", "on duty"]
        att_stmt = (
            select(StudentAttendance)
            .where(
                StudentAttendance.student_id == student.id,
                StudentAttendance.session_id.in_(marked_session_ids),
                StudentAttendance.status.in_(PRESENT_STATUSES)
            )
        )
        att_res = await db.execute(att_stmt)
        attended_count = len(list(att_res.scalars().all()))
        total_marked = len(marked_session_ids)

        pct = round((attended_count / total_marked) * 100.0, 2)
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

