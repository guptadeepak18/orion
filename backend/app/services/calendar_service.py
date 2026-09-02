from datetime import date
from typing import List, Optional, Dict, Any
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import joinedload

from app.models.session import Session
from app.models.academic_event import AcademicEvent


async def get_calendar_events(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    batch_id: Optional[UUID] = None,
    faculty_internal_id: Optional[UUID] = None,
    faculty_external_id: Optional[UUID] = None,
) -> List[Dict[str, Any]]:
    # 1. Fetch Class Sessions
    stmt = (
        select(Session)
        .options(
            joinedload(Session.subject),
            joinedload(Session.batch),
        )
        .where(Session.is_deleted == False)
    )

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
    sessions = res.unique().scalars().all()

    events = []
    for s in sessions:
        sub_title = s.subject.name if s.subject else s.session_type.upper()
        events.append({
            "id": str(s.id),
            "item_type": "class_session",
            "title": f"Class: {sub_title} @ {s.venue}",
            "date": str(s.session_date),
            "start_time": str(s.start_time),
            "end_time": str(s.end_time),
            "venue": s.venue,
            "mode": s.mode,
            "faculty_type": s.faculty_type,
            "status": s.status,
            "batch_name": s.batch.name if s.batch else None,
            "subject_name": s.subject.name if s.subject else None,
        })

    # 2. Fetch Academic Events & Milestones
    ev_stmt = (
        select(AcademicEvent)
        .options(
            joinedload(AcademicEvent.batch),
            joinedload(AcademicEvent.program),
        )
        .where(AcademicEvent.is_deleted == False)
    )

    if start_date:
        ev_stmt = ev_stmt.where(or_(AcademicEvent.end_date >= start_date, AcademicEvent.start_date >= start_date))
    if end_date:
        ev_stmt = ev_stmt.where(AcademicEvent.start_date <= end_date)
    if batch_id:
        ev_stmt = ev_stmt.where(or_(AcademicEvent.batch_id == batch_id, AcademicEvent.batch_id.is_(None)))

    ev_stmt = ev_stmt.order_by(AcademicEvent.start_date.asc(), AcademicEvent.start_time.asc())
    ev_res = await db.execute(ev_stmt)
    academic_events = ev_res.unique().scalars().all()

    for e in academic_events:
        events.append({
            "id": str(e.id),
            "item_type": "academic_event",
            "event_category": e.event_category,
            "title": e.title,
            "date": str(e.start_date),
            "end_date": str(e.end_date) if e.end_date else str(e.start_date),
            "start_time": str(e.start_time) if e.start_time else "09:00:00",
            "end_time": str(e.end_time) if e.end_time else "17:00:00",
            "is_all_day": e.is_all_day,
            "venue": e.venue or "Campus",
            "mode": e.mode or "offline",
            "organizer_name": e.organizer_name,
            "speaker_guest_details": e.speaker_guest_details,
            "status": e.status,
            "target_audience": e.target_audience,
            "is_mandatory": e.is_mandatory,
            "batch_name": e.batch.name if e.batch else "All Batches / Cohorts",
            "program_name": e.program.name if e.program else None,
        })

    # Sort combined events by date and time
    events.sort(key=lambda x: (x.get("date", ""), x.get("start_time", "")))
    return events
