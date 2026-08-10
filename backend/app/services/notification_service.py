from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models.system import Notification


async def list_user_notifications(db: AsyncSession, user_id: UUID | str) -> List[Notification]:
    if isinstance(user_id, str):
        user_id = UUID(user_id)
    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def mark_notification_as_read(db: AsyncSession, notification_id: UUID | str) -> Optional[Notification]:
    if isinstance(notification_id, str):
        notification_id = UUID(notification_id)
    stmt = select(Notification).where(Notification.id == notification_id)
    res = await db.execute(stmt)
    notif = res.scalar_one_or_none()
    if notif:
        notif.is_read = True
        await db.commit()
        await db.refresh(notif)
    return notif
