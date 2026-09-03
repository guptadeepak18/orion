import uuid
from typing import Optional
from sqlalchemy import String, Text, Float, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, TimestampMixin


class StudentSubjectGrade(Base, TimestampMixin):
    __tablename__ = "student_subject_grades"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Component Marks
    cce_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cce_max_marks: Mapped[float] = mapped_column(Float, default=50.0, nullable=False)

    hyperbuild_total_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    hyperbuild_average: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    hyperbuild_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)  # legacy alias for average

    term_end_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    term_end_max_marks: Mapped[float] = mapped_column(Float, default=50.0, nullable=False)

    # Composite Performance Metrics
    total_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    grade_letter: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    grade_points: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    performance_tier: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    student: Mapped["Student"] = relationship("Student")
    subject: Mapped["Subject"] = relationship("Subject")
