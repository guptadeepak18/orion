from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission
from app.schemas.common import ResponseEnvelope
from app.schemas.remuneration import ExternalRemunerationBillingResponse
from app.services import remuneration_service

router = APIRouter(prefix="/remuneration", tags=["Remuneration"])


@router.get(
    "/billings",
    response_model=ResponseEnvelope[List[ExternalRemunerationBillingResponse]],
    dependencies=[Depends(require_permission("remuneration", "view"))],
    summary="Get completed external faculty class billings & remuneration details",
)
async def list_remuneration_billings(db: AsyncSession = Depends(get_db)):
    billings = await remuneration_service.list_external_remuneration_billings(db)
    return ResponseEnvelope(data=billings)


@router.post(
    "/calculate",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("remuneration", "edit"))],
)
async def calculate_remuneration(
    engagement_id: UUID, db: AsyncSession = Depends(get_db)
):
    calc = await remuneration_service.calculate_engagement_remuneration(db, engagement_id)
    return ResponseEnvelope(
        data={
            "id": str(calc.id),
            "hours": float(calc.hours),
            "gross_amount": float(calc.gross_amount),
            "tax_amount": float(calc.tax_amount),
            "net_payable": float(calc.net_payable),
            "is_anomaly_flagged": calc.is_anomaly_flagged,
            "anomaly_reason": calc.anomaly_reason,
        }
    )
