from datetime import date
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status, Request, BackgroundTasks
from sqlalchemy import select
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
async def create_session(
    request: Request,
    s_in: SessionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # DEBUG: Log raw request body to diagnose UUID validation issues
    try:
        raw_body = await request.body()
        logger.warning(f"[DEBUG] POST /sessions raw body: {raw_body.decode('utf-8', errors='replace')}")
    except Exception:
        pass
    try:
        session = await session_service.create_session(db, s_in, background_tasks=background_tasks)
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
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    roles = payload.get("roles", [])
    is_admin = any(r in ["crc_admin", "crc_coordinator"] for r in roles)
    is_faculty = any(r in ["faculty_internal", "faculty_external"] for r in roles)
    
    # Check if user is a student and try to force their batch_id
    from app.models.student import Student
    from sqlalchemy import select
    
    if not is_admin and not is_faculty and not batch_id and user_id:
        student_res = await db.execute(select(Student).where(Student.user_id == user_id))
        student = student_res.scalar_one_or_none()
        if student:
            batch_id = student.batch_id

    fac_id = None
    fac_type = None
    allocated_pairs = None

    if is_faculty and not is_admin and user_id:
        from app.services.attendance_service import get_faculty_profile_id_by_user_id
        from app.models.academic import SubjectBatch
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, user_id)
        if fac_id:
            if fac_type == "internal":
                alloc_stmt = select(SubjectBatch.subject_id, SubjectBatch.batch_id).where(
                    SubjectBatch.faculty_internal_id == fac_id, SubjectBatch.status == "active"
                )
            else:
                alloc_stmt = select(SubjectBatch.subject_id, SubjectBatch.batch_id).where(
                    SubjectBatch.faculty_external_id == fac_id, SubjectBatch.status == "active"
                )
            alloc_res = await db.execute(alloc_stmt)
            allocated_pairs = alloc_res.all()

    sessions = await session_service.list_sessions(
        db,
        batch_id=batch_id,
        session_date=session_date,
        status=status,
        faculty_id=fac_id,
        faculty_type=fac_type,
        allocated_pairs=allocated_pairs,
    )
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
async def get_session_attendance(
    session_id: UUID,
    payload=Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id = UUID(payload.get("sub")) if payload.get("sub") else None
    roles = payload.get("roles", [])
    is_admin = any(r in ["crc_admin", "crc_coordinator"] for r in roles)
    is_faculty = any(r in ["faculty_internal", "faculty_external"] for r in roles)

    if is_faculty and not is_admin and user_id:
        from app.services.attendance_service import get_faculty_profile_id_by_user_id
        from app.models.academic import SubjectBatch
        from app.models.session import Session as SessionModel
        sess = (await db.execute(select(SessionModel).where(SessionModel.id == session_id))).scalar_one_or_none()
        if not sess:
            raise HTTPException(status_code=404, detail="Session not found")
        fac_id, fac_type = await get_faculty_profile_id_by_user_id(db, user_id)
        if not fac_id:
            raise HTTPException(status_code=403, detail="Faculty profile not found")

        is_assigned = (fac_type == "internal" and sess.faculty_internal_id == fac_id) or (fac_type == "external" and sess.faculty_external_id == fac_id)
        if not is_assigned and sess.subject_id:
            alloc_stmt = select(SubjectBatch).where(SubjectBatch.subject_id == sess.subject_id, SubjectBatch.status == "active")
            if fac_type == "internal":
                alloc_stmt = alloc_stmt.where(SubjectBatch.faculty_internal_id == fac_id)
            else:
                alloc_stmt = alloc_stmt.where(SubjectBatch.faculty_external_id == fac_id)
            if sess.batch_id:
                alloc_stmt = alloc_stmt.where(SubjectBatch.batch_id == sess.batch_id)
            if (await db.execute(alloc_stmt)).scalars().first():
                is_assigned = True
        if not is_assigned:
            raise HTTPException(status_code=403, detail="Access denied: You are not assigned to this session.")

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
        roles = payload.get("roles", [])
        sheet = await session_service.mark_session_attendance(db, session_id, req, user_id, user_roles=roles)
        return ResponseEnvelope(data=sheet)
    except ValueError as e:
        status_code = status.HTTP_403_FORBIDDEN if "Unauthorized" in str(e) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=status_code, detail=str(e))



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


@router.post(
    "/{session_id}/notify",
    dependencies=[Depends(require_permission("academic", "edit"))],
    summary="Dispatch or re-send email notifications to enrolled students and faculty for this session",
)
async def notify_session_endpoint(
    session_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    payload=Depends(get_current_token_payload),
):
    from app.models.session import Session as SessionModel
    stmt = select(SessionModel).where(SessionModel.id == session_id, SessionModel.is_deleted == False)
    res = await db.execute(stmt)
    sess = res.scalar_one_or_none()
    if not sess:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    background_tasks.add_task(session_service.notify_session_students, session_id, None, "class_session_scheduled", None, True)
    return ResponseEnvelope(
        data={
            "session_id": str(session_id),
            "status": "queued",
            "message": "Successfully initiated timetable notification email dispatch to enrolled students and faculty.",
        }
    )



