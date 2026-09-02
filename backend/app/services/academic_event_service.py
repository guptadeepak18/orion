import uuid
from datetime import date
from typing import List, Optional
from sqlalchemy import select, and_, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload

from app.models.academic_event import AcademicEvent
from app.models.academic import Program, Batch, Division
from app.models.auth import User
from app.schemas.academic_event import (
    AcademicEventCreate,
    AcademicEventUpdate,
    AcademicEventResponse,
)


def _enrich_event_response(ev: AcademicEvent) -> AcademicEventResponse:
    return AcademicEventResponse(
        id=ev.id,
        title=ev.title,
        event_category=ev.event_category or "other",
        program_id=ev.program_id,
        batch_id=ev.batch_id,
        division_id=ev.division_id,
        start_date=ev.start_date,
        end_date=ev.end_date,
        start_time=ev.start_time,
        end_time=ev.end_time,
        is_all_day=ev.is_all_day,
        venue=ev.venue,
        mode=ev.mode or "offline",
        organizer_name=ev.organizer_name,
        speaker_guest_details=ev.speaker_guest_details,
        description=ev.description,
        target_audience=ev.target_audience or "all_students",
        is_mandatory=ev.is_mandatory,
        registration_link=ev.registration_link,
        status=ev.status or "scheduled",
        color_code=ev.color_code,
        poster_url=ev.poster_url,
        poster_filename=ev.poster_filename,
        created_by_id=ev.created_by_id,
        created_at=ev.created_at,
        updated_at=ev.updated_at,
        program_name=ev.program.name if ev.program else None,
        program_code=ev.program.code if ev.program else None,
        batch_name=ev.batch.name if ev.batch else None,
        batch_code=ev.batch.code if ev.batch else None,
        division_name=ev.division.name if ev.division else None,
        division_code=ev.division.code if ev.division else None,
        created_by_name=ev.created_by.full_name if ev.created_by else None,
    )


async def list_academic_events(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    program_id: Optional[uuid.UUID] = None,
    batch_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
) -> List[AcademicEventResponse]:
    stmt = (
        select(AcademicEvent)
        .options(
            joinedload(AcademicEvent.program),
            joinedload(AcademicEvent.batch),
            joinedload(AcademicEvent.division),
            joinedload(AcademicEvent.created_by),
        )
        .where(AcademicEvent.is_deleted == False)
    )

    if start_date:
        stmt = stmt.where(or_(AcademicEvent.end_date >= start_date, AcademicEvent.start_date >= start_date))
    if end_date:
        stmt = stmt.where(AcademicEvent.start_date <= end_date)
    if category and category != "all":
        stmt = stmt.where(AcademicEvent.event_category == category)
    if program_id:
        stmt = stmt.where(or_(AcademicEvent.program_id == program_id, AcademicEvent.program_id.is_(None)))
    if batch_id:
        stmt = stmt.where(or_(AcademicEvent.batch_id == batch_id, AcademicEvent.batch_id.is_(None)))
    if status and status != "all":
        stmt = stmt.where(AcademicEvent.status == status)

    stmt = stmt.order_by(AcademicEvent.start_date.asc(), AcademicEvent.start_time.asc())
    res = await db.execute(stmt)
    events = res.unique().scalars().all()

    return [_enrich_event_response(e) for e in events]


async def get_academic_event(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> Optional[AcademicEventResponse]:
    stmt = (
        select(AcademicEvent)
        .options(
            joinedload(AcademicEvent.program),
            joinedload(AcademicEvent.batch),
            joinedload(AcademicEvent.division),
            joinedload(AcademicEvent.created_by),
        )
        .where(AcademicEvent.id == event_id, AcademicEvent.is_deleted == False)
    )
    res = await db.execute(stmt)
    ev = res.unique().scalar_one_or_none()
    if not ev:
        return None
    return _enrich_event_response(ev)


async def create_academic_event(
    db: AsyncSession,
    req: AcademicEventCreate,
    created_by_user_id: Optional[uuid.UUID] = None,
) -> AcademicEventResponse:
    ev = AcademicEvent(
        title=req.title.strip(),
        event_category=req.event_category or "other",
        program_id=req.program_id,
        batch_id=req.batch_id,
        division_id=req.division_id,
        start_date=req.start_date,
        end_date=req.end_date or req.start_date,
        start_time=req.start_time,
        end_time=req.end_time,
        is_all_day=req.is_all_day,
        venue=req.venue.strip() if req.venue else None,
        mode=req.mode or "offline",
        organizer_name=req.organizer_name.strip() if req.organizer_name else None,
        speaker_guest_details=req.speaker_guest_details.strip() if req.speaker_guest_details else None,
        description=req.description.strip() if req.description else None,
        target_audience=req.target_audience or "all_students",
        is_mandatory=req.is_mandatory,
        registration_link=req.registration_link.strip() if req.registration_link else None,
        status=req.status or "scheduled",
        color_code=req.color_code,
        poster_url=req.poster_url,
        poster_filename=req.poster_filename,
        created_by_id=created_by_user_id,
    )
    db.add(ev)
    await db.commit()

    saved = await get_academic_event(db, ev.id)
    if not saved:
        raise ValueError("Failed to retrieve created academic event")
    return saved


async def update_academic_event(
    db: AsyncSession,
    event_id: uuid.UUID,
    req: AcademicEventUpdate,
) -> AcademicEventResponse:
    stmt = select(AcademicEvent).where(AcademicEvent.id == event_id, AcademicEvent.is_deleted == False)
    res = await db.execute(stmt)
    ev = res.unique().scalar_one_or_none()
    if not ev:
        raise ValueError("Academic event not found")

    update_dict = req.model_dump(exclude_unset=True)
    for k, v in update_dict.items():
        if isinstance(v, str):
            v = v.strip()
        setattr(ev, k, v)

    await db.commit()

    saved = await get_academic_event(db, ev.id)
    if not saved:
        raise ValueError("Failed to retrieve updated academic event")
    return saved


async def delete_academic_event(
    db: AsyncSession,
    event_id: uuid.UUID,
) -> bool:
    stmt = select(AcademicEvent).where(AcademicEvent.id == event_id, AcademicEvent.is_deleted == False)
    res = await db.execute(stmt)
    ev = res.unique().scalar_one_or_none()
    if not ev:
        raise ValueError("Academic event not found")

    ev.is_deleted = True
    await db.commit()
    return True
