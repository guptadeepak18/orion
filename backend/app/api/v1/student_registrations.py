from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_token_payload, require_permission
from app.schemas.student_registration import (
    StudentRegistrationResponse,
    ApproveStudentRegistrationRequest,
)
from app.schemas.common import ResponseEnvelope
from app.services import student_registration_service

router = APIRouter(prefix="/student-registrations", tags=["Student Registrations"])


@router.get(
    "",
    response_model=ResponseEnvelope[List[StudentRegistrationResponse]],
    dependencies=[Depends(require_permission("students", "view"))],
)
async def list_registrations(
    status: Optional[str] = Query(None, description="Filter by status: pending_verification, pending_review, approved, rejected"),
    db: AsyncSession = Depends(get_db),
):
    regs = await student_registration_service.list_registrations(db, status=status)
    return ResponseEnvelope(data=[StudentRegistrationResponse.model_validate(r) for r in regs])


@router.get(
    "/{reg_id}",
    response_model=ResponseEnvelope[StudentRegistrationResponse],
    dependencies=[Depends(require_permission("students", "view"))],
)
async def get_registration(reg_id: UUID, db: AsyncSession = Depends(get_db)):
    reg = await student_registration_service.get_registration(db, reg_id)
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    return ResponseEnvelope(data=StudentRegistrationResponse.model_validate(reg))


@router.post(
    "/{reg_id}/approve",
    response_model=ResponseEnvelope[StudentRegistrationResponse],
    dependencies=[Depends(require_permission("students", "edit"))],
)
async def approve_registration(
    reg_id: UUID,
    body: Optional[ApproveStudentRegistrationRequest] = None,
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    reviewer_id = UUID(payload["sub"])
    try:
        reg = await student_registration_service.approve_registration(
            db, reg_id, reviewer_id, profile_data=body
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseEnvelope(data=StudentRegistrationResponse.model_validate(reg))


@router.post(
    "/{reg_id}/reject",
    response_model=ResponseEnvelope[StudentRegistrationResponse],
    dependencies=[Depends(require_permission("students", "edit"))],
)
async def reject_registration(
    reg_id: UUID,
    body: dict,
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    reason = body.get("reason", "")
    if not reason.strip():
        raise HTTPException(status_code=422, detail="A rejection reason is required.")
    reviewer_id = UUID(payload["sub"])
    try:
        reg = await student_registration_service.reject_registration(db, reg_id, reason, reviewer_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseEnvelope(data=StudentRegistrationResponse.model_validate(reg))
