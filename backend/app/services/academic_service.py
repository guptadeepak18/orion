from datetime import date
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload

from app.models.academic import Program, AcademicYear, Semester, Batch, Subject, Topic, Division, SubjectProgram, SubjectBatch
from app.schemas.academic import (
    ProgramCreate, ProgramUpdate,
    AcademicYearCreate, AcademicYearUpdate,
    SemesterCreate, SemesterUpdate,
    BatchCreate, BatchUpdate,
    SubjectCreate, SubjectUpdate,
    TopicCreate, TopicUpdate,
    DivisionCreate, DivisionUpdate,
)


# Programs
async def create_program(db: AsyncSession, p_in: ProgramCreate) -> Program:
    program = Program(**p_in.model_dump())
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program


async def get_program(db: AsyncSession, program_id: UUID) -> Optional[Program]:
    stmt = select(Program).where(Program.id == program_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def list_programs(db: AsyncSession) -> List[Program]:
    stmt = select(Program).order_by(Program.name)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def update_program(db: AsyncSession, program_id: UUID, p_in: ProgramUpdate) -> Optional[Program]:
    program = await get_program(db, program_id)
    if not program:
        return None
    for field, value in p_in.model_dump(exclude_unset=True).items():
        setattr(program, field, value)
    await db.commit()
    await db.refresh(program)
    return program


async def delete_program(db: AsyncSession, program_id: UUID) -> bool:
    program = await get_program(db, program_id)
    if not program:
        return False
    await db.delete(program)
    await db.commit()
    return True


# Helper functions to auto-provision FK defaults if missing
async def _get_or_create_default_program(db: AsyncSession) -> Program:
    programs = await list_programs(db)
    if programs:
        return programs[0]
    return await create_program(db, ProgramCreate(name="Default Program", code="DEF-PROG", description="Default Auto Program"))


async def _get_or_create_default_academic_year(db: AsyncSession) -> AcademicYear:
    years = await list_academic_years(db)
    if years:
        return years[0]
    return await create_academic_year(db, AcademicYearCreate(label="AY 2026-2027", start_date=date(2026, 6, 1), end_date=date(2027, 5, 31)))


async def _get_or_create_default_semester(db: AsyncSession, program_id: UUID, year_id: UUID) -> Semester:
    sems = await list_semesters(db, program_id=program_id)
    if sems:
        return sems[0]
    return await create_semester(db, SemesterCreate(program_id=program_id, academic_year_id=year_id, number=1, label="Semester 1", start_date=date(2026, 6, 1), end_date=date(2026, 11, 30)))


# Academic Years
async def create_academic_year(db: AsyncSession, ay_in: AcademicYearCreate) -> AcademicYear:
    ay = AcademicYear(**ay_in.model_dump())
    db.add(ay)
    await db.commit()
    await db.refresh(ay)
    return ay


async def list_academic_years(db: AsyncSession) -> List[AcademicYear]:
    stmt = select(AcademicYear).order_by(AcademicYear.start_date.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


# Semesters
async def create_semester(db: AsyncSession, sem_in: SemesterCreate) -> Semester:
    semester = Semester(**sem_in.model_dump())
    db.add(semester)
    await db.commit()
    await db.refresh(semester)
    return semester


async def list_semesters(db: AsyncSession, program_id: Optional[UUID] = None) -> List[Semester]:
    stmt = select(Semester)
    if program_id:
        stmt = stmt.where(Semester.program_id == program_id)
    stmt = stmt.order_by(Semester.number)
    res = await db.execute(stmt)
    return list(res.scalars().all())


# Batches
async def create_batch(db: AsyncSession, b_in: BatchCreate) -> Batch:
    data = b_in.model_dump()
    if not data.get("program_id"):
        prog = await _get_or_create_default_program(db)
        data["program_id"] = prog.id
    if not data.get("academic_year_id"):
        ay = await _get_or_create_default_academic_year(db)
        data["academic_year_id"] = ay.id
    if not data.get("semester_id"):
        sem = await _get_or_create_default_semester(db, data["program_id"], data["academic_year_id"])
        data["semester_id"] = sem.id

    batch = Batch(**data)
    db.add(batch)
    await db.commit()
    await db.refresh(batch)
    return batch


async def get_batch(db: AsyncSession, batch_id: UUID) -> Optional[Batch]:
    stmt = select(Batch).where(Batch.id == batch_id, Batch.is_deleted == False)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def list_batches(db: AsyncSession, program_id: Optional[UUID] = None) -> List[Batch]:
    from app.models.student import Student
    from sqlalchemy import func

    stmt = select(Batch).where(Batch.is_deleted == False)
    if program_id:
        stmt = stmt.where(Batch.program_id == program_id)
    stmt = stmt.order_by(Batch.name)
    res = await db.execute(stmt)
    batches = list(res.scalars().all())

    count_stmt = (
        select(Student.batch_id, func.count(Student.id))
        .where(Student.is_deleted == False, Student.batch_id.isnot(None))
        .group_by(Student.batch_id)
    )
    counts = dict((await db.execute(count_stmt)).all())

    for b in batches:
        b.student_count = counts.get(b.id, 0)

    return batches


async def update_batch(db: AsyncSession, batch_id: UUID, b_in: BatchUpdate) -> Optional[Batch]:
    batch = await get_batch(db, batch_id)
    if not batch:
        return None
    for field, value in b_in.model_dump(exclude_unset=True).items():
        setattr(batch, field, value)
    await db.commit()
    await db.refresh(batch)
    return batch


async def delete_batch(db: AsyncSession, batch_id: UUID) -> bool:
    batch = await get_batch(db, batch_id)
    if not batch:
        return False
    batch.is_deleted = True
    await db.commit()
    return True


# Subjects
async def _get_or_create_default_batch(db: AsyncSession) -> Batch:
    batches = await list_batches(db)
    if batches:
        return batches[0]
    return await create_batch(db, BatchCreate(name="Batch 2026-A", code="BATCH-2026-A", division="A", student_count=60))


async def create_subject(db: AsyncSession, sub_in: SubjectCreate) -> Subject:
    program_ids = sub_in.program_ids or []
    batch_allocations = sub_in.batch_allocations or []

    subject = Subject(
        name=sub_in.name,
        code=sub_in.code,
        trimester=sub_in.trimester,
        is_non_credit=sub_in.is_non_credit,
        credits=0 if sub_in.is_non_credit else sub_in.credits,
        syllabus=sub_in.syllabus,
        session_plan=sub_in.session_plan,
        hyperbuild_activities=sub_in.hyperbuild_activities,
    )

    if not batch_allocations:
        default_batch = await _get_or_create_default_batch(db)
        subject.batch_id = default_batch.id

    db.add(subject)
    await db.flush()

    # Link programs
    for p_id in program_ids:
        db.add(SubjectProgram(subject_id=subject.id, program_id=p_id))

    # Link batches with term details & start/end dates
    for alloc in batch_allocations:
        b_id = alloc.batch_id if hasattr(alloc, "batch_id") else alloc["batch_id"]
        t_type = getattr(alloc, "term_type", None) or (alloc.get("term_type") if isinstance(alloc, dict) else "trimester")
        t_num = getattr(alloc, "term_number", None) or (alloc.get("term_number") if isinstance(alloc, dict) else 1)
        t_label = getattr(alloc, "term_label", None) or (alloc.get("term_label") if isinstance(alloc, dict) else f"Trimester {t_num}")
        s_date = getattr(alloc, "start_date", None) or (alloc.get("start_date") if isinstance(alloc, dict) else None)
        e_date = getattr(alloc, "end_date", None) or (alloc.get("end_date") if isinstance(alloc, dict) else None)

        db.add(SubjectBatch(
            subject_id=subject.id,
            batch_id=b_id,
            term_type=t_type,
            term_number=t_num,
            term_label=t_label,
            start_date=s_date,
            end_date=e_date,
        ))
        if not subject.batch_id:
            subject.batch_id = b_id

    await db.commit()
    return await get_subject(db, subject.id)


async def get_subject(db: AsyncSession, subject_id: UUID) -> Optional[Subject]:
    stmt = (
        select(Subject)
        .options(
            selectinload(Subject.programs),
            selectinload(Subject.batch_allocations).selectinload(SubjectBatch.batch),
        )
        .where(Subject.id == subject_id, Subject.is_deleted == False)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def list_subjects(
    db: AsyncSession,
    batch_id: Optional[UUID] = None,
    program_id: Optional[UUID] = None,
    trimester: Optional[int] = None,
    is_archived: Optional[bool] = False,
) -> List[Subject]:
    stmt = (
        select(Subject)
        .options(
            selectinload(Subject.programs),
            selectinload(Subject.batch_allocations).selectinload(SubjectBatch.batch),
        )
        .where(Subject.is_deleted == False)
    )

    if is_archived is not None:
        stmt = stmt.where(Subject.is_archived == is_archived)

    if batch_id:
        stmt = stmt.where(
            (Subject.batch_id == batch_id) |
            Subject.id.in_(select(SubjectBatch.subject_id).where(SubjectBatch.batch_id == batch_id))
        )
    if program_id:
        stmt = stmt.where(
            Subject.id.in_(select(SubjectProgram.subject_id).where(SubjectProgram.program_id == program_id))
        )
    if trimester:
        stmt = stmt.where(Subject.trimester == trimester)

    stmt = stmt.order_by(Subject.code)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def archive_subject(db: AsyncSession, subject_id: UUID) -> Optional[Subject]:
    subject = await get_subject(db, subject_id)
    if not subject:
        return None
    subject.is_archived = True
    await db.commit()
    return await get_subject(db, subject_id)


async def unarchive_subject(db: AsyncSession, subject_id: UUID) -> Optional[Subject]:
    subject = await get_subject(db, subject_id)
    if not subject:
        return None
    subject.is_archived = False
    await db.commit()
    return await get_subject(db, subject_id)


async def update_subject(db: AsyncSession, subject_id: UUID, sub_in: SubjectUpdate) -> Optional[Subject]:
    subject = await get_subject(db, subject_id)
    if not subject:
        return None

    data = sub_in.model_dump(exclude_unset=True)

    for field in ["name", "code", "trimester", "is_non_credit", "credits", "is_archived", "syllabus", "session_plan", "hyperbuild_activities"]:
        if field in data and data[field] is not None:
            setattr(subject, field, data[field])

    if subject.is_non_credit:
        subject.credits = 0

    if "program_ids" in data and data["program_ids"] is not None:
        await db.execute(delete(SubjectProgram).where(SubjectProgram.subject_id == subject_id))
        for p_id in data["program_ids"]:
            db.add(SubjectProgram(subject_id=subject.id, program_id=p_id))

    if "batch_allocations" in data and data["batch_allocations"] is not None:
        await db.execute(delete(SubjectBatch).where(SubjectBatch.subject_id == subject_id))
        allocations = data["batch_allocations"]
        for alloc in allocations:
            b_id = alloc.batch_id if hasattr(alloc, "batch_id") else alloc["batch_id"]
            t_type = getattr(alloc, "term_type", None) or (alloc.get("term_type") if isinstance(alloc, dict) else "trimester")
            t_num = getattr(alloc, "term_number", None) or (alloc.get("term_number") if isinstance(alloc, dict) else 1)
            t_label = getattr(alloc, "term_label", None) or (alloc.get("term_label") if isinstance(alloc, dict) else f"Trimester {t_num}")
            s_date = getattr(alloc, "start_date", None) or (alloc.get("start_date") if isinstance(alloc, dict) else None)
            e_date = getattr(alloc, "end_date", None) or (alloc.get("end_date") if isinstance(alloc, dict) else None)

            db.add(SubjectBatch(
                subject_id=subject.id,
                batch_id=b_id,
                term_type=t_type,
                term_number=t_num,
                term_label=t_label,
                start_date=s_date,
                end_date=e_date,
            ))
        if allocations:
            first_b_id = allocations[0].batch_id if hasattr(allocations[0], "batch_id") else allocations[0]["batch_id"]
            subject.batch_id = first_b_id

    await db.commit()
    return await get_subject(db, subject_id)


async def delete_subject(db: AsyncSession, subject_id: UUID) -> bool:
    subject = await get_subject(db, subject_id)
    if not subject:
        return False
    subject.is_deleted = True
    await db.commit()
    return True


# Topics
async def _get_or_create_default_subject(db: AsyncSession) -> Subject:
    subjects = await list_subjects(db)
    if subjects:
        return subjects[0]
    return await create_subject(db, SubjectCreate(name="Core Management", code="MGMT101", credits=3))


async def create_topic(db: AsyncSession, t_in: TopicCreate) -> Topic:
    data = t_in.model_dump()
    if not data.get("subject_id"):
        subject = await _get_or_create_default_subject(db)
        data["subject_id"] = subject.id
    topic = Topic(**data)
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


async def get_topic(db: AsyncSession, topic_id: UUID) -> Optional[Topic]:
    stmt = select(Topic).where(Topic.id == topic_id, Topic.is_deleted == False)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def list_topics(db: AsyncSession, subject_id: Optional[UUID] = None) -> List[Topic]:
    stmt = select(Topic).where(Topic.is_deleted == False)
    if subject_id:
        stmt = stmt.where(Topic.subject_id == subject_id)
    stmt = stmt.order_by(Topic.sequence_no)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def update_topic(db: AsyncSession, topic_id: UUID, t_in: TopicUpdate) -> Optional[Topic]:
    topic = await get_topic(db, topic_id)
    if not topic:
        return None
    for field, value in t_in.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)
    await db.commit()
    await db.refresh(topic)
    return topic


async def delete_topic(db: AsyncSession, topic_id: UUID) -> bool:
    topic = await get_topic(db, topic_id)
    if not topic:
        return False
    topic.is_deleted = True
    await db.commit()
    return True


# Divisions
async def create_division(db: AsyncSession, d_in: DivisionCreate) -> Division:
    division = Division(**d_in.model_dump())
    db.add(division)
    await db.commit()
    await db.refresh(division)
    return division


async def get_division(db: AsyncSession, division_id: UUID) -> Optional[Division]:
    stmt = (
        select(Division)
        .options(selectinload(Division.program))
        .where(Division.id == division_id, Division.is_deleted == False)
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def list_divisions(db: AsyncSession, program_id: Optional[UUID] = None) -> List[Division]:
    from app.models.student import Student, StudentDivision
    from sqlalchemy import func

    stmt = (
        select(Division)
        .options(selectinload(Division.program))
        .where(Division.is_deleted == False)
    )
    if program_id:
        stmt = stmt.where(Division.program_id == program_id)
    stmt = stmt.order_by(Division.name)
    res = await db.execute(stmt)
    divisions = list(res.scalars().all())

    count_stmt = (
        select(StudentDivision.division_id, func.count(StudentDivision.student_id))
        .join(Student, Student.id == StudentDivision.student_id)
        .where(Student.is_deleted == False)
        .group_by(StudentDivision.division_id)
    )
    counts = dict((await db.execute(count_stmt)).all())

    for d in divisions:
        d.student_count = counts.get(d.id, 0)

    return divisions


async def get_subject_completion_report(
    db: AsyncSession, subject_id: UUID, batch_id: Optional[UUID] = None
) -> dict:
    from app.models.session import Session
    from sqlalchemy import func

    subject = await get_subject(db, subject_id)
    if not subject:
        return {"error": "Subject not found"}

    topics = await list_topics(db, subject_id=subject_id)

    stmt = select(Session).where(Session.subject_id == subject_id, Session.is_deleted == False)
    if batch_id:
        stmt = stmt.where(Session.batch_id == batch_id)

    res = await db.execute(stmt)
    sessions = list(res.scalars().all())

    total_sessions_scheduled = len(sessions)
    total_sessions_completed = len([s for s in sessions if s.status == "completed"])
    total_planned_hours = sum(t.planned_hours for t in topics) if topics else 0
    total_delivered_hours = sum(s.duration_minutes for s in sessions if s.status == "completed") / 60.0

    completion_percentage = (
        (total_sessions_completed / total_sessions_scheduled * 100.0)
        if total_sessions_scheduled > 0
        else 0.0
    )

    return {
        "subject_id": str(subject.id),
        "subject_name": subject.name,
        "subject_code": subject.code,
        "trimester": subject.trimester,
        "credits": subject.credits,
        "is_non_credit": subject.is_non_credit,
        "total_topics": len(topics),
        "total_planned_hours": total_planned_hours,
        "total_sessions_scheduled": total_sessions_scheduled,
        "total_sessions_completed": total_sessions_completed,
        "total_delivered_hours": round(total_delivered_hours, 1),
        "completion_percentage": round(completion_percentage, 1),
        "topics_summary": [
            {
                "id": str(t.id),
                "name": t.name,
                "sequence_no": t.sequence_no,
                "planned_hours": t.planned_hours,
                "is_completed": t.is_completed,
            }
            for t in topics
        ],
    }


async def update_division(db: AsyncSession, division_id: UUID, d_in: DivisionUpdate) -> Optional[Division]:
    division = await get_division(db, division_id)
    if not division:
        return None
    for field, value in d_in.model_dump(exclude_unset=True).items():
        setattr(division, field, value)
    await db.commit()
    await db.refresh(division)
    return division


async def delete_division(db: AsyncSession, division_id: UUID) -> bool:
    division = await get_division(db, division_id)
    if not division:
        return False
    division.is_deleted = True
    await db.commit()
    return True


async def assign_students_to_division(
    db: AsyncSession, division_id: UUID, student_ids: List[UUID], assign: bool = True
) -> bool:
    from app.models.student import StudentDivision
    from sqlalchemy import delete, func
    
    if assign:
        for sid in student_ids:
            stmt = select(StudentDivision).where(
                StudentDivision.student_id == sid,
                StudentDivision.division_id == division_id
            )
            existing = (await db.execute(stmt)).scalar_one_or_none()
            if not existing:
                db.add(StudentDivision(student_id=sid, division_id=division_id))
    else:
        stmt = delete(StudentDivision).where(
            StudentDivision.division_id == division_id,
            StudentDivision.student_id.in_(student_ids)
        )
        await db.execute(stmt)
    
    await db.commit()

    # Recalculate division student_count
    count_stmt = select(func.count(StudentDivision.student_id)).where(StudentDivision.division_id == division_id)
    cnt = (await db.execute(count_stmt)).scalar() or 0
    
    div = await get_division(db, division_id)
    if div:
        div.student_count = cnt
        await db.commit()

    return True


async def list_students_for_division(db: AsyncSession, division_id: UUID):
    from app.models.student import Student, StudentDivision
    stmt = (
        select(Student)
        .options(
            selectinload(Student.program),
            selectinload(Student.batch),
            selectinload(Student.divisions),
        )
        .join(StudentDivision, Student.id == StudentDivision.student_id)
        .where(StudentDivision.division_id == division_id, Student.is_deleted == False)
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


