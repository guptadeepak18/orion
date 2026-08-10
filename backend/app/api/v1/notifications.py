from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_user
from app.models.auth import User
from app.schemas.common import ResponseEnvelope
from app.schemas.notification import NotificationResponse
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=ResponseEnvelope[List[NotificationResponse]])
async def get_my_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notifications = await notification_service.list_user_notifications(db, current_user.id)
    responses = [NotificationResponse.model_validate(n) for n in notifications]
    return ResponseEnvelope(data=responses)


@router.post("/{id}/read", response_model=ResponseEnvelope[NotificationResponse])
async def read_notification(
    id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    notif = await notification_service.mark_notification_as_read(db, id)
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    return ResponseEnvelope(data=NotificationResponse.model_validate(notif))
