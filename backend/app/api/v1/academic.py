import io
import os
import json
import re
from datetime import datetime, timezone
from typing import List, Optional
import uuid
from uuid import UUID
from fastapi import APIRouter, Depends, Query, status, HTTPException, UploadFile, File, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings

from app.core.database import get_db
from app.core.permissions import require_permission
from app.schemas.common import ResponseEnvelope
from app.schemas.academic import (
    ProgramCreate, ProgramUpdate, ProgramResponse,
    AcademicYearCreate, AcademicYearResponse,
    SemesterCreate, SemesterResponse,
    BatchCreate, BatchUpdate, BatchResponse,
    SubjectCreate, SubjectUpdate, SubjectResponse,
    TopicCreate, TopicUpdate, TopicResponse,
    DivisionCreate, DivisionUpdate, DivisionResponse,
    FacultySubjectAllocationCreate, FacultySubjectAllocationUpdate, FacultySubjectAllocationResponse,
)
from app.schemas.student import StudentResponse
from app.services import academic_service, student_service, syllabus_parser_service, syllabus_export_service

router = APIRouter(prefix="/academic", tags=["Academic"])


class BatchStudentAssignRequest(BaseModel):
    student_ids: List[UUID]
    assign: bool = True  # True = assign to batch, False = remove from batch


# Programs
@router.post(
    "/programs",
    response_model=ResponseEnvelope[ProgramResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_program(p_in: ProgramCreate, db: AsyncSession = Depends(get_db)):
    program = await academic_service.create_program(db, p_in)
    return ResponseEnvelope(data=ProgramResponse.model_validate(program))


@router.get(
    "/programs",
    response_model=ResponseEnvelope[List[ProgramResponse]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
)
async def list_programs(db: AsyncSession = Depends(get_db)):
    programs = await academic_service.list_programs(db)
    return ResponseEnvelope(data=[ProgramResponse.model_validate(p) for p in programs])


@router.put(
    "/programs/{program_id}",
    response_model=ResponseEnvelope[ProgramResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_program(
    program_id: UUID, p_in: ProgramUpdate, db: AsyncSession = Depends(get_db)
):
    program = await academic_service.update_program(db, program_id, p_in)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    return ResponseEnvelope(data=ProgramResponse.model_validate(program))


@router.delete(
    "/programs/{program_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_program(program_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await academic_service.delete_program(db, program_id)
    if not success:
        raise HTTPException(status_code=404, detail="Program not found")
    return ResponseEnvelope(data={"deleted": True})


# Academic Years
@router.post(
    "/academic-years",
    response_model=ResponseEnvelope[AcademicYearResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_academic_year(ay_in: AcademicYearCreate, db: AsyncSession = Depends(get_db)):
    ay = await academic_service.create_academic_year(db, ay_in)
    return ResponseEnvelope(data=AcademicYearResponse.model_validate(ay))


@router.get(
    "/academic-years",
    response_model=ResponseEnvelope[List[AcademicYearResponse]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
)
async def list_academic_years(db: AsyncSession = Depends(get_db)):
    years = await academic_service.list_academic_years(db)
    return ResponseEnvelope(data=[AcademicYearResponse.model_validate(y) for y in years])


# Semesters
@router.post(
    "/semesters",
    response_model=ResponseEnvelope[SemesterResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_semester(sem_in: SemesterCreate, db: AsyncSession = Depends(get_db)):
    sem = await academic_service.create_semester(db, sem_in)
    return ResponseEnvelope(data=SemesterResponse.model_validate(sem))


@router.get(
    "/semesters",
    response_model=ResponseEnvelope[List[SemesterResponse]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
)
async def list_semesters(
    program_id: Optional[UUID] = Query(None), db: AsyncSession = Depends(get_db)
):
    sems = await academic_service.list_semesters(db, program_id)
    return ResponseEnvelope(data=[SemesterResponse.model_validate(s) for s in sems])


# Batches
@router.post(
    "/batches",
    response_model=ResponseEnvelope[BatchResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_batch(b_in: BatchCreate, db: AsyncSession = Depends(get_db)):
    batch = await academic_service.create_batch(db, b_in)
    return ResponseEnvelope(data=BatchResponse.model_validate(batch))


@router.get(
    "/batches",
    response_model=ResponseEnvelope[List[BatchResponse]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
)
async def list_batches(
    program_id: Optional[UUID] = Query(None), db: AsyncSession = Depends(get_db)
):
    batches = await academic_service.list_batches(db, program_id)
    return ResponseEnvelope(data=[BatchResponse.model_validate(b) for b in batches])


@router.put(
    "/batches/{batch_id}",
    response_model=ResponseEnvelope[BatchResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_batch(
    batch_id: UUID, b_in: BatchUpdate, db: AsyncSession = Depends(get_db)
):
    batch = await academic_service.update_batch(db, batch_id, b_in)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return ResponseEnvelope(data=BatchResponse.model_validate(batch))


@router.delete(
    "/batches/{batch_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_batch(batch_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await academic_service.delete_batch(db, batch_id)
    if not success:
        raise HTTPException(status_code=404, detail="Batch not found")
    return ResponseEnvelope(data={"deleted": True})


# Subjects
@router.post(
    "/subjects",
    response_model=ResponseEnvelope[SubjectResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_subject(sub_in: SubjectCreate, db: AsyncSession = Depends(get_db)):
    subject = await academic_service.create_subject(db, sub_in)
    return ResponseEnvelope(data=SubjectResponse.model_validate(subject))


@router.get(
    "/subjects",
    response_model=ResponseEnvelope[List[SubjectResponse]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
)
async def list_subjects(
    batch_id: Optional[UUID] = Query(None),
    program_id: Optional[UUID] = Query(None),
    trimester: Optional[int] = Query(None),
    is_archived: Optional[bool] = Query(False),
    db: AsyncSession = Depends(get_db),
):
    subjects = await academic_service.list_subjects(
        db, batch_id=batch_id, program_id=program_id, trimester=trimester, is_archived=is_archived
    )
    return ResponseEnvelope(data=[SubjectResponse.model_validate(s) for s in subjects])


@router.post(
    "/subjects/{subject_id}/archive",
    response_model=ResponseEnvelope[SubjectResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def archive_subject(subject_id: UUID, db: AsyncSession = Depends(get_db)):
    subject = await academic_service.archive_subject(db, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return ResponseEnvelope(data=SubjectResponse.model_validate(subject))


@router.post(
    "/subjects/{subject_id}/unarchive",
    response_model=ResponseEnvelope[SubjectResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def unarchive_subject(subject_id: UUID, db: AsyncSession = Depends(get_db)):
    subject = await academic_service.unarchive_subject(db, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return ResponseEnvelope(data=SubjectResponse.model_validate(subject))


@router.post(
    "/subjects/parse-syllabus-file",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def parse_syllabus_file_endpoint(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    try:
        data = syllabus_parser_service.parse_syllabus_file(content, file.filename)
        return ResponseEnvelope(data=data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Error parsing syllabus document: {str(e)}")


@router.get(
    "/subjects/{subject_id}/syllabus/export",
    dependencies=[Depends(require_permission("academic", "view_own"))],
)
async def export_subject_syllabus(
    subject_id: UUID,
    format: str = Query("docx", regex="^(docx|pdf)$"),
    db: AsyncSession = Depends(get_db),
):
    subject = await academic_service.get_subject(db, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    # Helper to parse stored syllabus JSON or build default
    syllabus_data = {}
    if subject.syllabus:
        try:
            if subject.syllabus.startswith('{'):
                import json
                syllabus_data = json.loads(subject.syllabus)
            else:
                syllabus_data = {"course_overview": subject.syllabus}
        except Exception:
            syllabus_data = {"course_overview": subject.syllabus}

    credits_info = "Non-Credit" if subject.is_non_credit else f"{subject.credits} Credits"

    filename = f"{subject.code}_Syllabus.{format}"
    safe_filename = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', filename)

    if format == "pdf":
        pdf_bytes = syllabus_export_service.generate_syllabus_pdf(subject.name, subject.code, credits_info, syllabus_data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
        )
    else:
        docx_bytes = syllabus_export_service.generate_syllabus_docx(subject.name, subject.code, credits_info, syllabus_data)
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
        )


# ─── Session Plan File Upload, View, & Download Endpoints ─────────────────────

@router.post(
    "/subjects/{subject_id}/session-plan/upload",
    response_model=ResponseEnvelope[SubjectResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def upload_subject_session_plan_file(
    subject_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    subject = await academic_service.get_subject(db, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    # Save file to uploads/session_plans
    upload_dir = os.path.join(settings.FILE_STORAGE_PATH, "session_plans")
    os.makedirs(upload_dir, exist_ok=True)

    safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', file.filename)
    filename = f"{subject_id}_{safe_name}"
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, "wb") as f:
        f.write(content)

    ext = os.path.splitext(file.filename)[1].lower().replace('.', '')
    
    # Extract text preview if docx/pdf/txt
    extracted_text = ""
    if ext == "docx":
        try:
            import docx
            doc = docx.Document(io.BytesIO(content))
            extracted_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        except Exception:
            extracted_text = ""
    elif ext == "pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            extracted_text = "\n".join([page.extract_text() or "" for page in reader.pages])
        except Exception:
            extracted_text = ""
    elif ext in ["txt", "csv", "json"]:
        try:
            extracted_text = content.decode("utf-8", errors="ignore")
        except Exception:
            extracted_text = ""

    sp_metadata = {
        "file_name": file.filename,
        "saved_filename": filename,
        "file_path": file_path,
        "file_type": ext,
        "file_size": len(content),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "extracted_text": extracted_text[:10000] if extracted_text else "",
    }

    # Update subject.session_plan JSON
    updated_subject = await academic_service.update_subject(
        db, subject_id, SubjectUpdate(session_plan=json.dumps(sp_metadata))
    )
    return ResponseEnvelope(data=SubjectResponse.model_validate(updated_subject))


@router.get(
    "/subjects/{subject_id}/session-plan/download",
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def download_subject_session_plan_file(
    subject_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    subject = await academic_service.get_subject(db, subject_id)
    if not subject or not subject.session_plan:
        raise HTTPException(status_code=404, detail="No session plan found for this subject")

    try:
        sp_data = json.loads(subject.session_plan) if subject.session_plan.startswith('{') else {}
        file_path = sp_data.get("file_path")
        file_name = sp_data.get("file_name", f"{subject.code}_Session_Plan")
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Session plan file not found on disk")
        return FileResponse(
            path=file_path,
            filename=file_name,
            media_type="application/octet-stream",
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Error accessing session plan file: {str(e)}")


@router.get(
    "/subjects/{subject_id}/session-plan/view",
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def view_subject_session_plan_file(
    subject_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    subject = await academic_service.get_subject(db, subject_id)
    if not subject or not subject.session_plan:
        raise HTTPException(status_code=404, detail="No session plan found for this subject")

    try:
        sp_data = json.loads(subject.session_plan) if subject.session_plan.startswith('{') else {}
        file_path = sp_data.get("file_path")
        file_type = sp_data.get("file_type", "")
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Session plan file not found on disk")

        media_types = {
            "pdf": "application/pdf",
            "txt": "text/plain",
            "json": "application/json",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "doc": "application/msword",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
        m_type = media_types.get(file_type, "application/octet-stream")
        return FileResponse(path=file_path, media_type=m_type)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=f"Error reading session plan file: {str(e)}")


@router.delete(
    "/subjects/{subject_id}/session-plan/file",
    response_model=ResponseEnvelope[SubjectResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_subject_session_plan_file(
    subject_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    subject = await academic_service.get_subject(db, subject_id)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    if subject.session_plan and subject.session_plan.startswith('{'):
        try:
            sp_data = json.loads(subject.session_plan)
            file_path = sp_data.get("file_path")
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            pass

    updated_subject = await academic_service.update_subject(
        db, subject_id, SubjectUpdate(session_plan=None)
    )
    return ResponseEnvelope(data=SubjectResponse.model_validate(updated_subject))


# ─── Case Study Document Upload & Download Endpoints ─────────────────────────

@router.post(
    "/case-studies/upload-file",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def upload_case_study_file(
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    upload_dir = os.path.join(settings.FILE_STORAGE_PATH, "case_studies")
    os.makedirs(upload_dir, exist_ok=True)

    file_id = uuid.uuid4().hex[:12]
    clean_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', file.filename)
    stored_filename = f"{file_id}_{clean_name}"
    file_path = os.path.join(upload_dir, stored_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    ext = os.path.splitext(file.filename)[1].lower().replace('.', '')

    return ResponseEnvelope(
        data={
            "file_url": f"/academic/case-studies/files/{stored_filename}",
            "file_name": file.filename,
            "file_size": len(content),
            "file_type": ext,
            "stored_filename": stored_filename,
        }
    )


@router.get(
    "/case-studies/files/{filename}",
    dependencies=[Depends(require_permission("academic", "view_own"))],
)
async def download_case_study_file(
    filename: str,
    original_name: Optional[str] = Query(None),
):
    upload_dir = os.path.join(settings.FILE_STORAGE_PATH, "case_studies")
    file_path = os.path.join(upload_dir, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Case study document not found on server")

    download_name = original_name or filename
    safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', download_name)

    ext = os.path.splitext(filename)[1].lower().replace('.', '')
    media_types = {
        "pdf": "application/pdf",
        "txt": "text/plain",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "doc": "application/msword",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "ppt": "application/vnd.ms-powerpoint",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "zip": "application/zip",
    }
    m_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=file_path,
        media_type=m_type,
        filename=safe_name,
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )


@router.get(
    "/subjects/{subject_id}/completion-report",
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def get_subject_completion_report(
    subject_id: UUID,
    batch_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    report = await academic_service.get_subject_completion_report(db, subject_id, batch_id)
    if "error" in report:
        raise HTTPException(status_code=404, detail=report["error"])
    return ResponseEnvelope(data=report)


@router.put(
    "/subjects/{subject_id}",
    response_model=ResponseEnvelope[SubjectResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_subject(
    subject_id: UUID, sub_in: SubjectUpdate, db: AsyncSession = Depends(get_db)
):
    subject = await academic_service.update_subject(db, subject_id, sub_in)
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    return ResponseEnvelope(data=SubjectResponse.model_validate(subject))


@router.delete(
    "/subjects/{subject_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_subject(subject_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await academic_service.delete_subject(db, subject_id)
    if not success:
        raise HTTPException(status_code=404, detail="Subject not found")
    return ResponseEnvelope(data={"deleted": True})


# Topics
@router.post(
    "/topics",
    response_model=ResponseEnvelope[TopicResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_topic(t_in: TopicCreate, db: AsyncSession = Depends(get_db)):
    topic = await academic_service.create_topic(db, t_in)
    return ResponseEnvelope(data=TopicResponse.model_validate(topic))


@router.get(
    "/topics",
    response_model=ResponseEnvelope[List[TopicResponse]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
)
async def list_topics(
    subject_id: Optional[UUID] = Query(None), db: AsyncSession = Depends(get_db)
):
    topics = await academic_service.list_topics(db, subject_id)
    return ResponseEnvelope(data=[TopicResponse.model_validate(t) for t in topics])


@router.put(
    "/topics/{topic_id}",
    response_model=ResponseEnvelope[TopicResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_topic(
    topic_id: UUID, t_in: TopicUpdate, db: AsyncSession = Depends(get_db)
):
    topic = await academic_service.update_topic(db, topic_id, t_in)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return ResponseEnvelope(data=TopicResponse.model_validate(topic))


@router.delete(
    "/topics/{topic_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_topic(topic_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await academic_service.delete_topic(db, topic_id)
    if not success:
        raise HTTPException(status_code=404, detail="Topic not found")
    return ResponseEnvelope(data={"deleted": True})


# Batch Student Enrollment
@router.get(
    "/batches/{batch_id}/students",
    response_model=ResponseEnvelope[List[StudentResponse]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
    summary="List students enrolled in a batch",
)
async def list_batch_students(batch_id: UUID, db: AsyncSession = Depends(get_db)):
    batch = await academic_service.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    students = await student_service.list_students(db, batch_id=batch_id)
    result = []
    for s in students:
        result.append(await student_service.to_student_response_enriched(db, s))
    return ResponseEnvelope(data=result)


@router.post(
    "/batches/{batch_id}/students/assign",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("academic", "edit"))],
    summary="Assign or remove students from a batch",
)
async def assign_batch_students(
    batch_id: UUID,
    body: BatchStudentAssignRequest,
    db: AsyncSession = Depends(get_db),
):
    batch = await academic_service.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    from app.models.student import Student
    from sqlalchemy import select

    updated = 0
    for student_id in body.student_ids:
        stmt = select(Student).where(Student.id == student_id, Student.is_deleted == False)
        res = await db.execute(stmt)
        student = res.scalar_one_or_none()
        if student:
            student.batch_id = batch_id if body.assign else None
            updated += 1

    await db.commit()
    return ResponseEnvelope(data={"updated": updated, "action": "assigned" if body.assign else "removed"})


# Divisions
@router.post(
    "/divisions",
    response_model=ResponseEnvelope[DivisionResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_division(d_in: DivisionCreate, db: AsyncSession = Depends(get_db)):
    division = await academic_service.create_division(db, d_in)
    prog = await academic_service.get_program(db, division.program_id)
    resp = DivisionResponse.model_validate(division)
    if prog:
        resp.program_name = prog.name
    return ResponseEnvelope(data=resp)


@router.get(
    "/divisions",
    response_model=ResponseEnvelope[List[DivisionResponse]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
)
async def list_divisions(
    program_id: Optional[UUID] = Query(None), db: AsyncSession = Depends(get_db)
):
    divisions = await academic_service.list_divisions(db, program_id=program_id)
    res = []
    for d in divisions:
        r = DivisionResponse.model_validate(d)
        if d.program:
            r.program_name = d.program.name
        res.append(r)
    return ResponseEnvelope(data=res)


@router.put(
    "/divisions/{division_id}",
    response_model=ResponseEnvelope[DivisionResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_division(
    division_id: UUID, d_in: DivisionUpdate, db: AsyncSession = Depends(get_db)
):
    division = await academic_service.update_division(db, division_id, d_in)
    if not division:
        raise HTTPException(status_code=404, detail="Division not found")
    resp = DivisionResponse.model_validate(division)
    if division.program:
        resp.program_name = division.program.name
    return ResponseEnvelope(data=resp)


@router.delete(
    "/divisions/{division_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_division(division_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await academic_service.delete_division(db, division_id)
    if not success:
        raise HTTPException(status_code=404, detail="Division not found")
    return ResponseEnvelope(data={"deleted": True})


@router.get(
    "/divisions/{division_id}/students",
    response_model=ResponseEnvelope[List[StudentResponse]],
    dependencies=[Depends(require_permission("academic", "view"))],
)
async def list_division_students(
    division_id: UUID, db: AsyncSession = Depends(get_db)
):
    students = await academic_service.list_students_for_division(db, division_id)
    res = []
    for s in students:
        res.append(await student_service.to_student_response_enriched(db, s))
    return ResponseEnvelope(data=res)


@router.post(
    "/divisions/{division_id}/students/assign",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def assign_division_students(
    division_id: UUID,
    body: BatchStudentAssignRequest,
    db: AsyncSession = Depends(get_db),
):
    success = await academic_service.assign_students_to_division(
        db, division_id, body.student_ids, assign=body.assign
    )
    return ResponseEnvelope(data={"success": success, "updated": len(body.student_ids)})


# ─── Faculty-Subject Allocation Endpoints ─────────────────────────────────────

@router.get(
    "/allocations",
    response_model=ResponseEnvelope[List[FacultySubjectAllocationResponse]],
    dependencies=[Depends(require_permission("academic", "view_own"))],
)
async def list_faculty_subject_allocations(
    program_id: Optional[UUID] = Query(None),
    batch_id: Optional[UUID] = Query(None),
    subject_id: Optional[UUID] = Query(None),
    faculty_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    allocs = await academic_service.list_faculty_subject_allocations(
        db, program_id=program_id, batch_id=batch_id, subject_id=subject_id, faculty_id=faculty_id
    )
    return ResponseEnvelope(data=[FacultySubjectAllocationResponse.model_validate(a) for a in allocs])


@router.post(
    "/allocations",
    response_model=ResponseEnvelope[FacultySubjectAllocationResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def create_faculty_subject_allocation(
    alloc_in: FacultySubjectAllocationCreate,
    db: AsyncSession = Depends(get_db),
):
    alloc = await academic_service.create_faculty_subject_allocation(db, alloc_in)
    return ResponseEnvelope(data=FacultySubjectAllocationResponse.model_validate(alloc))


@router.put(
    "/allocations/{allocation_id}",
    response_model=ResponseEnvelope[FacultySubjectAllocationResponse],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def update_faculty_subject_allocation(
    allocation_id: UUID,
    alloc_in: FacultySubjectAllocationUpdate,
    db: AsyncSession = Depends(get_db),
):
    alloc = await academic_service.update_faculty_subject_allocation(db, allocation_id, alloc_in)
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation not found")
    return ResponseEnvelope(data=FacultySubjectAllocationResponse.model_validate(alloc))


@router.delete(
    "/allocations/{allocation_id}",
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def delete_faculty_subject_allocation(
    allocation_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    success = await academic_service.delete_faculty_subject_allocation(db, allocation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Allocation not found")
    return ResponseEnvelope(data={"deleted": True})


