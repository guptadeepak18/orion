from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission
from app.schemas.common import ResponseEnvelope
from app.schemas.academic import (
    ProgramCreate, ProgramUpdate, ProgramResponse,
    AcademicYearCreate, AcademicYearResponse,
    SemesterCreate, SemesterResponse,
    BatchCreate, BatchUpdate, BatchResponse,
    SubjectCreate, SubjectUpdate, SubjectResponse,
    TopicCreate, TopicUpdate, TopicResponse,
)
from app.services import academic_service

router = APIRouter(prefix="/academic", tags=["Academic"])


# Programs
@router.post(
    "/programs",
    response_model=ResponseEnvelope[ProgramResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_program(p_in: ProgramCreate, db: AsyncSession = Depends(get_db)):
    program = await academic_service.create_program(db, p_in)
    return ResponseEnvelope(data=ProgramResponse.model_validate(program))


@router.get(
    "/programs",
    response_model=ResponseEnvelope[List[ProgramResponse]],
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def list_programs(db: AsyncSession = Depends(get_db)):
    programs = await academic_service.list_programs(db)
    return ResponseEnvelope(data=[ProgramResponse.model_validate(p) for p in programs])


@router.put(
    "/programs/{program_id}",
    response_model=ResponseEnvelope[ProgramResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_program(
    program_id: UUID, p_in: ProgramUpdate, db: AsyncSession = Depends(get_db)
):
    program = await academic_service.update_program(db, program_id, p_in)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return ResponseEnvelope(data=ProgramResponse.model_validate(program))


@router.delete(
    "/programs/{program_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_program(program_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await academic_service.delete_program(db, program_id)
    if not success:
        raise HTTPException(status_code=404, detail="Program not found")
    return ResponseEnvelope(data={"deleted": True})


# Academic Years
@router.post(
    "/academic-years",
    response_model=ResponseEnvelope[AcademicYearResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_academic_year(ay_in: AcademicYearCreate, db: AsyncSession = Depends(get_db)):
    ay = await academic_service.create_academic_year(db, ay_in)
    return ResponseEnvelope(data=AcademicYearResponse.model_validate(ay))


@router.get(
    "/academic-years",
    response_model=ResponseEnvelope[List[AcademicYearResponse]],
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def list_academic_years(db: AsyncSession = Depends(get_db)):
    years = await academic_service.list_academic_years(db)
    return ResponseEnvelope(data=[AcademicYearResponse.model_validate(y) for y in years])


# Semesters
@router.post(
    "/semesters",
    response_model=ResponseEnvelope[SemesterResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_semester(sem_in: SemesterCreate, db: AsyncSession = Depends(get_db)):
    sem = await academic_service.create_semester(db, sem_in)
    return ResponseEnvelope(data=SemesterResponse.model_validate(sem))


@router.get(
    "/semesters",
    response_model=ResponseEnvelope[List[SemesterResponse]],
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def list_semesters(
    program_id: Optional[UUID] = Query(None), db: AsyncSession = Depends(get_db)
):
    sems = await academic_service.list_semesters(db, program_id)
    return ResponseEnvelope(data=[SemesterResponse.model_validate(s) for s in sems])


# Batches
@router.post(
    "/batches",
    response_model=ResponseEnvelope[BatchResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_batch(b_in: BatchCreate, db: AsyncSession = Depends(get_db)):
    batch = await academic_service.create_batch(db, b_in)
    return ResponseEnvelope(data=BatchResponse.model_validate(batch))


@router.get(
    "/batches",
    response_model=ResponseEnvelope[List[BatchResponse]],
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def list_batches(
    program_id: Optional[UUID] = Query(None), db: AsyncSession = Depends(get_db)
):
    batches = await academic_service.list_batches(db, program_id)
    return ResponseEnvelope(data=[BatchResponse.model_validate(b) for b in batches])


@router.put(
    "/batches/{batch_id}",
    response_model=ResponseEnvelope[BatchResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_batch(
    batch_id: UUID, b_in: BatchUpdate, db: AsyncSession = Depends(get_db)
):
    batch = await academic_service.update_batch(db, batch_id, b_in)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return ResponseEnvelope(data=BatchResponse.model_validate(batch))


@router.delete(
    "/batches/{batch_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_batch(batch_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await academic_service.delete_batch(db, batch_id)
    if not success:
        raise HTTPException(status_code=404, detail="Batch not found")
    return ResponseEnvelope(data={"deleted": True})


# Subjects
@router.post(
    "/subjects",
    response_model=ResponseEnvelope[SubjectResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_subject(sub_in: SubjectCreate, db: AsyncSession = Depends(get_db)):
    subject = await academic_service.create_subject(db, sub_in)
    return ResponseEnvelope(data=SubjectResponse.model_validate(subject))


@router.get(
    "/subjects",
    response_model=ResponseEnvelope[List[SubjectResponse]],
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def list_subjects(
    batch_id: Optional[UUID] = Query(None), db: AsyncSession = Depends(get_db)
):
    subjects = await academic_service.list_subjects(db, batch_id)
    return ResponseEnvelope(data=[SubjectResponse.model_validate(s) for s in subjects])


@router.put(
    "/subjects/{subject_id}",
    response_model=ResponseEnvelope[SubjectResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_subject(
    subject_id: UUID, sub_in: SubjectUpdate, db: AsyncSession = Depends(get_db)
):
    subject = await academic_service.update_subject(db, subject_id, sub_in)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return ResponseEnvelope(data=SubjectResponse.model_validate(subject))


@router.delete(
    "/subjects/{subject_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_subject(subject_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await academic_service.delete_subject(db, subject_id)
    if not success:
        raise HTTPException(status_code=404, detail="Subject not found")
    return ResponseEnvelope(data={"deleted": True})


# Topics
@router.post(
    "/topics",
    response_model=ResponseEnvelope[TopicResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_topic(t_in: TopicCreate, db: AsyncSession = Depends(get_db)):
    topic = await academic_service.create_topic(db, t_in)
    return ResponseEnvelope(data=TopicResponse.model_validate(topic))


@router.get(
    "/topics",
    response_model=ResponseEnvelope[List[TopicResponse]],
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def list_topics(
    subject_id: Optional[UUID] = Query(None), db: AsyncSession = Depends(get_db)
):
    topics = await academic_service.list_topics(db, subject_id)
    return ResponseEnvelope(data=[TopicResponse.model_validate(t) for t in topics])


@router.put(
    "/topics/{topic_id}",
    response_model=ResponseEnvelope[TopicResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_topic(
    topic_id: UUID, t_in: TopicUpdate, db: AsyncSession = Depends(get_db)
):
    topic = await academic_service.update_topic(db, topic_id, t_in)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return ResponseEnvelope(data=TopicResponse.model_validate(topic))


@router.delete(
    "/topics/{topic_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_topic(topic_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await academic_service.delete_topic(db, topic_id)
    if not success:
        raise HTTPException(status_code=404, detail="Topic not found")
    return ResponseEnvelope(data={"deleted": True})

