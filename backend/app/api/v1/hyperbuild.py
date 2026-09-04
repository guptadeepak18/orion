import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_user, require_role
from app.models.auth import User
from app.schemas.hyperbuild import (
    HyperbuildConfigureRequest,
    HyperbuildSessionDetailResponse,
    HyperbuildChallengeKeyTriggerResponse,
    HyperbuildVerificationRequest,
    HyperbuildVerificationResponse,
    HyperbuildLiveRosterResponse,
    HyperbuildExtendWindowRequest,
    HyperbuildLockWindowRequest,
    HyperbuildReopenWindowRequest,
    HyperbuildWindowActionResponse,
    HyperbuildAuditLogListResponse,
    HyperbuildManualAttendanceUpdateRequest,
    HyperbuildBulkAttendanceUpdateRequest,
)
from app.services.hyperbuild_service import (
    configure_hyperbuild_activities,
    get_hyperbuild_session_details,
    trigger_activity_challenge_key,
    extend_activity_window,
    lock_activity_window,
    reopen_activity_window,
    get_activity_audit_logs,
    verify_student_activity_presence,
    get_activity_live_roster,
    update_activity_student_attendance,
    bulk_update_activity_attendance,
)

router = APIRouter()


@router.post(
    "/sessions/{session_id}/activities",
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]))],
    summary="Configure sequential activities for a HyperBuild session",
)
async def configure_activities_endpoint(
    session_id: uuid.UUID,
    req: HyperbuildConfigureRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await configure_hyperbuild_activities(db, session_id, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/sessions/{session_id}/activities",
    response_model=HyperbuildSessionDetailResponse,
    summary="Get HyperBuild session details, activities, and personalized status",
)
async def get_session_activities_endpoint(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await get_hyperbuild_session_details(db, session_id, current_user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/activities/{activity_id}/trigger-key",
    response_model=HyperbuildChallengeKeyTriggerResponse,
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]))],
    summary="Generate a 60-second live Challenge Key for classroom display",
)
async def trigger_challenge_key_endpoint(
    activity_id: uuid.UUID,
    validity_seconds: int = Query(60, ge=15, le=300),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await trigger_activity_challenge_key(db, activity_id, validity_seconds=validity_seconds, faculty_user=current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/activities/{activity_id}/window/extend",
    response_model=HyperbuildWindowActionResponse,
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]))],
    summary="Extend activity submission window for additional minutes",
)
async def extend_window_endpoint(
    activity_id: uuid.UUID,
    req: HyperbuildExtendWindowRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await extend_activity_window(db, activity_id, current_user, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/activities/{activity_id}/window/lock",
    response_model=HyperbuildWindowActionResponse,
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]))],
    summary="Manually lock activity submission window immediately",
)
async def lock_window_endpoint(
    activity_id: uuid.UUID,
    req: HyperbuildLockWindowRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await lock_activity_window(db, activity_id, current_user, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/activities/{activity_id}/window/reopen",
    response_model=HyperbuildWindowActionResponse,
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]))],
    summary="Reopen locked activity submission window (timed or until manual lock)",
)
async def reopen_window_endpoint(
    activity_id: uuid.UUID,
    req: HyperbuildReopenWindowRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await reopen_activity_window(db, activity_id, current_user, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/activities/{activity_id}/audit-logs",
    response_model=HyperbuildAuditLogListResponse,
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]))],
    summary="Get complete chronological audit logs for an activity's window events",
)
async def get_activity_audit_logs_endpoint(
    activity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await get_activity_audit_logs(db, activity_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/activities/{activity_id}/verify",
    response_model=HyperbuildVerificationResponse,
    summary="Student live laptop verification (Key + Geolocation + Deliverable)",
)
async def verify_activity_endpoint(
    activity_id: uuid.UUID,
    req: HyperbuildVerificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await verify_student_activity_presence(db, activity_id, current_user.id, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/activities/{activity_id}/roster",
    response_model=HyperbuildLiveRosterResponse,
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]))],
    summary="Real-time faculty live roster monitor",
)
async def get_activity_roster_endpoint(
    activity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await get_activity_live_roster(db, activity_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/sessions/{session_id}/activities/{activity_id}/bulk-evaluate",
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]))],
    summary="Trigger rate-limited bulk AI evaluation for a HyperBuild activity in session",
)
async def hyperbuild_bulk_evaluate_endpoint(
    session_id: uuid.UUID,
    activity_id: uuid.UUID,
    reevaluate_all: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.bulk_evaluator import bulk_evaluator
    return await bulk_evaluator.start_bulk_evaluation(
        activity_id=activity_id,
        session_id=session_id,
        requested_by_user_id=current_user.id,
        reevaluate_all=reevaluate_all,
    )


@router.get(
    "/activities/{activity_id}/evaluation-progress",
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]))],
    summary="Poll live progress of background bulk AI evaluation",
)
async def hyperbuild_evaluation_progress_endpoint(
    activity_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    from app.services.bulk_evaluator import bulk_evaluator
    prog = bulk_evaluator.get_task_progress(str(activity_id))
    if not prog:
        return {"status": "idle", "activity_id": str(activity_id), "total_submissions": 0, "processed_count": 0}
    return prog


@router.post(
    "/activities/{activity_id}/attendance",
    response_model=HyperbuildLiveRosterResponse,
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]))],
    summary="Manually update attendance status for a student in a HyperBuild activity/subject",
)
async def update_activity_attendance_endpoint(
    activity_id: uuid.UUID,
    req: HyperbuildManualAttendanceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await update_activity_student_attendance(db, activity_id, current_user, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/activities/{activity_id}/attendance/bulk",
    response_model=HyperbuildLiveRosterResponse,
    dependencies=[Depends(require_role(["crc_admin", "crc_coordinator", "faculty_internal", "faculty_external"]))],
    summary="Bulk update attendance status for students in a HyperBuild activity/subject",
)
async def bulk_update_activity_attendance_endpoint(
    activity_id: uuid.UUID,
    req: HyperbuildBulkAttendanceUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return await bulk_update_activity_attendance(db, activity_id, current_user, req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
