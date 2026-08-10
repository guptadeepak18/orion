from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission
from app.schemas.common import ResponseEnvelope
from app.services import report_service

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get(
    "/remuneration-statement",
    response_model=ResponseEnvelope[List[dict]],
    dependencies=[Depends(require_permission("reports", "view"))],
)
async def get_remuneration_statement(db: AsyncSession = Depends(get_db)):
    data = await report_service.get_remuneration_statement(db)
    return ResponseEnvelope(data=data)


@router.get(
    "/venue-utilization",
    response_model=ResponseEnvelope[List[dict]],
    dependencies=[Depends(require_permission("reports", "view"))],
)
async def get_venue_utilization(db: AsyncSession = Depends(get_db)):
    data = await report_service.get_venue_utilization_matrix(db)
    return ResponseEnvelope(data=data)


@router.get(
    "/syllabus-completion",
    response_model=ResponseEnvelope[List[dict]],
    dependencies=[Depends(require_permission("reports", "view"))],
)
async def get_syllabus_completion(db: AsyncSession = Depends(get_db)):
    data = await report_service.get_syllabus_completion_index(db)
    return ResponseEnvelope(data=data)


@router.get(
    "/audit-trail",
    response_model=ResponseEnvelope[List[dict]],
    dependencies=[Depends(require_permission("reports", "view"))],
)
async def get_audit_trail(db: AsyncSession = Depends(get_db)):
    data = await report_service.get_audit_trail(db)
    return ResponseEnvelope(data=data)


@router.get(
    "/export",
    dependencies=[Depends(require_permission("reports", "export"))],
)
async def export_report(
    report_type: str = Query("remuneration"),
    db: AsyncSession = Depends(get_db)
):
    if report_type == "venue":
        data = await report_service.get_venue_utilization_matrix(db)
    elif report_type == "syllabus":
        data = await report_service.get_syllabus_completion_index(db)
    elif report_type == "audit":
        data = await report_service.get_audit_trail(db)
    else:
        data = await report_service.get_remuneration_statement(db)

    csv_content = await report_service.export_report_to_csv(data)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=report_{report_type}.csv"}
    )
