from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload, joinedload

from app.models.student import Student
from app.models.academic import Program, Batch
from app.schemas.student import StudentCreate, StudentUpdate, StudentResponse, StudentReportSummary


async def create_student(db: AsyncSession, s_in: StudentCreate) -> Student:
    data = s_in.model_dump()
    division_ids = data.pop("division_ids", None)

    first = (data.get("first_name") or "").strip()
    last = (data.get("last_name") or "").strip()
    data["full_name"] = f"{first} {last}".strip() if first or last else "Student"

    if not data.get("email"):
        data["email"] = data.get("email_official", "")
    if not data.get("phone"):
        data["phone"] = data.get("mobile_number", "")
    if not data.get("roll_no"):
        data["roll_no"] = data.get("prn_number", "")
    if not data.get("enrollment_no"):
        data["enrollment_no"] = data.get("prn_number", "")

    student = Student(**data)
    db.add(student)
    await db.commit()
    await db.refresh(student)

    if division_ids is not None and len(division_ids) > 0:
        from app.models.student import StudentDivision
        from app.models.academic import Division
        from sqlalchemy import select, func

        valid_stmt = select(Division.id).where(
            Division.id.in_(division_ids),
            Division.program_id == student.program_id,
            Division.is_deleted == False
        )
        valid_div_ids = list((await db.execute(valid_stmt)).scalars().all())

        for div_id in valid_div_ids:
            db.add(StudentDivision(student_id=student.id, division_id=div_id))
        await db.commit()

        for div_id in valid_div_ids:
            cnt = (await db.execute(select(func.count(StudentDivision.student_id)).where(StudentDivision.division_id == div_id))).scalar() or 0
            d_obj = (await db.execute(select(Division).where(Division.id == div_id))).scalar_one_or_none()
            if d_obj:
                d_obj.student_count = cnt
        await db.commit()

    return await get_student(db, student.id) or student


async def get_student(db: AsyncSession, student_id: UUID) -> Optional[Student]:
    stmt = (
        select(Student)
        .options(
            selectinload(Student.program),
            selectinload(Student.batch),
            selectinload(Student.divisions),
        )
        .where(Student.id == student_id, Student.is_deleted == False)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def get_student_by_user_id(db: AsyncSession, user_id: UUID) -> Optional[Student]:
    stmt = (
        select(Student)
        .options(
            selectinload(Student.program),
            selectinload(Student.batch),
            selectinload(Student.divisions),
        )
        .where(Student.user_id == user_id, Student.is_deleted == False)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def list_students(
    db: AsyncSession,
    program_id: Optional[UUID] = None,
    batch_id: Optional[UUID] = None,
    query: Optional[str] = None,
) -> List[Student]:
    stmt = (
        select(Student)
        .options(
            selectinload(Student.program),
            selectinload(Student.batch),
            selectinload(Student.divisions),
        )
        .where(Student.is_deleted == False)
    )
    if program_id:
        stmt = stmt.where(Student.program_id == program_id)
    if batch_id:
        stmt = stmt.where(Student.batch_id == batch_id)
    if query:
        search_pattern = f"%{query}%"
        stmt = stmt.where(
            or_(
                Student.full_name.ilike(search_pattern),
                Student.first_name.ilike(search_pattern),
                Student.last_name.ilike(search_pattern),
                Student.prn_number.ilike(search_pattern),
                Student.roll_no.ilike(search_pattern),
                Student.email_official.ilike(search_pattern),
                Student.email_personal.ilike(search_pattern),
                Student.mobile_number.ilike(search_pattern),
                Student.specialization_major.ilike(search_pattern),
                Student.specialization_minor.ilike(search_pattern),
                Student.father_name.ilike(search_pattern),
                Student.mother_name.ilike(search_pattern),
            )
        )
    stmt = stmt.order_by(Student.roll_no, Student.prn_number)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def update_student(db: AsyncSession, student_id: UUID, s_in: StudentUpdate) -> Optional[Student]:
    student = await get_student(db, student_id)
    if not student:
        return None

    update_dict = s_in.model_dump(exclude_unset=True)
    division_ids = update_dict.pop("division_ids", None)

    for field, value in update_dict.items():
        setattr(student, field, value)

    # Sync computed full name and fields
    first = (student.first_name or "").strip()
    last = (student.last_name or "").strip()
    if first or last:
        student.full_name = f"{first} {last}".strip()

    if division_ids is not None:
        from app.models.student import StudentDivision
        from app.models.academic import Division
        from sqlalchemy import delete, select, func

        await db.execute(delete(StudentDivision).where(StudentDivision.student_id == student.id))

        if len(division_ids) > 0:
            valid_stmt = select(Division.id).where(
                Division.id.in_(division_ids),
                Division.program_id == student.program_id,
                Division.is_deleted == False
            )
            valid_div_ids = list((await db.execute(valid_stmt)).scalars().all())
            for div_id in valid_div_ids:
                db.add(StudentDivision(student_id=student.id, division_id=div_id))

    if "email_official" in update_dict and update_dict["email_official"]:
        student.email = update_dict["email_official"]
    if "mobile_number" in update_dict and update_dict["mobile_number"]:
        student.phone = update_dict["mobile_number"]
    if "prn_number" in update_dict and update_dict["prn_number"]:
        student.roll_no = update_dict["prn_number"]
        student.enrollment_no = update_dict["prn_number"]

    await db.commit()
    await db.refresh(student)
    return student


async def delete_student(db: AsyncSession, student_id: UUID) -> bool:
    student = await get_student(db, student_id)
    if not student:
        return False
    student.is_deleted = True
    await db.commit()
    return True


def to_student_response(student: Student) -> StudentResponse:
    resp = StudentResponse.model_validate(student)
    if student.program:
        resp.program_name = student.program.name
    if student.batch:
        resp.batch_name = student.batch.name
    if hasattr(student, "divisions") and student.divisions:
        resp.division_ids = [d.id for d in student.divisions if not d.is_deleted]
        resp.division_names = [d.name for d in student.divisions if not d.is_deleted]
    return resp


async def list_students_enriched_batch(
    db: AsyncSession,
    program_id: Optional[UUID] = None,
    batch_id: Optional[UUID] = None,
    query: Optional[str] = None,
) -> List[StudentResponse]:
    from app.models.session import Session, StudentAttendance
    from sqlalchemy import func

    stmt = (
        select(Student)
        .options(
            joinedload(Student.program),
            joinedload(Student.batch),
            selectinload(Student.divisions),
        )
        .where(Student.is_deleted == False)
    )
    if program_id:
        stmt = stmt.where(Student.program_id == program_id)
    if batch_id:
        stmt = stmt.where(Student.batch_id == batch_id)
    if query:
        search_pattern = f"%{query}%"
        stmt = stmt.where(
            or_(
                Student.full_name.ilike(search_pattern),
                Student.first_name.ilike(search_pattern),
                Student.last_name.ilike(search_pattern),
                Student.prn_number.ilike(search_pattern),
                Student.roll_no.ilike(search_pattern),
                Student.email_official.ilike(search_pattern),
                Student.email_personal.ilike(search_pattern),
                Student.mobile_number.ilike(search_pattern),
            )
        )
    stmt = stmt.order_by(Student.roll_no, Student.prn_number)
    res = await db.execute(stmt)
    students = list(res.unique().scalars().all())

    if not students:
        return []

    # Batch aggregation in 2 single queries instead of 2 queries per student (N+1 eliminated)
    batch_ids = list({s.batch_id for s in students if s.batch_id})
    student_ids = [s.id for s in students]

    batch_conducted_map = {}
    if batch_ids:
        sess_stmt = (
            select(Session.batch_id, func.count(Session.id))
            .where(
                Session.batch_id.in_(batch_ids),
                Session.is_deleted == False,
                Session.attendance_status == "marked",
            )
            .group_by(Session.batch_id)
        )
        batch_conducted_map = dict((await db.execute(sess_stmt)).all())

    student_attended_map = {}
    if student_ids:
        att_stmt = (
            select(StudentAttendance.student_id, func.count(StudentAttendance.id))
            .where(
                StudentAttendance.student_id.in_(student_ids),
                StudentAttendance.status.in_(["present", "late", "excused", "leave_approved", "od_duty", "on_duty", "on duty"]),
            )
            .group_by(StudentAttendance.student_id)
        )
        student_attended_map = dict((await db.execute(att_stmt)).all())

    results: List[StudentResponse] = []
    for s in students:
        resp = to_student_response(s)
        conducted = batch_conducted_map.get(s.batch_id, 0) if s.batch_id else 0
        attended = student_attended_map.get(s.id, 0)
        resp.total_sessions_conducted = conducted
        resp.total_sessions_attended = attended
        if conducted > 0:
            resp.attendance_percentage = round((attended / conducted) * 100.0, 2)
        else:
            resp.attendance_percentage = s.attendance_percentage or 100.0
        results.append(resp)

    return results


async def to_student_response_enriched(db: AsyncSession, student: Student) -> StudentResponse:
    resp = to_student_response(student)

    if student.batch_id:
        from app.models.session import Session, StudentAttendance
        from sqlalchemy import func
        sess_stmt = (
            select(func.count(Session.id))
            .where(
                Session.batch_id == student.batch_id,
                Session.is_deleted == False,
                Session.attendance_status == "marked"
            )
        )
        resp.total_sessions_conducted = (await db.execute(sess_stmt)).scalar() or 0

        if resp.total_sessions_conducted > 0:
            att_stmt = (
                select(func.count(StudentAttendance.id))
                .where(
                    StudentAttendance.student_id == student.id,
                    StudentAttendance.status.in_(["present", "late", "excused", "leave_approved", "od_duty", "on_duty", "on duty"])
                )
            )
            resp.total_sessions_attended = (await db.execute(att_stmt)).scalar() or 0
            resp.attendance_percentage = round((resp.total_sessions_attended / resp.total_sessions_conducted) * 100.0, 2)
        else:
            resp.total_sessions_attended = 0
            resp.attendance_percentage = student.attendance_percentage or 100.0

    return resp


