import uuid
from typing import Optional, List
from sqlalchemy import String, Text, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, TimestampMixin


class EmailTemplate(Base, TimestampMixin):
    """
    Stores customizable email notification templates for system activities/triggers.
    Supports dynamic variable placeholders in {{variable_name}} syntax.
    """
    __tablename__ = "email_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_key: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, default="General")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    html_content: Mapped[str] = mapped_column(Text, nullable=False)
    plain_text_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # List of supported placeholders/variable names (e.g. ["full_name", "otp", "login_url"])
    variables: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
