from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class EmailTemplateBase(BaseModel):
    event_key: str = Field(..., description="Unique event trigger key (e.g. student_registration_otp)")
    name: str = Field(..., description="Display name for the email activity")
    category: str = Field("General", description="Category grouping")
    description: Optional[str] = None
    subject: str = Field(..., description="Email subject template")
    html_content: str = Field(..., description="HTML email body template")
    plain_text_content: Optional[str] = None
    variables: Optional[List[str]] = Field(default_factory=list, description="List of variable placeholders")
    is_active: bool = True


class EmailTemplateCreate(EmailTemplateBase):
    pass


class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    subject: Optional[str] = None
    html_content: Optional[str] = None
    plain_text_content: Optional[str] = None
    variables: Optional[List[str]] = None
    is_active: Optional[bool] = None


class EmailTemplateResponse(EmailTemplateBase):
    id: UUID
    is_system: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmailTemplateTestSendRequest(BaseModel):
    recipient_email: Optional[str] = Field("deepak.gupta@mile.education", description="Recipient to receive test email")
    subject: Optional[str] = None
    html_content: Optional[str] = None
    context_data: Optional[Dict[str, Any]] = None


class EmailTemplatePreviewRequest(BaseModel):
    subject: str
    html_content: str
    context_data: Optional[Dict[str, Any]] = None


class EmailTemplatePreviewResponse(BaseModel):
    rendered_subject: str
    rendered_html: str
