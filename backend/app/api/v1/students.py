from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission, require_role, get_current_token_payload
from app.schemas.common import ResponseEnvelope
from app.schemas.student import StudentCreate, StudentUpdate, StudentResponse, StudentReportSummary
from app.schemas.session import StudentAttendanceRecordResponse
from app.services import student_service, session_service

router = APIRouter(prefix="/students", tags=["Students"])

STAFF_ROLES = ["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external", "finance", "approver", "reporting_readonly"]


@router.post(
    "",
    response_model=ResponseEnvelope[StudentResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_student(s_in: StudentCreate, db: AsyncSession = Depends(get_db)):
    student = await student_service.create_student(db, s_in)
    student = await student_service.get_student(db, student.id)
    return ResponseEnvelope(data=await student_service.to_student_response_enriched(db, student))


@router.get(
    "",
    response_model=ResponseEnvelope[List[StudentResponse]],
    dependencies=[Depends(require_role(STAFF_ROLES))],
)
async def list_students(
    program_id: Optional[UUID] = Query(None),
    batch_id: Optional[UUID] = Query(None),
    q: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    results = await student_service.list_students_enriched_batch(db, program_id=program_id, batch_id=batch_id, query=q)
    return ResponseEnvelope(data=results)


@router.get(
    "/me",
    response_model=ResponseEnvelope[StudentReportSummary],
)
async def get_my_student_profile(
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload["sub"])
    student = await student_service.get_student_by_user_id(db, user_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found for current user")

    student_resp = await student_service.to_student_response_enriched(db, student)
    summary = StudentReportSummary(
        student=student_resp,
        total_sessions_scheduled=student_resp.total_sessions_conducted,
        total_sessions_completed=student_resp.total_sessions_attended,
        attendance_percentage=student_resp.attendance_percentage,
        cgpa=student.cgpa,
        enrolled_subjects_count=6,
    )
    return ResponseEnvelope(data=summary)


@router.put(
    "/me",
    response_model=ResponseEnvelope[StudentResponse],
)
async def update_my_student_profile(
    body: dict,
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    """Student can update ONLY their own personal (non-academic) fields."""
    user_id = UUID(payload["sub"])
    student = await student_service.get_student_by_user_id(db, user_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found for current user")

    # Allowed personal fields only
    ALLOWED_FIELDS = {
        "mobile_number", "email_personal", "alternate_contact_number",
        "emergency_contact_name", "emergency_contact_number", "emergency_contact_relation",
        "blood_group",
    }
    for field, value in body.items():
        if field in ALLOWED_FIELDS:
            setattr(student, field, value)

    await db.commit()
    await db.refresh(student)
    student = await student_service.get_student(db, student.id)
    return ResponseEnvelope(data=await student_service.to_student_response_enriched(db, student))


@router.get(
    "/{student_id}",
    response_model=ResponseEnvelope[StudentResponse],
    dependencies=[Depends(get_current_token_payload)],
)
async def get_student(
    student_id: UUID,
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    roles = payload.get("roles", [])
    is_staff = any(r in STAFF_ROLES for r in roles)

    student = await student_service.get_student(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not is_staff and "student" in roles:
        if student.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Students can only view their own record.",
            )

    return ResponseEnvelope(data=await student_service.to_student_response_enriched(db, student))


@router.get(
    "/{student_id}/attendance",
    response_model=ResponseEnvelope[List[StudentAttendanceRecordResponse]],
    dependencies=[Depends(get_current_token_payload)],
    summary="Get a student's full class attendance history",
)
async def get_student_attendance_history(
    student_id: UUID,
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    roles = payload.get("roles", [])
    is_staff = any(r in STAFF_ROLES for r in roles)

    student = await student_service.get_student(db, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if not is_staff and "student" in roles:
        if student.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Students can only view their own attendance history.",
            )

    try:
        records = await session_service.get_student_attendance_history(db, student_id)
        return ResponseEnvelope(data=records)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put(
    "/{student_id}",
    response_model=ResponseEnvelope[StudentResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_student(
    student_id: UUID, s_in: StudentUpdate, db: AsyncSession = Depends(get_db)
):
    student = await student_service.update_student(db, student_id, s_in)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student = await student_service.get_student(db, student_id)
    return ResponseEnvelope(data=await student_service.to_student_response_enriched(db, student))


@router.delete(
    "/{student_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_student(student_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await student_service.delete_student(db, student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Student not found")
    return ResponseEnvelope(data={"deleted": True})

