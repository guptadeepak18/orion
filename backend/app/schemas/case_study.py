import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class CaseStudyBase(BaseModel):
    title: str  # Only title is mandatory
    author: Optional[str] = None
    concept: Optional[str] = None  # Overview note / synopsis
    learning_objectives: Optional[str] = None
    publisher_source: Optional[str] = None
    industry_domain: Optional[str] = None
    subject_tags: Optional[str] = None
    product_number: Optional[str] = None
    publication_date: Optional[str] = None
    revision_date: Optional[str] = None
    page_length: Optional[str] = None
    duration: Optional[str] = None
    accessibility_status: Optional[str] = None
    external_link: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = None


class CaseStudyCreate(CaseStudyBase):
    pass


class CaseStudyUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    concept: Optional[str] = None
    learning_objectives: Optional[str] = None
    publisher_source: Optional[str] = None
    industry_domain: Optional[str] = None
    subject_tags: Optional[str] = None
    product_number: Optional[str] = None
    publication_date: Optional[str] = None
    revision_date: Optional[str] = None
    page_length: Optional[str] = None
    duration: Optional[str] = None
    accessibility_status: Optional[str] = None
    external_link: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    is_active: Optional[bool] = None


class UserMiniSummary(BaseModel):
    id: uuid.UUID
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CaseStudyResponse(CaseStudyBase):
    id: uuid.UUID
    is_active: bool
    uploaded_by_id: Optional[uuid.UUID] = None
    uploaded_by: Optional[UserMiniSummary] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
