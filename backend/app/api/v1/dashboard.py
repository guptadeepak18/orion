from uuid import UUID
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_role, get_current_token_payload
from app.schemas.common import ResponseEnvelope
from app.schemas.dashboard import DashboardSummaryResponse, ThoughtOfTheDayResponse, StudentDashboardSummaryResponse
from app.services import dashboard_service
from app.services.thought_service import thought_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/summary",
    response_model=ResponseEnvelope[DashboardSummaryResponse],
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "finance", "approver", "reporting_readonly"]))],
)
async def get_summary(db: AsyncSession = Depends(get_db)):
    summary = await dashboard_service.get_dashboard_summary(db)
    return ResponseEnvelope(data=summary)


@router.get(
    "/student-summary",
    response_model=ResponseEnvelope[StudentDashboardSummaryResponse],
    dependencies=[Depends(get_current_token_payload)],
)
async def get_student_summary(
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db)
):
    user_id = UUID(payload["sub"]) if payload.get("sub") else None
    summary = await dashboard_service.get_student_dashboard_summary(db, user_id)
    return ResponseEnvelope(data=summary)


@router.get(
    "/thought-of-the-day",
    response_model=ResponseEnvelope[ThoughtOfTheDayResponse],
)
async def get_thought_of_the_day(refresh: bool = Query(False, description="Force refresh thought via Gemini")):
    data = await thought_service.get_thought_of_the_day(force_refresh=refresh)
    return ResponseEnvelope(data=data)
