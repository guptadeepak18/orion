from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    title: str
    body: str
    priority: str  # low|medium|high|urgent
    source: str
    is_read: bool
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
