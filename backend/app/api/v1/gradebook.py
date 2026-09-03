import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.permissions import get_current_user
from app.models.auth import User
from app.models.student import Student
from app.services.gradebook_service import gradebook_service

router = APIRouter(prefix="/gradebook", tags=["Academic Gradebook & Analytics"])


class GradeUpdateRequest(BaseModel):
    student_id: uuid.UUID
    subject_id: uuid.UUID
    cce_score: Optional[float] = None
    term_end_score: Optional[float] = None
    remarks: Optional[str] = None


class AIInsightsRequest(BaseModel):
    subject_id: Optional[uuid.UUID] = None
    batch_id: Optional[uuid.UUID] = None


@router.get("/me")
async def get_my_gradebook(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the authenticated student's multi-subject gradebook and analytics."""
    student = await gradebook_service.get_student_by_user(db, current_user)
    if not student:
        # If logged in as faculty/admin, pick a sample student so the view can be previewed
        from sqlalchemy import select
        res = await db.execute(select(Student).order_by(Student.created_at.asc()).limit(1))
        student = res.scalar_one_or_none()
        if not student:
            raise HTTPException(status_code=404, detail="No student record found")

    return await gradebook_service.get_student_gradebook(db, student.id)


@router.get("/students/{student_id}")
async def get_student_gradebook_by_id(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns an individual student's complete multi-subject gradebook (Faculty / Admin)."""
    return await gradebook_service.get_student_gradebook(db, student_id)


@router.get("/cohort")
async def get_cohort_gradebook(
    program_id: Optional[uuid.UUID] = Query(None),
    batch_id: Optional[uuid.UUID] = Query(None),
    division_id: Optional[uuid.UUID] = Query(None),
    subject_id: Optional[uuid.UUID] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the cohort gradebook matrix across all subjects and students (Faculty / Admin)."""
    return await gradebook_service.get_cohort_gradebook(
        db,
        program_id=program_id,
        batch_id=batch_id,
        division_id=division_id,
        subject_id=subject_id,
        search=search,
    )


@router.post("/cohort/ai-insights")
async def get_cohort_ai_insights(
    payload: Optional[AIInsightsRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generates on-demand, multi-model AI insights analyzing cohort strengths, learning gaps, and at-risk students."""
    subject_id = payload.subject_id if payload else None
    batch_id = payload.batch_id if payload else None
    return await gradebook_service.generate_ai_cohort_insights(db, subject_id=subject_id, batch_id=batch_id)


@router.get("/export")
async def export_cohort_gradebook(
    program_id: Optional[uuid.UUID] = Query(None),
    batch_id: Optional[uuid.UUID] = Query(None),
    division_id: Optional[uuid.UUID] = Query(None),
    subject_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exports cohort marksheet as an Excel-ready CSV file with UTF-8 BOM encoding."""
    csv_data = await gradebook_service.export_cohort_gradebook_csv(
        db,
        program_id=program_id,
        batch_id=batch_id,
        division_id=division_id,
        subject_id=subject_id,
    )
    filename = "Cohort_Academic_Gradebook.csv"
    if subject_id:
        from app.models.academic import Subject
        subj = await db.get(Subject, subject_id)
        if subj and subj.code:
            clean_code = subj.code.replace(" ", "_")
            filename = f"{clean_code}_Subject_Gradebook.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Content-Type": "text/csv; charset=utf-8",
        },
    )


@router.get("/subjects/{subject_id}/analytics")
async def get_subject_analytics(
    subject_id: uuid.UUID,
    batch_id: Optional[uuid.UUID] = Query(None),
    division_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns granular subject-wise analytics, activity-by-activity metrics, and at-risk students."""
    return await gradebook_service.get_subject_analytics(
        db,
        subject_id=subject_id,
        batch_id=batch_id,
        division_id=division_id,
    )


@router.post("/students/{student_id}/notify")
async def notify_student_results(
    student_id: uuid.UUID,
    subject_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sends an engaging, sectioned result notification email with grades, feedback, and portal link."""
    return await gradebook_service.send_student_result_email(
        db,
        student_id=student_id,
        subject_id=subject_id,
    )


@router.post("/cohort/notify")
async def notify_cohort_results(
    payload: Optional[AIInsightsRequest] = None,
    program_id: Optional[uuid.UUID] = Query(None),
    batch_id: Optional[uuid.UUID] = Query(None),
    division_id: Optional[uuid.UUID] = Query(None),
    subject_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dispatches result notification emails to the entire filtered cohort or subject."""
    target_subj = subject_id or (payload.subject_id if payload else None)
    target_batch = batch_id or (payload.batch_id if payload else None)
    return await gradebook_service.send_cohort_result_emails(
        db,
        subject_id=target_subj,
        program_id=program_id,
        batch_id=target_batch,
        division_id=division_id,
    )


@router.post("/grades")
async def save_student_grades(
    payload: GradeUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Updates or inputs CCE and Term End examination marks for a student in a subject."""
    return await gradebook_service.save_student_grade(
        db,
        student_id=payload.student_id,
        subject_id=payload.subject_id,
        cce_score=payload.cce_score,
        term_end_score=payload.term_end_score,
        remarks=payload.remarks,
    )
