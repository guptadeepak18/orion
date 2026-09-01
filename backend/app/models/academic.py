import uuid
from datetime import date
from typing import Optional, List
from sqlalchemy import String, Text, Integer, Date, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Program(Base, TimestampMixin):
    __tablename__ = "programs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    semesters: Mapped[List["Semester"]] = relationship("Semester", back_populates="program")
    batches: Mapped[List["Batch"]] = relationship("Batch", back_populates="program")
    divisions: Mapped[List["Division"]] = relationship("Division", back_populates="program", cascade="all, delete-orphan")


class AcademicYear(Base, TimestampMixin):
    __tablename__ = "academic_years"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    semesters: Mapped[List["Semester"]] = relationship("Semester", back_populates="academic_year")
    batches: Mapped[List["Batch"]] = relationship("Batch", back_populates="academic_year")


class Semester(Base, TimestampMixin):
    __tablename__ = "semesters"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="CASCADE"), nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    program: Mapped["Program"] = relationship("Program", back_populates="semesters")
    academic_year: Mapped["AcademicYear"] = relationship("AcademicYear", back_populates="semesters")
    batches: Mapped[List["Batch"]] = relationship("Batch", back_populates="semester")


class Batch(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "batches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False
    )
    semester_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("semesters.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    division: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    student_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    program: Mapped["Program"] = relationship("Program", back_populates="batches")
    academic_year: Mapped["AcademicYear"] = relationship("AcademicYear", back_populates="batches")
    semester: Mapped["Semester"] = relationship("Semester", back_populates="batches")
    subjects: Mapped[List["Subject"]] = relationship("Subject", back_populates="batch")


class Division(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "divisions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    student_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    program: Mapped["Program"] = relationship("Program", back_populates="divisions")
    students: Mapped[List["Student"]] = relationship(
        "Student", secondary="student_divisions", back_populates="divisions"
    )


class SubjectProgram(Base):
    __tablename__ = "subject_programs"

    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True
    )
    program_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="CASCADE"), primary_key=True
    )


class SubjectBatch(Base, TimestampMixin):
    __tablename__ = "subject_batches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    term_type: Mapped[str] = mapped_column(String(50), default="trimester", nullable=False)
    term_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    term_label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    faculty_type: Mapped[Optional[str]] = mapped_column(String(50), default="internal", nullable=True)
    faculty_internal_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("faculty_internal.id", ondelete="SET NULL"), nullable=True
    )
    faculty_external_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("faculty_external.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="batch_allocations")
    batch: Mapped["Batch"] = relationship("Batch", lazy="selectin")
    faculty_internal: Mapped[Optional["FacultyInternal"]] = relationship("FacultyInternal", lazy="selectin")
    faculty_external: Mapped[Optional["FacultyExternal"]] = relationship("FacultyExternal", lazy="selectin")


class Subject(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "subjects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    course_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    trimester: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_non_credit: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    total_hours: Mapped[Optional[int]] = mapped_column(Integer, default=30, nullable=True)
    course_category: Mapped[str] = mapped_column(String(50), default="core", nullable=False)
    elective_domain: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)

    syllabus: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    session_plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    hyperbuild_activities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Legacy batch_id for fallback/backward compatibility
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True
    )

    batch: Mapped[Optional["Batch"]] = relationship("Batch")
    programs: Mapped[List["Program"]] = relationship(
        "Program", secondary="subject_programs", lazy="selectin"
    )
    batch_allocations: Mapped[List["SubjectBatch"]] = relationship(
        "SubjectBatch", back_populates="subject", cascade="all, delete-orphan", lazy="selectin"
    )
    topics: Mapped[List["Topic"]] = relationship("Topic", back_populates="subject")
    activities: Mapped[List["SubjectActivity"]] = relationship(
        "SubjectActivity", back_populates="subject", cascade="all, delete-orphan", lazy="selectin"
    )


class Topic(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "topics"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)
    planned_hours: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    subject: Mapped["Subject"] = relationship("Subject", back_populates="topics")
