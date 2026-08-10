import uuid
from datetime import date, time
from typing import Optional, List
from sqlalchemy import String, Text, Integer, Numeric, Date, Time, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Timetable(Base, TimestampMixin):
    __tablename__ = "timetables"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False
    )
    term_label: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # upload_excel|upload_csv|manual
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False)  # draft|published
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    batch: Mapped["Batch"] = relationship("Batch")
    creator: Mapped["User"] = relationship("User")
    revisions: Mapped[List["TimetableRevision"]] = relationship(
        "TimetableRevision", back_populates="timetable", cascade="all, delete-orphan"
    )
    sessions: Mapped[List["Session"]] = relationship("Session", back_populates="timetable")


class TimetableRevision(Base, TimestampMixin):
    __tablename__ = "timetable_revisions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    timetable_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="CASCADE"), nullable=False
    )
    revision_no: Mapped[int] = mapped_column(Integer, nullable=False)
    diff_summary: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )

    timetable: Mapped["Timetable"] = relationship("Timetable", back_populates="revisions")
    creator: Mapped["User"] = relationship("User")


class Session(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    timetable_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("timetables.id", ondelete="SET NULL"), nullable=True
    )
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="RESTRICT"), nullable=False
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False
    )
    semester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("semesters.id", ondelete="RESTRICT"), nullable=False
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False
    )
    topic_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("topics.id", ondelete="SET NULL"), nullable=True
    )
    session_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    session_type: Mapped[str] = mapped_column(String(50), default="lecture", nullable=False)
    faculty_type: Mapped[str] = mapped_column(String(50), nullable=False)  # internal|external
    faculty_internal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("faculty_internal.id", ondelete="SET NULL"), nullable=True
    )
    faculty_external_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("faculty_external.id", ondelete="SET NULL"), nullable=True
    )
    venue: Mapped[str] = mapped_column(String(100), nullable=False)
    mode: Mapped[str] = mapped_column(String(50), default="offline", nullable=False)  # online|offline|hybrid
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="scheduled", nullable=False
    )  # scheduled|in_progress|completed|cancelled
    attendance_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    feedback_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    timetable: Mapped[Optional["Timetable"]] = relationship("Timetable", back_populates="sessions")
    program: Mapped["Program"] = relationship("Program")
    batch: Mapped["Batch"] = relationship("Batch")
    semester: Mapped["Semester"] = relationship("Semester")
    subject: Mapped["Subject"] = relationship("Subject")
    topic: Mapped[Optional["Topic"]] = relationship("Topic")
    faculty_internal: Mapped[Optional["FacultyInternal"]] = relationship("FacultyInternal")
    faculty_external: Mapped[Optional["FacultyExternal"]] = relationship("FacultyExternal")
    engagements: Mapped[List["Engagement"]] = relationship("Engagement", back_populates="session")


class Engagement(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "engagements"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="RESTRICT"), nullable=False
    )
    faculty_type: Mapped[str] = mapped_column(String(50), nullable=False)
    faculty_internal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("faculty_internal.id", ondelete="SET NULL"), nullable=True
    )
    faculty_external_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("faculty_external.id", ondelete="SET NULL"), nullable=True
    )
    topic_delivered: Mapped[str] = mapped_column(String(255), nullable=False)
    hours: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="RESTRICT"), nullable=False
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False
    )
    remuneration_calculation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("remuneration_calculations.id", ondelete="SET NULL", use_alter=True, name="fk_eng_remun"),
        nullable=True,
    )
    payment_status: Mapped[str] = mapped_column(
        String(50), default="unpaid", nullable=False
    )  # unpaid|invoiced|paid
    invoice_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    approval_status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False
    )  # pending|approved|rejected
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    session: Mapped["Session"] = relationship("Session", back_populates="engagements")
    faculty_internal: Mapped[Optional["FacultyInternal"]] = relationship("FacultyInternal")
    faculty_external: Mapped[Optional["FacultyExternal"]] = relationship("FacultyExternal")
    program: Mapped["Program"] = relationship("Program")
    batch: Mapped["Batch"] = relationship("Batch")


class StudentAttendance(Base, TimestampMixin):
    __tablename__ = "student_attendances"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(30), default="present", nullable=False
    )  # present|absent|late|excused
    marked_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    remarks: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    session: Mapped["Session"] = relationship("Session")
    student: Mapped["Student"] = relationship("Student")
    marked_by_user: Mapped[Optional["User"]] = relationship("User")

