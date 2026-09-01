from typing import Dict, Any, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission, get_current_token_payload
from app.schemas.common import ResponseEnvelope
from app.services.ai_intelligence_service import ai_intelligence_service

router = APIRouter(prefix="/ai", tags=["Proactive AI Academic Intelligence"])


@router.get(
    "/early-warnings",
    response_model=ResponseEnvelope[Dict[str, Any]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="Proactive Early Warning & Intervention System (EWIS) Dashboard",
)
async def get_early_warning_dashboard(
    batch_id: Optional[UUID] = Query(None),
    program_id: Optional[UUID] = Query(None),
    threshold: float = Query(75.0),
    db: AsyncSession = Depends(get_db),
):
    data = await ai_intelligence_service.get_early_warning_dashboard(
        db=db,
        batch_id=batch_id,
        program_id=program_id,
        target_threshold=threshold,
    )
    return ResponseEnvelope(data=data)


@router.get(
    "/dispute-insights/{request_id}",
    response_model=ResponseEnvelope[Dict[str, Any]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="AI Decision-Support Dossier for Attendance Dispute Reviews",
)
async def get_dispute_insights(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await ai_intelligence_service.get_dispute_decision_insights(
            db=db,
            request_id=request_id,
        )
        return ResponseEnvelope(data=data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/syllabus-benchmark/{subject_id}",
    response_model=ResponseEnvelope[Dict[str, Any]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="AI Industry Alignment & Cognitive Taxonomy Syllabus Benchmark",
)
async def get_syllabus_benchmark(
    subject_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await ai_intelligence_service.get_syllabus_industry_benchmark(
            db=db,
            subject_id=subject_id,
        )
        return ResponseEnvelope(data=data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "/institutional-health-pulse",
    response_model=ResponseEnvelope[Dict[str, Any]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="Real-time Institutional Academic Nervous System Pulse",
)
async def get_institutional_health_pulse(
    db: AsyncSession = Depends(get_db),
):
    data = await ai_intelligence_service.get_institutional_health_pulse(db=db)
    return ResponseEnvelope(data=data)
