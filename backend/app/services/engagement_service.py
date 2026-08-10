from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.session import Engagement, Session
from app.schemas.engagement import EngagementCreate, EngagementUpdate


async def create_engagement(db: AsyncSession, e_in: EngagementCreate) -> Engagement:
    # Verify session exists
    s_res = await db.execute(select(Session).where(Session.id == e_in.session_id))
    session = s_res.scalar_one_or_none()
    if not session:
        raise ValueError("Linked session not found")

    engagement = Engagement(
        session_id=e_in.session_id,
        faculty_type=e_in.faculty_type,
        faculty_internal_id=e_in.faculty_internal_id,
        faculty_external_id=e_in.faculty_external_id,
        topic_delivered=e_in.topic_delivered,
        hours=e_in.hours,
        program_id=e_in.program_id,
        batch_id=e_in.batch_id,
        payment_status="unpaid",
        approval_status="pending",
        remarks=e_in.remarks
    )
    db.add(engagement)
    await db.commit()
    await db.refresh(engagement)
    return engagement


async def list_engagements(
    db: AsyncSession,
    faculty_external_id: Optional[UUID] = None,
    approval_status: Optional[str] = None
) -> List[Engagement]:
    stmt = select(Engagement).where(Engagement.is_deleted == False)
    if faculty_external_id:
        stmt = stmt.where(Engagement.faculty_external_id == faculty_external_id)
    if approval_status:
        stmt = stmt.where(Engagement.approval_status == approval_status)

    stmt = stmt.order_by(Engagement.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())
