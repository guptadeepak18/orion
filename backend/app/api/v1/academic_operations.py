from typing import Dict, Any, List, Optional
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.permissions import require_permission, get_current_token_payload
from app.schemas.common import ResponseEnvelope
from app.services.academic_operations_engine import academic_operations_engine

router = APIRouter(prefix="/operations", tags=["World-Class Academic Operations Engine"])


class RubricEvaluationRequest(BaseModel):
    submission_text: str
    assignment_title: str = "Executive Case Study Submission"
    max_marks: int = 20


class JDMatchRequest(BaseModel):
    job_title: str
    domain: str
    required_skills: List[str]
    min_attendance_threshold: float = 75.0


@router.get(
    "/timetable/optimize",
    response_model=ResponseEnvelope[Dict[str, Any]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="Neural Constraint Timetable Optimizer",
)
async def get_optimized_timetable(
    batch_id: UUID = Query(...),
    semester_id: Optional[UUID] = Query(None),
    max_daily_slots: int = Query(4),
    avoid_consecutive_heavy: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await academic_operations_engine.generate_optimized_timetable(
            db=db,
            batch_id=batch_id,
            semester_id=semester_id,
            max_daily_slots=max_daily_slots,
            avoid_consecutive_heavy=avoid_consecutive_heavy,
        )
        return ResponseEnvelope(data=data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/substitute/find",
    response_model=ResponseEnvelope[Dict[str, Any]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="AI Emergency Faculty Substitution Sentinel",
)
async def find_faculty_substitute(
    subject_id: UUID = Query(...),
    session_date: date = Query(default_factory=date.today),
    time_slot: str = Query("09:00 AM - 10:30 AM"),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await academic_operations_engine.find_emergency_faculty_substitute(
            db=db,
            subject_id=subject_id,
            session_date=session_date,
            time_slot=time_slot,
        )
        return ResponseEnvelope(data=data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/exam/seating-matrix",
    response_model=ResponseEnvelope[Dict[str, Any]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="Conflict-Free Anti-Cheat Exam Seating Matrix",
)
async def get_exam_seating_matrix(
    exam_date: date = Query(default_factory=date.today),
    slot_name: str = Query("Morning Session (10:00 AM - 01:00 PM)"),
    db: AsyncSession = Depends(get_db),
):
    data = await academic_operations_engine.generate_conflict_free_exam_matrix(
        db=db,
        exam_date=exam_date,
        slot_name=slot_name,
        batch_ids=[],
    )
    return ResponseEnvelope(data=data)


@router.get(
    "/exam/blooms-question-paper/{subject_id}",
    response_model=ResponseEnvelope[Dict[str, Any]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="AI Bloom's Cognitive Taxonomy Question Paper Generator",
)
async def generate_blooms_question_paper(
    subject_id: UUID,
    exam_type: str = Query("Midterm Examination"),
    total_marks: int = Query(50),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await academic_operations_engine.generate_blooms_question_paper(
            db=db,
            subject_id=subject_id,
            exam_type=exam_type,
            total_marks=total_marks,
        )
        return ResponseEnvelope(data=data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/rubric/evaluate",
    response_model=ResponseEnvelope[Dict[str, Any]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="AI Semantic Rubric Grader & Formative Feedback",
)
async def evaluate_submission_rubric(
    payload: RubricEvaluationRequest,
):
    data = await academic_operations_engine.evaluate_submission_ai_rubric(
        submission_text=payload.submission_text,
        assignment_title=payload.assignment_title,
        max_marks=payload.max_marks,
    )
    return ResponseEnvelope(data=data)


@router.get(
    "/crc/talent-dna/{student_id}",
    response_model=ResponseEnvelope[Dict[str, Any]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="Student 360° Talent DNA & Competency Radar",
)
async def get_student_talent_dna(
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await academic_operations_engine.get_student_talent_dna(
            db=db,
            student_id=student_id,
        )
        return ResponseEnvelope(data=data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/crc/jd-match",
    response_model=ResponseEnvelope[Dict[str, Any]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="AI Placement Matchmaker & Shortlist Generator",
)
async def match_jd_students(
    payload: JDMatchRequest,
    db: AsyncSession = Depends(get_db),
):
    data = await academic_operations_engine.match_students_to_job_description(
        db=db,
        job_title=payload.job_title,
        domain=payload.domain,
        required_skills=payload.required_skills,
        min_attendance_threshold=payload.min_attendance_threshold,
    )
    return ResponseEnvelope(data=data)
