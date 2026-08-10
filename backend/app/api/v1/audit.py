from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_role
from app.schemas.common import ResponseEnvelope, MetaSchema
from app.schemas.audit import AuditLogResponse
from app.services import audit_service

router = APIRouter(prefix="/audit", tags=["Audit Trail"])


@router.get(
    "",
    response_model=ResponseEnvelope[List[AuditLogResponse]],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def get_audit_trail(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    logs = await audit_service.list_audit_logs(db, page=page, page_size=page_size)
    responses = [AuditLogResponse.model_validate(l) for l in logs]
    meta = MetaSchema(page=page, page_size=page_size, total_count=len(logs))
    return ResponseEnvelope(data=responses, meta=meta)
