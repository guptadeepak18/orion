import uuid
from typing import List, Optional, Union
from sqlalchemy import select, or_, desc, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.case_study import CaseStudy
from app.schemas.case_study import CaseStudyCreate, CaseStudyUpdate


class CaseStudyService:
    async def list_case_studies(
        self,
        db: AsyncSession,
        search: Optional[str] = None,
        domain: Optional[str] = None,
        publisher: Optional[str] = None,
        tag: Optional[str] = None,
        has_document: Optional[bool] = None,
        sort_by: Optional[str] = "newest",
        is_active: Optional[bool] = True,
    ) -> List[CaseStudy]:
        query = select(CaseStudy).options(selectinload(CaseStudy.uploaded_by))

        if is_active is not None:
            query = query.where(CaseStudy.is_active == is_active)

        if domain:
            query = query.where(CaseStudy.industry_domain.ilike(f"%{domain}%"))

        if publisher:
            query = query.where(CaseStudy.publisher_source.ilike(f"%{publisher}%"))

        if tag:
            query = query.where(CaseStudy.subject_tags.ilike(f"%{tag}%"))

        if has_document is True:
            query = query.where(CaseStudy.file_url.is_not(None), CaseStudy.file_url != "")
        elif has_document is False:
            query = query.where(or_(CaseStudy.file_url.is_(None), CaseStudy.file_url == ""))

        if search:
            s_term = f"%{search}%"
            query = query.where(
                or_(
                    CaseStudy.title.ilike(s_term),
                    CaseStudy.author.ilike(s_term),
                    CaseStudy.concept.ilike(s_term),
                    CaseStudy.learning_objectives.ilike(s_term),
                    CaseStudy.publisher_source.ilike(s_term),
                    CaseStudy.industry_domain.ilike(s_term),
                    CaseStudy.product_number.ilike(s_term),
                    CaseStudy.subject_tags.ilike(s_term),
                )
            )

        if sort_by == "title":
            query = query.order_by(CaseStudy.title.asc())
        elif sort_by == "oldest":
            query = query.order_by(CaseStudy.created_at.asc())
        else:
            query = query.order_by(desc(CaseStudy.created_at))

        res = await db.execute(query)
        return list(res.scalars().all())

    async def get_case_study(self, db: AsyncSession, identifier: Union[uuid.UUID, str]) -> Optional[CaseStudy]:
        if isinstance(identifier, uuid.UUID):
            query = select(CaseStudy).options(selectinload(CaseStudy.uploaded_by)).where(CaseStudy.id == identifier)
            res = await db.execute(query)
            return res.scalars().first()

        id_str = str(identifier).strip()

        # 1. Try UUID conversion
        try:
            val_uuid = uuid.UUID(id_str)
            query = select(CaseStudy).options(selectinload(CaseStudy.uploaded_by)).where(CaseStudy.id == val_uuid)
            res = await db.execute(query)
            found = res.scalars().first()
            if found:
                return found
        except ValueError:
            pass

        # 2. Try Product Number match (case-insensitive)
        query = select(CaseStudy).options(selectinload(CaseStudy.uploaded_by)).where(
            func.lower(CaseStudy.product_number) == id_str.lower()
        )
        res = await db.execute(query)
        found = res.scalars().first()
        if found:
            return found

        # 3. Try exact Title match (case-insensitive)
        query = select(CaseStudy).options(selectinload(CaseStudy.uploaded_by)).where(
            func.lower(CaseStudy.title) == id_str.lower()
        )
        res = await db.execute(query)
        return res.scalars().first()

    async def create_case_study(
        self, db: AsyncSession, payload: CaseStudyCreate, user_id: Optional[uuid.UUID] = None
    ) -> CaseStudy:
        cs = CaseStudy(
            title=payload.title,
            author=payload.author,
            concept=payload.concept,
            learning_objectives=payload.learning_objectives,
            publisher_source=payload.publisher_source,
            industry_domain=payload.industry_domain,
            subject_tags=payload.subject_tags,
            product_number=payload.product_number,
            publication_date=payload.publication_date,
            revision_date=payload.revision_date,
            page_length=payload.page_length,
            duration=payload.duration,
            accessibility_status=payload.accessibility_status,
            external_link=payload.external_link,
            file_url=payload.file_url,
            file_name=payload.file_name,
            file_size=payload.file_size,
            file_type=payload.file_type,
            is_active=True,
            uploaded_by_id=user_id,
        )
        db.add(cs)
        await db.commit()
        await db.refresh(cs)
        return cs

    async def update_case_study(
        self, db: AsyncSession, identifier: Union[uuid.UUID, str], payload: CaseStudyUpdate
    ) -> Optional[CaseStudy]:
        cs = await self.get_case_study(db, identifier)
        if not cs:
            return None

        update_data = payload.model_dump(exclude_unset=True)
        for k, v in update_data.items():
            setattr(cs, k, v)

        await db.commit()
        await db.refresh(cs)
        return cs

    async def delete_case_study(self, db: AsyncSession, identifier: Union[uuid.UUID, str]) -> bool:
        cs = await self.get_case_study(db, identifier)
        if not cs:
            return False
        cs.is_active = False
        await db.commit()
        return True


case_study_service = CaseStudyService()
