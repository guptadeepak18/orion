from datetime import date
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission
from app.schemas.common import ResponseEnvelope
from app.services import calendar_service

router = APIRouter(prefix="/calendar", tags=["Calendar"])


@router.get(
    "/events",
    response_model=ResponseEnvelope[List[dict]],
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def get_calendar_events(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    batch_id: Optional[UUID] = Query(None),
    faculty_internal_id: Optional[UUID] = Query(None),
    faculty_external_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    events = await calendar_service.get_calendar_events(
        db, start_date, end_date, batch_id, faculty_internal_id, faculty_external_id
    )
    return ResponseEnvelope(data=events)
