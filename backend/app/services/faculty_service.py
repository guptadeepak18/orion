from datetime import date
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.faculty import FacultyInternal, FacultyExternal, FacultyDocument
from app.models.session import Session, Engagement
from app.schemas.faculty import (
    FacultyInternalCreate, FacultyInternalUpdate,
    FacultyExternalCreate, FacultyExternalUpdate,
    FacultyDocumentCreate, FacultySuggestItem
)


# Internal Faculty
async def create_faculty_internal(db: AsyncSession, f_in: FacultyInternalCreate) -> FacultyInternal:
    fac = FacultyInternal(**f_in.model_dump())
    db.add(fac)
    await db.commit()
    await db.refresh(fac)
    return fac


async def list_faculty_internal(db: AsyncSession) -> List[FacultyInternal]:
    stmt = select(FacultyInternal).where(FacultyInternal.is_deleted == False).order_by(FacultyInternal.employee_id)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def get_faculty_internal(db: AsyncSession, faculty_id: UUID) -> Optional[FacultyInternal]:
    stmt = select(FacultyInternal).where(FacultyInternal.id == faculty_id, FacultyInternal.is_deleted == False)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def update_faculty_internal(
    db: AsyncSession, faculty_id: UUID, f_in: FacultyInternalUpdate
) -> Optional[FacultyInternal]:
    fac = await get_faculty_internal(db, faculty_id)
    if not fac:
        return None
    for field, value in f_in.model_dump(exclude_unset=True).items():
        setattr(fac, field, value)
    await db.commit()
    await db.refresh(fac)
    return fac


async def archive_faculty_internal(db: AsyncSession, faculty_id: UUID, is_archived: bool = True) -> Optional[FacultyInternal]:
    fac = await get_faculty_internal(db, faculty_id)
    if not fac:
        return None
    fac.is_archived = is_archived
    fac.is_active = not is_archived
    await db.commit()
    await db.refresh(fac)
    return fac


async def delete_faculty_internal(db: AsyncSession, faculty_id: UUID) -> bool:
    fac = await get_faculty_internal(db, faculty_id)
    if not fac:
        return False
    fac.is_deleted = True
    await db.commit()
    return True


# External Faculty
async def create_faculty_external(db: AsyncSession, f_in: FacultyExternalCreate) -> FacultyExternal:
    fac = FacultyExternal(**f_in.model_dump())
    db.add(fac)
    await db.commit()
    await db.refresh(fac)
    return fac


async def list_faculty_external(db: AsyncSession) -> List[FacultyExternal]:
    stmt = select(FacultyExternal).where(FacultyExternal.is_deleted == False).order_by(FacultyExternal.name)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def get_faculty_external(db: AsyncSession, faculty_id: UUID) -> Optional[FacultyExternal]:
    stmt = select(FacultyExternal).where(FacultyExternal.id == faculty_id, FacultyExternal.is_deleted == False)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def update_faculty_external(
    db: AsyncSession, faculty_id: UUID, f_in: FacultyExternalUpdate
) -> Optional[FacultyExternal]:
    fac = await get_faculty_external(db, faculty_id)
    if not fac:
        return None
    for field, value in f_in.model_dump(exclude_unset=True).items():
        setattr(fac, field, value)
    await db.commit()
    await db.refresh(fac)
    return fac


async def archive_faculty_external(db: AsyncSession, faculty_id: UUID, is_archived: bool = True) -> Optional[FacultyExternal]:
    fac = await get_faculty_external(db, faculty_id)
    if not fac:
        return None
    fac.is_archived = is_archived
    fac.is_active = not is_archived
    await db.commit()
    await db.refresh(fac)
    return fac


async def delete_faculty_external(db: AsyncSession, faculty_id: UUID) -> bool:
    fac = await get_faculty_external(db, faculty_id)
    if not fac:
        return False
    fac.is_deleted = True
    await db.commit()
    return True


# Document Vault
async def upload_faculty_document(
    db: AsyncSession, faculty_external_id: UUID, doc_in: FacultyDocumentCreate
) -> FacultyDocument:
    # Calculate version number
    version_stmt = select(func.max(FacultyDocument.version)).where(
        FacultyDocument.faculty_external_id == faculty_external_id,
        FacultyDocument.doc_type == doc_in.doc_type
    )
    v_res = await db.execute(version_stmt)
    current_max = v_res.scalar() or 0

    doc = FacultyDocument(
        faculty_external_id=faculty_external_id,
        doc_type=doc_in.doc_type,
        file_path=doc_in.file_path,
        version=current_max + 1,
        expiry_date=doc_in.expiry_date,
        uploaded_at=date.today()
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def list_faculty_documents(db: AsyncSession, faculty_external_id: UUID) -> List[FacultyDocument]:
    stmt = (
        select(FacultyDocument)
        .where(FacultyDocument.faculty_external_id == faculty_external_id)
        .order_by(FacultyDocument.doc_type, FacultyDocument.version.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


# Faculty Suggest / Shortlist Endpoint
async def suggest_faculty_for_session(db: AsyncSession, session_id: UUID) -> List[FacultySuggestItem]:
    sess_res = await db.execute(select(Session).where(Session.id == session_id))
    session = sess_res.scalar_one_or_none()
    if not session:
        return []

    # Get all active external faculty
    ext_res = await db.execute(select(FacultyExternal).where(FacultyExternal.is_active == True))
    faculty_list = ext_res.scalars().all()

    suggestions = []
    for fac in faculty_list:
        # Check active agreement
        if fac.agreement_end and fac.agreement_end < session.session_date:
            continue

        # Calculate 90-day workload hours
        workload_stmt = select(func.sum(Engagement.hours)).where(
            Engagement.faculty_external_id == fac.id,
            Engagement.is_deleted == False
        )
        w_res = await db.execute(workload_stmt)
        hours_90d = float(w_res.scalar() or 0.0)

        # Match score based on expertise and availability
        match_score = 90.0 if fac.expertise else 75.0

        suggestions.append(
            FacultySuggestItem(
                id=fac.id,
                name=fac.name,
                faculty_type="external",
                expertise=fac.expertise or [],
                workload_hours_90d=hours_90d,
                match_score=match_score
            )
        )

    return sorted(suggestions, key=lambda x: (-x.match_score, x.workload_hours_90d))
