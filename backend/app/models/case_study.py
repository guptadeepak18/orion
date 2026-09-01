import uuid
from typing import Optional
from sqlalchemy import String, Text, Integer, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, TimestampMixin, SoftDeleteMixin
from app.models.auth import User


class CaseStudy(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "case_studies"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Only title is mandatory
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # All other fields are optional
    author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    concept: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Course Overview Note / Synopsis
    learning_objectives: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    publisher_source: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)  # e.g. Harvard Business School
    industry_domain: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)  # Discipline e.g. Marketing
    subject_tags: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Subjects e.g. "BRANDING, MARKETING"
    
    product_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)  # Product # e.g. 514087-PDF-ENG
    publication_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Publication Date e.g. Dec 17, 2013
    revision_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Revision Date e.g. May 6, 2014
    page_length: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Length e.g. 11 page(s)
    duration: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Duration e.g. 23 minutes
    accessibility_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Accessibility e.g. ACCESSIBLE
    
    external_link: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Optional Document Attachment
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    uploaded_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[uploaded_by_id])


class UserCaseAnalysis(Base, TimestampMixin):
    __tablename__ = "user_case_analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    case_study_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("case_studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    analysis_lens: Mapped[str] = mapped_column(String(100), nullable=False, default="comprehensive_360")
    custom_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # Structured JSON / Text Analysis Content
    analysis_data: Mapped[dict] = mapped_column(
        Text, nullable=False  # Stored as JSON string for maximum database portability
    )

    user: Mapped["User"] = relationship("User")
    case_study: Mapped["CaseStudy"] = relationship("CaseStudy")
