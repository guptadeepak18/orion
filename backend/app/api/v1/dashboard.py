from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_role
from app.schemas.common import ResponseEnvelope
from app.schemas.dashboard import DashboardSummaryResponse
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get(
    "/summary",
    response_model=ResponseEnvelope[DashboardSummaryResponse],
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "finance", "approver", "reporting_readonly"]))],
)
async def get_summary(db: AsyncSession = Depends(get_db)):
    summary = await dashboard_service.get_dashboard_summary(db)
    return ResponseEnvelope(data=summary)
