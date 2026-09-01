from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission, get_current_user
from app.models.auth import User
from app.schemas.common import ResponseEnvelope
from app.schemas.activity import (
    ActivityCreate, ActivityUpdate, ActivityReleaseUpdate, BatchReleaseRequest, ActivityResponse
)
from app.services.activity_service import activity_service

router = APIRouter(prefix="/academic", tags=["Activities"])

@router.get(
    "/subjects/{subject_id}/activities",
    response_model=ResponseEnvelope[List[ActivityResponse]],
)
async def list_subject_activities(
    subject_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_student = any(r.name == "student" for r in current_user.roles) and not any(r.name in ["crc_admin", "crc_coordinator"] for r in current_user.roles)
    activities = await activity_service.list_activities(
        db, 
        subject_id, 
        is_student=is_student, 
        current_user_id=current_user.id
    )
    return ResponseEnvelope(data=[ActivityResponse.model_validate(a) for a in activities])


@router.post(
    "/subjects/{subject_id}/activities",
    response_model=ResponseEnvelope[ActivityResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_subject_activity(
    subject_id: UUID,
    payload: ActivityCreate,
    db: AsyncSession = Depends(get_db),
):
    act = await activity_service.create_activity(db, subject_id, payload)
    return ResponseEnvelope(data=ActivityResponse.model_validate(act))


@router.put(
    "/subjects/{subject_id}/activities/{activity_id}",
    response_model=ResponseEnvelope[ActivityResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_subject_activity(
    subject_id: UUID,
    activity_id: UUID,
    payload: ActivityUpdate,
    db: AsyncSession = Depends(get_db),
):
    act = await activity_service.update_activity(db, activity_id, payload)
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found")
    return ResponseEnvelope(data=ActivityResponse.model_validate(act))


@router.patch(
    "/subjects/{subject_id}/activities/{activity_id}/release",
    response_model=ResponseEnvelope[ActivityResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def toggle_activity_release(
    subject_id: UUID,
    activity_id: UUID,
    payload: ActivityReleaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    act = await activity_service.toggle_release(
        db, activity_id, payload.is_released, released_by=current_user.full_name
    )
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found")
    return ResponseEnvelope(data=ActivityResponse.model_validate(act))


@router.post(
    "/subjects/{subject_id}/activities/batch-release",
    response_model=ResponseEnvelope[List[ActivityResponse]],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def batch_release_activities(
    subject_id: UUID,
    payload: BatchReleaseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    activities = await activity_service.batch_release(
        db, subject_id, payload.activity_ids, payload.is_released, released_by=current_user.full_name
    )
    return ResponseEnvelope(data=[ActivityResponse.model_validate(a) for a in activities])


@router.post(
    "/subjects/{subject_id}/activities/seed-defaults",
    response_model=ResponseEnvelope[List[ActivityResponse]],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def seed_default_subject_activities(
    subject_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    activities = await activity_service.seed_default_activities(db, subject_id)
    return ResponseEnvelope(data=[ActivityResponse.model_validate(a) for a in activities])


@router.post(
    "/subjects/{subject_id}/activities/upload-docx",
    response_model=ResponseEnvelope[List[ActivityResponse]],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def upload_docx_activities(
    subject_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    activities = await activity_service.import_from_docx(db, subject_id, content)
    return ResponseEnvelope(data=[ActivityResponse.model_validate(a) for a in activities])


@router.delete(
    "/subjects/{subject_id}/activities/{activity_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_subject_activity(
    subject_id: UUID,
    activity_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    success = await activity_service.delete_activity(db, activity_id)
    if not success:
        raise HTTPException(status_code=404, detail="Activity not found")
    return ResponseEnvelope(data={"message": "Activity deleted successfully"})
