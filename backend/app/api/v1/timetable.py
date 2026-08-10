from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission, get_current_token_payload
from app.schemas.common import ResponseEnvelope
from app.schemas.session import (
    RawImportRow, TimetableImportPreviewResponse, TimetableCommitRequest, TimetableResponse
)
from app.services import session_service

router = APIRouter(prefix="/timetable", tags=["Timetable"])


@router.post(
    "/upload",
    response_model=ResponseEnvelope[TimetableImportPreviewResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def preview_upload(
    batch_id: UUID = Body(...),
    raw_rows: List[RawImportRow] = Body(...),
    db: AsyncSession = Depends(get_db),
):
    preview = await session_service.preview_timetable_import(db, batch_id, raw_rows)
    return ResponseEnvelope(data=preview)


@router.post(
    "/commit",
    response_model=ResponseEnvelope[TimetableResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def commit_timetable(
    req: TimetableCommitRequest,
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    timetable = await session_service.commit_timetable_import(db, UUID(user_id_str), req)
    return ResponseEnvelope(data=TimetableResponse.model_validate(timetable))
