from datetime import date
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.academic import Program, AcademicYear, Semester, Batch, Subject, Topic
from app.schemas.academic import (
    ProgramCreate, ProgramUpdate,
    AcademicYearCreate, AcademicYearUpdate,
    SemesterCreate, SemesterUpdate,
    BatchCreate, BatchUpdate,
    SubjectCreate, SubjectUpdate,
    TopicCreate, TopicUpdate,
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
    stmt = select(Batch).where(Batch.is_deleted == False)
    if program_id:
        stmt = stmt.where(Batch.program_id == program_id)
    stmt = stmt.order_by(Batch.name)
    res = await db.execute(stmt)
    return list(res.scalars().all())


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
    data = sub_in.model_dump()
    if not data.get("batch_id"):
        batch = await _get_or_create_default_batch(db)
        data["batch_id"] = batch.id
    subject = Subject(**data)
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return subject


async def get_subject(db: AsyncSession, subject_id: UUID) -> Optional[Subject]:
    stmt = select(Subject).where(Subject.id == subject_id, Subject.is_deleted == False)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def list_subjects(db: AsyncSession, batch_id: Optional[UUID] = None) -> List[Subject]:
    stmt = select(Subject).where(Subject.is_deleted == False)
    if batch_id:
        stmt = stmt.where(Subject.batch_id == batch_id)
    stmt = stmt.order_by(Subject.code)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def update_subject(db: AsyncSession, subject_id: UUID, sub_in: SubjectUpdate) -> Optional[Subject]:
    subject = await get_subject(db, subject_id)
    if not subject:
        return None
    for field, value in sub_in.model_dump(exclude_unset=True).items():
        setattr(subject, field, value)
    await db.commit()
    await db.refresh(subject)
    return subject


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

