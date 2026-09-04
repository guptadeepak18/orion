from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class ActivityTool(BaseModel):
    tool: str
    category: str
    purpose: str
    access: str

class ActivityRubric(BaseModel):
    criterion: str
    distinction: str
    merit: str
    pass_grade: str
    needs_work: str

class ActivityCreate(BaseModel):
    activity_no: int
    title: str
    unit_mapping: Optional[str] = None
    estimated_time: Optional[str] = None
    mode: Optional[str] = None
    file_naming: Optional[str] = None
    why_this_activity: Optional[str] = None
    instructions: Optional[str] = None
    ai_tools: Optional[List[Any]] = []
    learning_outcomes: Optional[str] = None
    submission_requirements: Optional[str] = None
    rubric: Optional[List[Any]] = []
    is_released: bool = False
    case_study_id: Optional[UUID] = None
    case_studies: Optional[List[Any]] = []

class ActivityUpdate(BaseModel):
    title: Optional[str] = None
    unit_mapping: Optional[str] = None
    estimated_time: Optional[str] = None
    mode: Optional[str] = None
    file_naming: Optional[str] = None
    why_this_activity: Optional[str] = None
    instructions: Optional[str] = None
    ai_tools: Optional[List[Any]] = None
    learning_outcomes: Optional[str] = None
    submission_requirements: Optional[str] = None
    rubric: Optional[List[Any]] = None
    is_released: Optional[bool] = None
    case_study_id: Optional[UUID] = None
    case_studies: Optional[List[Any]] = None

class ActivityReleaseUpdate(BaseModel):
    is_released: bool

class BatchReleaseRequest(BaseModel):
    activity_ids: List[UUID]
    is_released: bool

class ActivityLockRequest(BaseModel):
    is_locked: bool
    reason: Optional[str] = None

class ActivityResponse(BaseModel):
    id: UUID
    subject_id: UUID
    activity_no: int
    title: str
    unit_mapping: Optional[str] = None
    estimated_time: Optional[str] = None
    mode: Optional[str] = None
    file_naming: Optional[str] = None
    why_this_activity: Optional[str] = None
    instructions: Optional[str] = None
    ai_tools: Optional[Any] = None
    learning_outcomes: Optional[str] = None
    submission_requirements: Optional[str] = None
    rubric: Optional[Any] = None
    is_released: bool
    released_at: Optional[datetime] = None
    released_by: Optional[str] = None
    is_locked: bool = False
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    lock_reason: Optional[str] = None
    case_study_id: Optional[UUID] = None
    case_studies: Optional[Any] = None
    scheduled_release_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
