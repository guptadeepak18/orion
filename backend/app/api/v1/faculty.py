from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission
from app.schemas.common import ResponseEnvelope
from app.schemas.faculty import (
    FacultyInternalCreate, FacultyInternalUpdate, FacultyInternalResponse,
    FacultyExternalCreate, FacultyExternalUpdate, FacultyExternalResponse,
    FacultyDocumentCreate, FacultyDocumentResponse,
    FacultySuggestItem
)
from app.services import faculty_service

router = APIRouter(prefix="/faculty", tags=["Faculty"])


# Internal Faculty
@router.post(
    "/internal",
    response_model=ResponseEnvelope[FacultyInternalResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("faculty", "edit"))],
)
async def create_faculty_internal(f_in: FacultyInternalCreate, db: AsyncSession = Depends(get_db)):
    fac = await faculty_service.create_faculty_internal(db, f_in)
    return ResponseEnvelope(data=FacultyInternalResponse.model_validate(fac))


@router.get(
    "/internal",
    response_model=ResponseEnvelope[List[FacultyInternalResponse]],
    dependencies=[Depends(require_permission("faculty", "view"))],
)
async def list_faculty_internal(db: AsyncSession = Depends(get_db)):
    fac_list = await faculty_service.list_faculty_internal(db)
    return ResponseEnvelope(data=[FacultyInternalResponse.model_validate(f) for f in fac_list])


@router.put(
    "/internal/{faculty_id}",
    response_model=ResponseEnvelope[FacultyInternalResponse],
    dependencies=[Depends(require_permission("faculty", "edit"))],
)
async def update_faculty_internal(
    faculty_id: UUID, f_in: FacultyInternalUpdate, db: AsyncSession = Depends(get_db)
):
    fac = await faculty_service.update_faculty_internal(db, faculty_id, f_in)
    if not fac:
        raise HTTPException(status_code=404, detail="Internal faculty not found")
    return ResponseEnvelope(data=FacultyInternalResponse.model_validate(fac))


@router.put(
    "/internal/{faculty_id}/archive",
    response_model=ResponseEnvelope[FacultyInternalResponse],
    dependencies=[Depends(require_permission("faculty", "edit"))],
)
async def archive_faculty_internal(
    faculty_id: UUID, is_archived: bool = Query(True), db: AsyncSession = Depends(get_db)
):
    fac = await faculty_service.archive_faculty_internal(db, faculty_id, is_archived)
    if not fac:
        raise HTTPException(status_code=404, detail="Internal faculty not found")
    return ResponseEnvelope(data=FacultyInternalResponse.model_validate(fac))


@router.delete(
    "/internal/{faculty_id}",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("faculty", "edit"))],
)
async def delete_faculty_internal(faculty_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await faculty_service.delete_faculty_internal(db, faculty_id)
    if not success:
        raise HTTPException(status_code=404, detail="Internal faculty not found")
    return ResponseEnvelope(data={"message": "Internal faculty profile deleted successfully"})


# External Faculty
@router.post(
    "/external",
    response_model=ResponseEnvelope[FacultyExternalResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("faculty", "edit"))],
)
async def create_faculty_external(f_in: FacultyExternalCreate, db: AsyncSession = Depends(get_db)):
    fac = await faculty_service.create_faculty_external(db, f_in)
    return ResponseEnvelope(data=FacultyExternalResponse.model_validate(fac))


@router.get(
    "/external",
    response_model=ResponseEnvelope[List[FacultyExternalResponse]],
    dependencies=[Depends(require_permission("faculty", "view"))],
)
async def list_faculty_external(db: AsyncSession = Depends(get_db)):
    fac_list = await faculty_service.list_faculty_external(db)
    return ResponseEnvelope(data=[FacultyExternalResponse.model_validate(f) for f in fac_list])


@router.put(
    "/external/{faculty_id}",
    response_model=ResponseEnvelope[FacultyExternalResponse],
    dependencies=[Depends(require_permission("faculty", "edit"))],
)
async def update_faculty_external(
    faculty_id: UUID, f_in: FacultyExternalUpdate, db: AsyncSession = Depends(get_db)
):
    fac = await faculty_service.update_faculty_external(db, faculty_id, f_in)
    if not fac:
        raise HTTPException(status_code=404, detail="External faculty not found")
    return ResponseEnvelope(data=FacultyExternalResponse.model_validate(fac))


@router.put(
    "/external/{faculty_id}/archive",
    response_model=ResponseEnvelope[FacultyExternalResponse],
    dependencies=[Depends(require_permission("faculty", "edit"))],
)
async def archive_faculty_external(
    faculty_id: UUID, is_archived: bool = Query(True), db: AsyncSession = Depends(get_db)
):
    fac = await faculty_service.archive_faculty_external(db, faculty_id, is_archived)
    if not fac:
        raise HTTPException(status_code=404, detail="External faculty not found")
    return ResponseEnvelope(data=FacultyExternalResponse.model_validate(fac))


@router.delete(
    "/external/{faculty_id}",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("faculty", "edit"))],
)
async def delete_faculty_external(faculty_id: UUID, db: AsyncSession = Depends(get_db)):
    success = await faculty_service.delete_faculty_external(db, faculty_id)
    if not success:
        raise HTTPException(status_code=404, detail="External faculty not found")
    return ResponseEnvelope(data={"message": "External faculty profile deleted successfully"})


# Document Vault
@router.post(
    "/external/{faculty_id}/documents",
    response_model=ResponseEnvelope[FacultyDocumentResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("faculty", "edit"))],
)
async def upload_document(
    faculty_id: UUID, doc_in: FacultyDocumentCreate, db: AsyncSession = Depends(get_db)
):
    doc = await faculty_service.upload_faculty_document(db, faculty_id, doc_in)
    return ResponseEnvelope(data=FacultyDocumentResponse.model_validate(doc))


@router.get(
    "/external/{faculty_id}/documents",
    response_model=ResponseEnvelope[List[FacultyDocumentResponse]],
    dependencies=[Depends(require_permission("faculty", "view"))],
)
async def list_documents(faculty_id: UUID, db: AsyncSession = Depends(get_db)):
    docs = await faculty_service.list_faculty_documents(db, faculty_id)
    return ResponseEnvelope(data=[FacultyDocumentResponse.model_validate(d) for d in docs])


# Faculty Shortlist / Suggestion Endpoint
@router.get(
    "/suggest",
    response_model=ResponseEnvelope[List[FacultySuggestItem]],
    dependencies=[Depends(require_permission("faculty", "view"))],
)
async def suggest_faculty(
    session_id: UUID = Query(...), db: AsyncSession = Depends(get_db)
):
    suggestions = await faculty_service.suggest_faculty_for_session(db, session_id)
    return ResponseEnvelope(data=suggestions)
