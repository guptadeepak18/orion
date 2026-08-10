from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission
from app.schemas.common import ResponseEnvelope
from app.schemas.engagement import EngagementCreate, EngagementResponse
from app.services import engagement_service

router = APIRouter(prefix="/engagements", tags=["Engagements"])


@router.post(
    "",
    response_model=ResponseEnvelope[EngagementResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("remuneration", "edit"))],
)
async def create_engagement(e_in: EngagementCreate, db: AsyncSession = Depends(get_db)):
    try:
        eng = await engagement_service.create_engagement(db, e_in)
        return ResponseEnvelope(data=EngagementResponse.model_validate(eng))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get(
    "",
    response_model=ResponseEnvelope[List[EngagementResponse]],
    dependencies=[Depends(require_permission("remuneration", "view"))],
)
async def list_engagements(
    faculty_external_id: Optional[UUID] = Query(None),
    approval_status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    engs = await engagement_service.list_engagements(db, faculty_external_id, approval_status)
    return ResponseEnvelope(data=[EngagementResponse.model_validate(e) for e in engs])
