import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Text, Boolean, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.academic import Subject
    from app.models.case_study import CaseStudy

class SubjectActivity(Base, TimestampMixin):
    __tablename__ = "subject_activities"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    unit_mapping: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    estimated_time: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    mode: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    file_naming: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    why_this_activity: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_tools: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # List of AI Tool objects
    learning_outcomes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submission_requirements: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rubric: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)    # List of Rubric criteria
    
    is_released: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    released_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    released_by: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Case Study Associations (Library or Manual)
    case_study_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("case_studies.id", ondelete="SET NULL"), nullable=True, index=True
    )
    case_studies: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # List of case study items (library or manual)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="activities")
    case_study: Mapped[Optional["CaseStudy"]] = relationship("CaseStudy", foreign_keys=[case_study_id])
