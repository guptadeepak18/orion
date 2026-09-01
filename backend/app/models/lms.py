import uuid
from datetime import datetime, date
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, Text, Boolean, Integer, Float, DateTime, Date, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.academic import Subject
    from app.models.student import Student
    from app.models.auth import User
    from app.models.activity import SubjectActivity
    from app.models.session import Session

class SubjectResource(Base, TimestampMixin):
    __tablename__ = "subject_resources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resource_type: Mapped[str] = mapped_column(String(50), default="document", nullable=False)  # document|slides|case_study|link|notes
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    external_link: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    unit_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    uploaded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    subject: Mapped["Subject"] = relationship("Subject")
    uploaded_by: Mapped[Optional["User"]] = relationship("User")


class SubjectRecording(Base, TimestampMixin):
    __tablename__ = "subject_recordings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    recording_url: Mapped[str] = mapped_column(String(500), nullable=False)
    recording_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    platform: Mapped[str] = mapped_column(String(50), default="Zoom", nullable=False)  # Zoom|Teams|Google Drive|YouTube|Other
    topic_covered: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    unit_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    passcode: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    subject: Mapped["Subject"] = relationship("Subject")
    session: Mapped[Optional["Session"]] = relationship("Session")


class SubjectAssessment(Base, TimestampMixin):
    __tablename__ = "subject_assessments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    assessment_type: Mapped[str] = mapped_column(String(50), default="assignment", nullable=False)  # assignment|quiz|case_study|project
    total_marks: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    weightage_percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attachment_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    attachment_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    subject: Mapped["Subject"] = relationship("Subject")
    created_by: Mapped[Optional["User"]] = relationship("User")
    submissions: Mapped[List["AssessmentSubmission"]] = relationship(
        "AssessmentSubmission", back_populates="assessment", cascade="all, delete-orphan"
    )


class AssessmentSubmission(Base, TimestampMixin):
    __tablename__ = "assessment_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subject_assessments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    submission_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="submitted", nullable=False)  # submitted|graded|late
    marks_obtained: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    graded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    graded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    assessment: Mapped["SubjectAssessment"] = relationship("SubjectAssessment", back_populates="submissions")
    student: Mapped["Student"] = relationship("Student")
    graded_by: Mapped[Optional["User"]] = relationship("User")


class ActivitySubmission(Base, TimestampMixin):
    __tablename__ = "activity_submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subject_activities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    submission_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    file_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    files: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # List of {file_name, file_url, file_size, file_type, saved_path}
    ai_verification_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_evaluation: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # {total_score, max_score, performance_tier, strengths, areas_for_improvement, criteria_breakdown, critical_feedback, evaluated_at, model_used}
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="submitted", nullable=False)  # submitted|graded|needs_revision
    grade: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Distinction|Merit|Pass|Needs Work
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    graded_by_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    graded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    feedback: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    activity: Mapped["SubjectActivity"] = relationship("SubjectActivity")
    student: Mapped["Student"] = relationship("Student")
    graded_by: Mapped[Optional["User"]] = relationship("User")

