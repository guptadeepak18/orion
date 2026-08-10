from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.models.student import Student
from app.models.academic import Program, Batch
from app.schemas.student import StudentCreate, StudentUpdate, StudentResponse, StudentReportSummary


async def create_student(db: AsyncSession, s_in: StudentCreate) -> Student:
    data = s_in.model_dump()
    
    # Calculate full_name if not explicitly supplied
    first_name = data.get("first_name", "").strip()
    last_name = (data.get("last_name") or "").strip()
    full_name = f"{first_name} {last_name}".strip() if (first_name or last_name) else (data.get("full_name") or "")
    data["full_name"] = full_name

    # Backwards compatibility sync
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
    return student


async def get_student(db: AsyncSession, student_id: UUID) -> Optional[Student]:
    stmt = (
        select(Student)
        .options(selectinload(Student.program), selectinload(Student.batch))
        .where(Student.id == student_id, Student.is_deleted == False)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def get_student_by_user_id(db: AsyncSession, user_id: UUID) -> Optional[Student]:
    stmt = (
        select(Student)
        .options(selectinload(Student.program), selectinload(Student.batch))
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
        .options(selectinload(Student.program), selectinload(Student.batch))
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
    for field, value in update_dict.items():
        setattr(student, field, value)

    # Sync computed full name and fields
    first = (student.first_name or "").strip()
    last = (student.last_name or "").strip()
    if first or last:
        student.full_name = f"{first} {last}".strip()
    
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
    return resp


async def to_student_response_enriched(db: AsyncSession, student: Student) -> StudentResponse:
    resp = StudentResponse.model_validate(student)
    if student.program:
        resp.program_name = student.program.name
    if student.batch:
        resp.batch_name = student.batch.name

    if student.batch_id:
        from app.models.session import Session, StudentAttendance
        sess_stmt = (
            select(Session.id)
            .where(
                Session.batch_id == student.batch_id,
                Session.is_deleted == False,
                Session.attendance_status == "marked"
            )
        )
        s_res = await db.execute(sess_stmt)
        marked_ids = list(s_res.scalars().all())
        resp.total_sessions_conducted = len(marked_ids)

        if marked_ids:
            att_stmt = (
                select(StudentAttendance)
                .where(
                    StudentAttendance.student_id == student.id,
                    StudentAttendance.session_id.in_(marked_ids),
                    StudentAttendance.status.in_(["present", "late"])
                )
            )
            a_res = await db.execute(att_stmt)
            resp.total_sessions_attended = len(list(a_res.scalars().all()))
            resp.attendance_percentage = round((resp.total_sessions_attended / resp.total_sessions_conducted) * 100.0, 2)
        else:
            resp.total_sessions_attended = 0
            resp.attendance_percentage = student.attendance_percentage or 100.0

    return resp


