from typing import Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class EngagementCreate(BaseModel):
    session_id: UUID
    faculty_type: str  # internal|external
    faculty_internal_id: Optional[UUID] = None
    faculty_external_id: Optional[UUID] = None
    topic_delivered: str
    hours: float
    program_id: UUID
    batch_id: UUID
    remarks: Optional[str] = None


class EngagementUpdate(BaseModel):
    topic_delivered: Optional[str] = None
    hours: Optional[float] = None
    payment_status: Optional[str] = None
    approval_status: Optional[str] = None
    remarks: Optional[str] = None


class EngagementResponse(BaseModel):
    id: UUID
    session_id: UUID
    faculty_type: str
    faculty_internal_id: Optional[UUID] = None
    faculty_external_id: Optional[UUID] = None
    topic_delivered: str
    hours: float
    program_id: UUID
    batch_id: UUID
    payment_status: str
    approval_status: str
    remarks: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
