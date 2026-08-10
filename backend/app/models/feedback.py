import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class FeedbackForm(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "feedback_forms"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    qr_code_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    questions: Mapped[dict] = mapped_column(JSON, nullable=False)

    session: Mapped["Session"] = relationship("Session")
    responses: Mapped[List["FeedbackResponse"]] = relationship(
        "FeedbackResponse", back_populates="form", cascade="all, delete-orphan"
    )


class FeedbackResponse(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "feedback_responses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    form_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("feedback_forms.id", ondelete="CASCADE"), nullable=False
    )
    ratings: Mapped[dict] = mapped_column(JSON, nullable=False)
    open_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sentiment_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    form: Mapped["FeedbackForm"] = relationship("FeedbackForm", back_populates="responses")
