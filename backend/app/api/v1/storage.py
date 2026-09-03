import mimetypes
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response, status

from app.core.database import get_db
from app.core.permissions import get_current_user
from app.models.auth import User
from app.schemas.common import ResponseEnvelope
from app.services.storage_service import storage_service

router = APIRouter(prefix="/storage", tags=["Storage"])


@router.post("/upload")
async def upload_file_endpoint(
    file: UploadFile = File(...),
    folder: str = Query("general", description="Target storage directory or category (e.g. lms, case_studies, session_plans)"),
    current_user: User = Depends(get_current_user),
):
    """
    Unified file upload endpoint that streams files directly to Cloudflare R2
    (or local storage fallback) in 64KB chunks.
    """
    try:
        result = await storage_service.upload_file(file, folder=folder)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Upload failed: {str(e)}")


@router.get("/file")
async def get_stored_file_endpoint(
    key: str = Query(..., description="Storage key or relative file path"),
    download: bool = Query(False, description="Whether to force attachment download"),
):
    """
    Streams file bytes from Cloudflare R2 or local disk storage.
    Supports inline browser viewing (PDF, images) or forced attachment download.
    """
    try:
        data = await storage_service.read_file_bytes(key)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in storage.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to retrieve file: {str(e)}")

    filename = os.path.basename(key)
    # Strip UUID prefix if present for clean download name
    clean_display_name = filename.split("_", 1)[1] if "_" in filename and len(filename.split("_", 1)[0]) == 32 else filename

    content_type, _ = mimetypes.guess_type(filename)
    if not content_type:
        content_type = "application/octet-stream"

    disposition_type = "attachment" if download else "inline"
    headers = {
        "Content-Disposition": f'{disposition_type}; filename="{clean_display_name}"',
        "Cache-Control": "public, max-age=86400",
    }

    return Response(content=data, media_type=content_type, headers=headers)


@router.get("/status")
async def get_storage_status_endpoint():
    """Returns the active storage provider and configuration status."""
    return {
        "r2_active": storage_service.is_r2_active(),
        "provider": "Cloudflare R2" if storage_service.is_r2_active() else "Local Disk Storage",
    }
