from datetime import date
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission, get_current_token_payload
from app.schemas.common import ResponseEnvelope
from app.schemas.session import (
    SessionCreate, SessionUpdate, SessionResponse, SessionBulkEditRequest,
    SessionAttendanceBulkRequest, SessionAttendanceSheetResponse, StudentAttendanceRecordResponse
)
from app.services import session_service
from app.agents.scheduler_sentinel import SchedulerConflictException
from app.agents.faculty_compliance_agent import FacultyComplianceException

router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.post(
    "",
    response_model=ResponseEnvelope[SessionResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_session(s_in: SessionCreate, db: AsyncSession = Depends(get_db)):
    try:
        session = await session_service.create_session(db, s_in)
        return ResponseEnvelope(data=SessionResponse.model_validate(session))
    except FacultyComplianceException as fe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(fe),
        )
    except SchedulerConflictException as ce:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": ce.message,
                "conflict_type": ce.conflict_type,
                "details": ce.details,
                "alternate_slots": ce.alternate_slots,
            },
        )


@router.get(
    "",
    response_model=ResponseEnvelope[List[SessionResponse]],
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def list_sessions(
    batch_id: Optional[UUID] = Query(None),
    session_date: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    sessions = await session_service.list_sessions(db, batch_id, session_date, status)
    return ResponseEnvelope(data=sessions)


@router.put(
    "/{session_id}",
    response_model=ResponseEnvelope[SessionResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_session(
    session_id: UUID, s_in: SessionUpdate, db: AsyncSession = Depends(get_db)
):
    try:
        session = await session_service.update_session(db, session_id, s_in)
        return ResponseEnvelope(data=SessionResponse.model_validate(session))
    except SchedulerConflictException as ce:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": ce.message,
                "conflict_type": ce.conflict_type,
                "details": ce.details,
                "alternate_slots": ce.alternate_slots,
            },
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/bulk-edit",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def bulk_edit_sessions(
    req: SessionBulkEditRequest, db: AsyncSession = Depends(get_db)
):
    updated_count = await session_service.bulk_edit_sessions(db, req)
    return ResponseEnvelope(data={"updated_count": updated_count})


@router.get(
    "/{session_id}/attendance",
    response_model=ResponseEnvelope[SessionAttendanceSheetResponse],
    dependencies=[Depends(require_permission("academic", "view"))],
    summary="Get attendance sheet for a session",
)
async def get_session_attendance(session_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        sheet = await session_service.get_session_attendance_sheet(db, session_id)
        return ResponseEnvelope(data=sheet)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/{session_id}/attendance",
    response_model=ResponseEnvelope[SessionAttendanceSheetResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
    summary="Mark/update attendance for a session",
)
async def mark_session_attendance(
    session_id: UUID,
    req: SessionAttendanceBulkRequest,
    payload=Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    try:
        from uuid import UUID as _UUID
        user_id = _UUID(payload.get("sub")) if payload.get("sub") else None
        sheet = await session_service.mark_session_attendance(db, session_id, req, user_id)
        return ResponseEnvelope(data=sheet)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

