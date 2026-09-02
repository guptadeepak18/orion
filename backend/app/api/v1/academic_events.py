import os
import re
import uuid
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.permissions import get_current_user, require_role, require_permission
from app.models.auth import User
from app.schemas.common import ResponseEnvelope
from app.schemas.academic_event import (
    AcademicEventCreate,
    AcademicEventUpdate,
    AcademicEventResponse,
)
from app.services import academic_event_service

router = APIRouter(prefix="/academic-events", tags=["Academic Events & Milestones"])


@router.post(
    "/upload-poster",
    dependencies=[Depends(require_role(["super_admin", "admin", "crc_admin", "crc_coordinator", "faculty_internal", "director"]))],
    summary="Upload WhatsApp creative or poster banner for an academic event",
)
async def upload_event_poster(
    file: UploadFile = File(...),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    upload_dir = os.path.join(settings.FILE_STORAGE_PATH, "academic_events")
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
            "file_url": f"/academic-events/posters/{stored_filename}",
            "file_name": file.filename,
            "file_size": len(content),
            "file_type": ext,
            "stored_filename": stored_filename,
        }
    )


@router.get(
    "/posters/{filename}",
    summary="Stream and view academic event creative / poster",
)
async def stream_event_poster(
    filename: str,
    original_name: Optional[str] = Query(None),
    inline: Optional[bool] = Query(True),
):
    upload_dir = os.path.join(settings.FILE_STORAGE_PATH, "academic_events")
    file_path = os.path.join(upload_dir, filename)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Event creative poster not found on server")

    download_name = original_name or filename
    safe_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', download_name)

    ext = os.path.splitext(filename)[1].lower().replace('.', '')
    media_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "gif": "image/gif",
        "svg": "image/svg+xml",
        "pdf": "application/pdf",
    }
    m_type = media_types.get(ext, "application/octet-stream")
    disposition = "inline" if inline else f'attachment; filename="{safe_name}"'

    return FileResponse(
        path=file_path,
        media_type=m_type,
        filename=safe_name if not inline else None,
        headers={"Content-Disposition": disposition},
    )



@router.get(
    "",
    response_model=ResponseEnvelope[List[AcademicEventResponse]],
    summary="List scheduled academic events & milestones with filters",
)
async def list_events_endpoint(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    category: Optional[str] = Query(None),
    program_id: Optional[uuid.UUID] = Query(None),
    batch_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = await academic_event_service.list_academic_events(
        db=db,
        start_date=start_date,
        end_date=end_date,
        category=category,
        program_id=program_id,
        batch_id=batch_id,
        status=status,
    )
    return ResponseEnvelope(data=events)


@router.get(
    "/{event_id}",
    response_model=ResponseEnvelope[AcademicEventResponse],
    summary="Get single academic event details",
)
async def get_event_endpoint(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ev = await academic_event_service.get_academic_event(db, event_id)
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic event not found")
    return ResponseEnvelope(data=ev)


@router.post(
    "",
    response_model=ResponseEnvelope[AcademicEventResponse],
    dependencies=[Depends(require_role(["super_admin", "admin", "crc_admin", "crc_coordinator", "faculty_internal", "director"]))],
    summary="Schedule a new academic event or milestone",
)
async def create_event_endpoint(
    req: AcademicEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        ev = await academic_event_service.create_academic_event(db, req, created_by_user_id=current_user.id)
        return ResponseEnvelope(data=ev)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put(
    "/{event_id}",
    response_model=ResponseEnvelope[AcademicEventResponse],
    dependencies=[Depends(require_role(["super_admin", "admin", "crc_admin", "crc_coordinator", "faculty_internal", "director"]))],
    summary="Update an existing scheduled academic event or milestone",
)
async def update_event_endpoint(
    event_id: uuid.UUID,
    req: AcademicEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        ev = await academic_event_service.update_academic_event(db, event_id, req)
        return ResponseEnvelope(data=ev)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete(
    "/{event_id}",
    dependencies=[Depends(require_role(["super_admin", "admin", "crc_admin", "crc_coordinator", "director"]))],
    summary="Delete / Cancel a scheduled academic event",
)
async def delete_event_endpoint(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        await academic_event_service.delete_academic_event(db, event_id)
        return ResponseEnvelope(data={"message": "Academic event deleted successfully"})
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
