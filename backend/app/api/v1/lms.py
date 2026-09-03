import os
import uuid
import mimetypes
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import get_current_user
from app.models.auth import User
from app.models.academic import Subject
from app.models.student import Student
from app.models.activity import SubjectActivity
from app.services.lms_service import lms_service, UPLOAD_DIR
from app.schemas.lms import (
    ResourceCreate, ResourceResponse,
    RecordingCreate, RecordingUpdate, RecordingResponse,
    AssessmentCreate, AssessmentUpdate, AssessmentResponse,
    SubmissionCreate, SubmissionGrade, SubmissionResponse,
    ActivitySubmissionCreate, ActivitySubmissionGrade, ActivitySubmissionResponse,
    SubjectAttendanceResponse, EnrolledSubjectCard
)

router = APIRouter(prefix="/lms", tags=["Learning Management System (LMS)"])

# --- Enrolled Subjects ---
@router.get("/my-subjects", response_model=List[EnrolledSubjectCard])
async def get_my_enrolled_subjects(
    program_id: Optional[uuid.UUID] = Query(None),
    batch_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch enrolled subjects with LMS summary counters and attendance."""
    subjects = await lms_service.get_enrolled_subjects(
        db, current_user, program_id=program_id, batch_id=batch_id
    )
    return subjects


# --- Subject Overview by Code or ID (human-readable URL) ---
@router.get("/subjects/by-code/{subject_code}/overview")
@router.get("/subjects/{subject_code}/overview")
async def get_subject_lms_overview_by_code(
    subject_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregates all 8 LMS categories for a subject looked up by its code, course_code, or ID."""
    from sqlalchemy import select, func, or_
    import uuid as _uuid

    stmt = select(Subject).where(
        or_(
            func.lower(Subject.code) == subject_code.lower(),
            func.lower(Subject.course_code) == subject_code.lower(),
        )
    )
    try:
        val_uuid = _uuid.UUID(subject_code)
        stmt = select(Subject).where(
            or_(
                Subject.id == val_uuid,
                func.lower(Subject.code) == subject_code.lower(),
                func.lower(Subject.course_code) == subject_code.lower(),
            )
        )
    except (ValueError, AttributeError):
        pass

    result = await db.execute(stmt)
    subject = result.scalars().first()
    if not subject:
        raise HTTPException(status_code=404, detail=f"Subject with identifier '{subject_code}' not found")
    return await _get_subject_lms_data(db, subject, current_user)


async def _get_subject_lms_data(db: AsyncSession, subject: Subject, current_user):
    """Shared logic: aggregate all 8 LMS categories for a given Subject ORM object."""
    subject_id = subject.id

    is_student = any(r.name == "student" for r in current_user.roles) and not any(
        r.name in ["crc_admin", "crc_coordinator"] for r in current_user.roles
    )
    student = await lms_service.get_student_by_user(db, current_user) if is_student else None

    from app.services.activity_service import activity_service
    activities_raw = await activity_service.list_activities(
        db, subject_id, is_student=is_student, current_user_id=current_user.id if is_student else None
    )

    activities_out = []
    for act in activities_raw:
        act_dict = {
            "id": act.id,
            "activity_no": act.activity_no,
            "title": act.title,
            "unit_mapping": act.unit_mapping,
            "estimated_time": act.estimated_time,
            "mode": act.mode,
            "file_naming": act.file_naming,
            "why_this_activity": act.why_this_activity,
            "instructions": act.instructions,
            "ai_tools": act.ai_tools,
            "learning_outcomes": act.learning_outcomes,
            "submission_requirements": act.submission_requirements,
            "rubric": act.rubric,
            "is_released": act.is_released,
            "case_study_id": act.case_study_id,
            "case_studies": act.case_studies or [],
            "my_submission": None,
        }
        if student:
            sub = await lms_service.get_student_activity_submission(db, act.id, student.id)
            if sub:
                act_dict["my_submission"] = {
                    "id": sub.id,
                    "submission_text": sub.submission_text,
                    "file_url": sub.file_url,
                    "file_name": sub.file_name,
                    "file_size": sub.file_size,
                    "files": sub.files,
                    "ai_verification_notes": sub.ai_verification_notes,
                    "ai_evaluation": sub.ai_evaluation,
                    "submitted_at": sub.submitted_at,
                    "status": sub.status,
                    "grade": sub.grade,
                    "score": sub.score,
                    "feedback": sub.feedback,
                }
        activities_out.append(act_dict)

    resources_raw = await lms_service.list_resources(db, subject_id, is_student=is_student)
    resources_out = [
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "resource_type": r.resource_type,
            "file_url": r.file_url,
            "file_name": r.file_name,
            "file_size": r.file_size,
            "external_link": r.external_link,
            "unit_number": r.unit_number,
            "is_published": r.is_published,
            "uploaded_by_name": r.uploaded_by.full_name if r.uploaded_by else None,
            "created_at": r.created_at,
        }
        for r in resources_raw
    ]

    recordings_raw = await lms_service.list_recordings(db, subject_id, is_student=is_student)
    assessments_raw = await lms_service.list_assessments(db, subject_id, current_user, is_student=is_student)

    att_summary = None
    if student:
        att_summary = await lms_service.get_student_subject_attendance(db, subject_id, student.id)

    return {
        "subject": {
            "id": subject.id,
            "name": subject.name,
            "code": subject.code,
            "course_code": subject.course_code,
            "course_category": subject.course_category,
            "elective_domain": subject.elective_domain,
            "total_hours": subject.total_hours,
            "trimester": subject.trimester,
            "credits": subject.credits,
            "is_non_credit": subject.is_non_credit,
            "syllabus": subject.syllabus,
            "session_plan": subject.session_plan,
            "programs": [{"id": p.id, "name": p.name, "code": p.code} for p in subject.programs] if subject.programs else [],
        },
        "activities": activities_out,
        "resources": resources_out,
        "recordings": recordings_raw,
        "assessments": assessments_raw,
        "attendance": att_summary,
        "is_student": is_student,
    }


# --- Comprehensive Subject Overview ---
@router.get("/subjects/{subject_id}/overview")
async def get_subject_lms_overview(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Aggregates all 8 LMS categories for a specific subject (by UUID)."""
    subject = await db.get(Subject, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return await _get_subject_lms_data(db, subject, current_user)


# --- File Upload & Streaming ---
@router.post("/files/upload")
async def upload_lms_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Upload a file to the LMS directory using 64KB chunked streaming."""
    try:
        result = await lms_service.save_uploaded_file(file)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"File upload failed: {str(e)}")


@router.get("/files/view")
async def view_lms_file(file: str):
    """View uploaded file in browser from R2 or local storage."""
    from app.services.storage_service import storage_service
    safe_filename = os.path.basename(file)
    try:
        data = await storage_service.read_file_bytes(f"lms/{safe_filename}")
    except FileNotFoundError:
        try:
            data = await storage_service.read_file_bytes(file)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="File not found")

    content_type, _ = mimetypes.guess_type(safe_filename)
    clean_display_name = safe_filename.split("_", 1)[1] if "_" in safe_filename and len(safe_filename.split("_", 1)[0]) == 32 else safe_filename
    return Response(
        content=data,
        media_type=content_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{clean_display_name}"', "Cache-Control": "public, max-age=86400"}
    )


@router.get("/files/download")
async def download_lms_file(file: str):
    """Download uploaded file from R2 or local storage."""
    from app.services.storage_service import storage_service
    safe_filename = os.path.basename(file)
    try:
        data = await storage_service.read_file_bytes(f"lms/{safe_filename}")
    except FileNotFoundError:
        try:
            data = await storage_service.read_file_bytes(file)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="File not found")

    clean_display_name = safe_filename.split("_", 1)[1] if "_" in safe_filename and len(safe_filename.split("_", 1)[0]) == 32 else safe_filename
    return Response(
        content=data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{clean_display_name}"', "Cache-Control": "public, max-age=86400"}
    )


# --- Session Plan View & Download (LMS, accessible to enrolled users) ---
import json as _json

def _resolve_session_plan_file(subject: Subject):
    """Parse session_plan JSON and return (file_path, file_name, file_type) or raise 404."""
    if not subject or not subject.session_plan:
        raise HTTPException(status_code=404, detail="No session plan found for this subject")
    if not subject.session_plan.strip().startswith("{"):
        raise HTTPException(status_code=400, detail="Session plan is stored as plain text, not a file")
    try:
        sp_data = _json.loads(subject.session_plan)
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed session plan metadata")
    file_path = sp_data.get("file_path")
    file_name = sp_data.get("file_name", f"{subject.code}_Session_Plan")
    file_type = sp_data.get("file_type", "")
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Session plan file not found on disk")
    return file_path, file_name, file_type


@router.get("/subjects/{subject_id}/session-plan/view")
async def lms_view_session_plan(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Serve session plan file inline for in-browser viewing (LMS, all enrolled users)."""
    subject = await db.get(Subject, subject_id)
    file_path, file_name, file_type = _resolve_session_plan_file(subject)
    media_types = {
        "pdf": "application/pdf",
        "txt": "text/plain; charset=utf-8",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc": "application/msword",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xls": "application/vnd.ms-excel",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }
    m_type = media_types.get(file_type.lower(), "application/octet-stream")
    return FileResponse(
        path=file_path,
        media_type=m_type,
        headers={"Content-Disposition": f"inline; filename=\"{file_name}\""},
    )


@router.get("/subjects/{subject_id}/session-plan/download")
async def lms_download_session_plan(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download session plan file (LMS, all enrolled users)."""
    subject = await db.get(Subject, subject_id)
    file_path, file_name, _ = _resolve_session_plan_file(subject)
    return FileResponse(
        path=file_path,
        media_type="application/octet-stream",
        filename=file_name,
    )



@router.get("/subjects/{subject_id}/resources", response_model=List[ResourceResponse])
async def get_subject_resources(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_student = any(r.name == "student" for r in current_user.roles) and not any(
        r.name in ["crc_admin", "crc_coordinator"] for r in current_user.roles
    )
    return await lms_service.list_resources(db, subject_id, is_student=is_student)


@router.post("/subjects/{subject_id}/resources", response_model=ResourceResponse)
async def create_subject_resource(
    subject_id: uuid.UUID,
    payload: ResourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await lms_service.create_resource(db, subject_id, payload, current_user.id)


@router.delete("/resources/{resource_id}")
async def delete_subject_resource(
    resource_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = await lms_service.delete_resource(db, resource_id)
    if not success:
        raise HTTPException(status_code=404, detail="Resource not found")
    return {"message": "Resource deleted successfully"}


# --- Recordings Endpoints ---
@router.get("/subjects/{subject_id}/recordings", response_model=List[RecordingResponse])
async def get_subject_recordings(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_student = any(r.name == "student" for r in current_user.roles) and not any(
        r.name in ["crc_admin", "crc_coordinator"] for r in current_user.roles
    )
    return await lms_service.list_recordings(db, subject_id, is_student=is_student)


@router.post("/subjects/{subject_id}/recordings", response_model=RecordingResponse)
async def create_subject_recording(
    subject_id: uuid.UUID,
    payload: RecordingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await lms_service.create_recording(db, subject_id, payload)


@router.put("/recordings/{recording_id}", response_model=RecordingResponse)
async def update_subject_recording(
    recording_id: uuid.UUID,
    payload: RecordingUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rec = await lms_service.update_recording(db, recording_id, payload)
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    return rec


@router.delete("/recordings/{recording_id}")
async def delete_subject_recording(
    recording_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = await lms_service.delete_recording(db, recording_id)
    if not success:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"message": "Recording deleted successfully"}


# --- Assessments Endpoints ---
@router.get("/subjects/{subject_id}/assessments")
async def get_subject_assessments(
    subject_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    is_student = any(r.name == "student" for r in current_user.roles) and not any(
        r.name in ["crc_admin", "crc_coordinator"] for r in current_user.roles
    )
    return await lms_service.list_assessments(db, subject_id, current_user, is_student=is_student)


@router.post("/subjects/{subject_id}/assessments", response_model=AssessmentResponse)
async def create_subject_assessment(
    subject_id: uuid.UUID,
    payload: AssessmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await lms_service.create_assessment(db, subject_id, payload, current_user.id)


@router.put("/assessments/{assessment_id}", response_model=AssessmentResponse)
async def update_subject_assessment(
    assessment_id: uuid.UUID,
    payload: AssessmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ass = await lms_service.update_assessment(db, assessment_id, payload)
    if not ass:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return ass


@router.delete("/assessments/{assessment_id}")
async def delete_subject_assessment(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = await lms_service.delete_assessment(db, assessment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {"message": "Assessment deleted successfully"}


@router.post("/assessments/{assessment_id}/submit", response_model=SubmissionResponse)
async def submit_assessment(
    assessment_id: uuid.UUID,
    payload: SubmissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sub = await lms_service.submit_assessment(db, assessment_id, current_user, payload)
        return sub
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/assessments/{assessment_id}/submissions")
async def get_assessment_submissions(
    assessment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await lms_service.list_assessment_submissions(db, assessment_id)


@router.post("/submissions/{submission_id}/grade", response_model=SubmissionResponse)
async def grade_assessment_submission(
    submission_id: uuid.UUID,
    payload: SubmissionGrade,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = await lms_service.grade_assessment_submission(db, submission_id, payload, current_user.id)
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return sub


# --- HyperBuild Activity Submissions ---
@router.post("/activities/{activity_id}/submit", response_model=ActivitySubmissionResponse)
async def submit_activity(
    activity_id: uuid.UUID,
    payload: ActivitySubmissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        sub = await lms_service.submit_activity(db, activity_id, current_user, payload)
        return sub
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/activities/{activity_id}/submissions")
async def get_activity_submissions(
    activity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await lms_service.list_activity_submissions(db, activity_id)


@router.post("/activity-submissions/{submission_id}/grade", response_model=ActivitySubmissionResponse)
async def grade_activity_submission(
    submission_id: uuid.UUID,
    payload: ActivitySubmissionGrade,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sub = await lms_service.grade_activity_submission(db, submission_id, payload, current_user.id)
    if not sub:
        raise HTTPException(status_code=404, detail="Activity submission not found")
    return sub


@router.post("/activity-submissions/{submission_id}/evaluate", response_model=ActivitySubmissionResponse)
async def reevaluate_activity_submission(
    submission_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-runs the AI first-pass rubric evaluation for a student submission."""
    sub = await lms_service.evaluate_activity_submission(db, submission_id)
    if not sub:
        raise HTTPException(status_code=404, detail="Activity submission not found")
    return sub


@router.post("/activities/{activity_id}/bulk-evaluate")
async def bulk_evaluate_activity_submissions(
    activity_id: uuid.UUID,
    session_id: Optional[uuid.UUID] = Query(None),
    reevaluate_all: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Triggers an asynchronous, rate-limited bulk AI evaluation of submissions for an activity.
    Uses concurrency semaphores to prevent Gemini rate limit throttling.
    """
    from app.services.bulk_evaluator import bulk_evaluator
    return await bulk_evaluator.start_bulk_evaluation(
        activity_id=activity_id,
        session_id=session_id,
        requested_by_user_id=current_user.id,
        reevaluate_all=reevaluate_all,
    )


@router.get("/activities/{activity_id}/evaluation-progress")
async def get_activity_evaluation_progress(
    activity_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
):
    """Retrieves live background progress for the bulk AI evaluation job."""
    from app.services.bulk_evaluator import bulk_evaluator
    prog = bulk_evaluator.get_task_progress(str(activity_id))
    if not prog:
        return {"status": "idle", "activity_id": str(activity_id), "total_submissions": 0, "processed_count": 0}
    return prog



# --- Attendance Summary ---
@router.get("/subjects/{subject_id}/attendance", response_model=SubjectAttendanceResponse)
async def get_subject_attendance(
    subject_id: uuid.UUID,
    student_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not student_id:
        student = await lms_service.get_student_by_user(db, current_user)
        if not student:
            raise HTTPException(status_code=400, detail="Student profile not found or student_id required")
        student_id = student.id

    return await lms_service.get_student_subject_attendance(db, subject_id, student_id)
