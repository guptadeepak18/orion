from datetime import date
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
import logging

from app.core.database import get_db
from app.core.permissions import require_permission, require_role, get_current_token_payload
from app.schemas.common import ResponseEnvelope
from app.schemas.session import (
    SessionCreate, SessionUpdate, SessionResponse, SessionBulkEditRequest,
    SessionAttendanceBulkRequest, SessionAttendanceSheetResponse, StudentAttendanceRecordResponse,
    SessionVarianceRecordRequest, TimetableVarianceSummaryResponse
)
from app.services import session_service
from app.agents.scheduler_sentinel import SchedulerConflictException
from app.agents.faculty_compliance_agent import FacultyComplianceException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["Sessions"])

STAFF_ROLES = ["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external", "finance", "approver", "reporting_readonly"]
FACULTY_ADMIN_ROLES = ["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]


@router.post(
    "",
    response_model=ResponseEnvelope[SessionResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_session(request: Request, s_in: SessionCreate, db: AsyncSession = Depends(get_db)):
    # DEBUG: Log raw request body to diagnose UUID validation issues
    try:
        raw_body = await request.body()
        logger.warning(f"[DEBUG] POST /sessions raw body: {raw_body.decode('utf-8', errors='replace')}")
    except Exception:
        pass
    try:
        session = await session_service.create_session(db, s_in)
        resp = await session_service.format_single_session_response(db, session.id)
        return ResponseEnvelope(data=resp)
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
    dependencies=[Depends(get_current_token_payload)],
)
async def list_sessions(
    batch_id: Optional[UUID] = Query(None),
    session_date: Optional[date] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    payload=Depends(get_current_token_payload),
):
    # Smart Guard: Resolve batch_id if student is accessing
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    
    # Check if user is a student and try to force their batch_id
    from app.models.student import Student
    from sqlalchemy import select
    
    if not batch_id and user_id:
        student_res = await db.execute(select(Student).where(Student.user_id == user_id))
        student = student_res.scalar_one_or_none()
        if student:
            batch_id = student.batch_id

    sessions = await session_service.list_sessions(db, batch_id, session_date, status)
    return ResponseEnvelope(data=sessions)


@router.get(
    "/next-lecture-number",
    dependencies=[Depends(get_current_token_payload)],
)
async def get_next_lecture_number_endpoint(
    batch_id: Optional[str] = Query(None),
    subject_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if not batch_id or not subject_id or not batch_id.strip() or not subject_id.strip():
        return ResponseEnvelope(data={"next_lecture_number": 1})
    try:
        b_uuid = UUID(batch_id.strip())
        s_uuid = UUID(subject_id.strip())
    except (ValueError, TypeError, AttributeError):
        return ResponseEnvelope(data={"next_lecture_number": 1})
    next_num = await session_service.get_next_lecture_number(db, b_uuid, s_uuid)
    return ResponseEnvelope(data={"next_lecture_number": next_num})


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
        resp = await session_service.format_single_session_response(db, session.id)
        return ResponseEnvelope(data=resp)
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
    except Exception as e:
        logger.error(f"Error updating session {session_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


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


@router.delete(
    "/{session_id}",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("academic", "edit"))],
    summary="Delete scheduled session (Admin and Coordinators)",
)
async def delete_session(session_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        await session_service.delete_session(db, session_id)
        return ResponseEnvelope(data={"deleted": True, "session_id": str(session_id)})
    except ValueError as e:
        # If already deleted or not found, return clean response so UI stays in sync
        return ResponseEnvelope(data={"deleted": True, "session_id": str(session_id), "note": str(e)})



@router.get(
    "/{session_id}/attendance",
    response_model=ResponseEnvelope[SessionAttendanceSheetResponse],
    dependencies=[Depends(require_role(STAFF_ROLES))],
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
    dependencies=[Depends(require_role(FACULTY_ADMIN_ROLES))],
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



@router.get(
    "/variance-analytics",
    response_model=ResponseEnvelope[TimetableVarianceSummaryResponse],
    dependencies=[Depends(require_role(STAFF_ROLES))],
    summary="Get comprehensive Timetable Variance & Plan vs Actual Analytics",
)
async def get_timetable_variance_analytics(
    program_id: Optional[UUID] = Query(None),
    batch_id: Optional[UUID] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    subject_id: Optional[UUID] = Query(None),
    faculty_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    try:
        report = await session_service.get_timetable_variance_analytics(
            db=db,
            program_id=program_id,
            batch_id=batch_id,
            start_date=start_date,
            end_date=end_date,
            subject_id=subject_id,
            faculty_id=faculty_id,
        )
        return ResponseEnvelope(data=report)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post(
    "/{session_id}/variance",
    response_model=ResponseEnvelope[SessionResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
    summary="Record Real-Time Variance (Substitution, Swap, Cancellation, Revert)",
)
async def record_session_variance(
    session_id: UUID,
    req: SessionVarianceRecordRequest,
    payload=Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_id = UUID(payload.get("sub")) if payload.get("sub") else None
        session = await session_service.record_session_variance(
            db=db,
            session_id=session_id,
            req=req,
            current_user_id=user_id,
        )
        return ResponseEnvelope(data=session)
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
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


