from datetime import date
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission, require_role, get_current_token_payload
from app.schemas.common import ResponseEnvelope
from app.schemas.session import SessionAttendanceBulkRequest, SessionAttendanceSheetResponse
from app.schemas.attendance import (
    AttendanceCorrectionCreate,
    AttendanceCorrectionReview,
    AttendanceCorrectionResponse,
    SubjectAttendanceSummaryResponse,
    StudentAttendanceDossierResponse,
    DebarredStudentItemResponse,
)
from app.services import attendance_service

router = APIRouter(prefix="/attendance", tags=["Attendance Tracking & Dual Approval"])

STAFF_ROLES = ["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external", "finance", "approver", "reporting_readonly"]


@router.get(
    "/sessions",
    response_model=ResponseEnvelope[List[dict]],
    dependencies=[Depends(require_role(STAFF_ROLES))],
    summary="List sessions for attendance marking (filtered to allocated subjects for faculty)",
)
async def list_allocated_sessions(
    session_date: Optional[date] = Query(None),
    subject_id: Optional[UUID] = Query(None),
    batch_id: Optional[UUID] = Query(None),
    payload=Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    roles = payload.get("roles", [])
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth credentials")

    sessions = await attendance_service.get_allocated_sessions_for_user(
        db=db,
        user_id=user_id,
        user_roles=roles,
        date_filter=session_date,
        subject_id=subject_id,
        batch_id=batch_id,
    )
    return ResponseEnvelope(data=sessions)


@router.post(
    "/sessions/{session_id}/mark-and-lock",
    response_model=ResponseEnvelope[SessionAttendanceSheetResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
    summary="Mark initial attendance and lock record",
)
async def mark_and_lock_attendance(
    session_id: UUID,
    req: SessionAttendanceBulkRequest,
    payload=Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    roles = payload.get("roles", [])
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth credentials")

    try:
        sheet = await attendance_service.mark_and_lock_session_attendance(
            db=db,
            session_id=session_id,
            req=req,
            current_user_id=user_id,
            user_roles=roles,
        )
        return ResponseEnvelope(data=sheet)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/subject-summary",
    response_model=ResponseEnvelope[SubjectAttendanceSummaryResponse],
    dependencies=[Depends(require_role(STAFF_ROLES))],
    summary="Subject-wise overall attendance analytics and student roster matrix",
)
async def get_subject_attendance_summary(
    subject_id: UUID = Query(...),
    batch_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        summary = await attendance_service.get_subject_wise_attendance(db, subject_id, batch_id)
        return ResponseEnvelope(data=summary)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/register",
    response_model=ResponseEnvelope[List[dict]],
    dependencies=[Depends(require_role(STAFF_ROLES))],
    summary="Comprehensive class-by-class attendance register and audit report",
)
async def get_class_attendance_register(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    subject_id: Optional[UUID] = Query(None),
    batch_id: Optional[UUID] = Query(None),
    faculty_id: Optional[UUID] = Query(None),
    status: Optional[str] = Query(None),
    payload=Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    roles = payload.get("roles", [])
    register = await attendance_service.get_class_attendance_register(
        db=db,
        start_date=start_date,
        end_date=end_date,
        subject_id=subject_id,
        batch_id=batch_id,
        faculty_id=faculty_id,
        attendance_status=status,
        current_user_id=user_id,
        user_roles=roles,
    )
    return ResponseEnvelope(data=register)


@router.get(
    "/subject-matrix",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_role(STAFF_ROLES))],
    summary="Subject-wise cross-tab attendance matrix and gradebook heatmap",
)
async def get_subject_attendance_matrix(
    subject_id: UUID = Query(...),
    batch_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        matrix = await attendance_service.get_subject_attendance_matrix(db, subject_id, batch_id)
        return ResponseEnvelope(data=matrix)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/student-dossier/{student_id}",
    response_model=ResponseEnvelope[StudentAttendanceDossierResponse],
    dependencies=[Depends(get_current_token_payload)],
    summary="Student-wise cumulative attendance dossier and session history",
)
async def get_student_attendance_dossier(
    student_id: UUID,
    payload=Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    roles = payload.get("roles", [])
    is_staff = any(r in STAFF_ROLES for r in roles)
    
    # Strict Student Privacy Guard: A student can ONLY view their own personal dossier
    if not is_staff and "student" in roles:
        from app.models.student import Student
        from sqlalchemy import select
        res = await db.execute(select(Student).where(Student.user_id == user_id, Student.is_deleted == False))
        my_student = res.scalar_one_or_none()
        if not my_student or my_student.id != student_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Students can only view their own personal attendance dossier.",
            )

    try:
        dossier = await attendance_service.get_student_attendance_dossier(db, student_id)
        return ResponseEnvelope(data=dossier)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/debarment-risk",
    response_model=ResponseEnvelope[List[DebarredStudentItemResponse]],
    dependencies=[Depends(require_role(STAFF_ROLES))],
    summary="List students at risk of debarment (< 75% attendance)",
)
async def get_debarment_risk(
    threshold: float = Query(75.0),
    batch_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    students = await attendance_service.get_debarment_risk_students(db, threshold, batch_id)
    return ResponseEnvelope(data=students)


@router.post(
    "/corrections",
    response_model=ResponseEnvelope[AttendanceCorrectionResponse],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="Raise an attendance correction / dispute request",
)
async def create_correction_request(
    req: AttendanceCorrectionCreate,
    payload=Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    roles = payload.get("roles", [])
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth credentials")

    try:
        corr = await attendance_service.create_attendance_correction_request(
            db=db,
            req_in=req,
            requested_by_id=user_id,
            user_roles=roles,
        )
        return ResponseEnvelope(data=corr)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/corrections",
    response_model=ResponseEnvelope[List[AttendanceCorrectionResponse]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="List attendance correction requests",
)
async def list_corrections(
    status: Optional[str] = Query(None),
    subject_id: Optional[UUID] = Query(None),
    payload=Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    roles = payload.get("roles", [])
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth credentials")

    corrections = await attendance_service.list_attendance_corrections(
        db=db,
        user_id=user_id,
        user_roles=roles,
        status_filter=status,
        subject_id=subject_id,
    )
    return ResponseEnvelope(data=corrections)


@router.post(
    "/corrections/{request_id}/faculty-review",
    response_model=ResponseEnvelope[AttendanceCorrectionResponse],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="Tier 1 Review: Faculty approval or rejection",
)
async def faculty_review_correction(
    request_id: UUID,
    req: AttendanceCorrectionReview,
    payload=Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth credentials")

    try:
        corr = await attendance_service.review_attendance_correction_faculty(
            db=db,
            request_id=request_id,
            action=req.action,
            remarks=req.remarks,
            faculty_user_id=user_id,
        )
        return ResponseEnvelope(data=corr)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/corrections/{request_id}/admin-review",
    response_model=ResponseEnvelope[AttendanceCorrectionResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
    summary="Tier 2 Final Review: Admin approval (applies database update) or rejection",
)
async def admin_review_correction(
    request_id: UUID,
    req: AttendanceCorrectionReview,
    payload=Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    roles = payload.get("roles", [])
    is_admin = any(r in ["crc_admin", "crc_coordinator"] for r in roles)
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only System Administrators and Coordinators can execute final attendance approval.",
        )

    try:
        corr = await attendance_service.review_attendance_correction_admin(
            db=db,
            request_id=request_id,
            action=req.action,
            remarks=req.remarks,
            admin_user_id=user_id,
        )
        return ResponseEnvelope(data=corr)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
