from datetime import date
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.session import Session


async def get_calendar_events(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    batch_id: Optional[UUID] = None,
    faculty_internal_id: Optional[UUID] = None,
    faculty_external_id: Optional[UUID] = None,
) -> List[Dict[str, Any]]:
    stmt = select(Session).where(Session.is_deleted == False)

    if start_date:
        stmt = stmt.where(Session.session_date >= start_date)
    if end_date:
        stmt = stmt.where(Session.session_date <= end_date)
    if batch_id:
        stmt = stmt.where(Session.batch_id == batch_id)
    if faculty_internal_id:
        stmt = stmt.where(Session.faculty_internal_id == faculty_internal_id)
    if faculty_external_id:
        stmt = stmt.where(Session.faculty_external_id == faculty_external_id)

    stmt = stmt.order_by(Session.session_date, Session.start_time)
    res = await db.execute(stmt)
    sessions = res.scalars().all()

    events = []
    for s in sessions:
        events.append({
            "id": str(s.id),
            "title": f"{s.session_type.upper()} @ {s.venue}",
            "date": str(s.session_date),
            "start_time": str(s.start_time),
            "end_time": str(s.end_time),
            "venue": s.venue,
            "mode": s.mode,
            "faculty_type": s.faculty_type,
            "status": s.status,
        })
    return events
