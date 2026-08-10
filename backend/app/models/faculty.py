import uuid
from datetime import date
from typing import Optional, List
from sqlalchemy import String, Text, Numeric, Integer, Date, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class FacultyInternal(Base, TimestampMixin):
    __tablename__ = "faculty_internal"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    employee_id: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    department: Mapped[str] = mapped_column(String(100), nullable=False)
    designation: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Personal
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Academic & Professional
    highest_qualification: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    specialization: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    research_area: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    experience_years: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    joining_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    subjects_handled: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String).with_variant(JSON, "sqlite"), nullable=True
    )
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    publications: Mapped[Optional[int]] = mapped_column(Integer, default=0, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped[Optional["User"]] = relationship("User")


class FacultyExternal(Base, TimestampMixin):
    __tablename__ = "faculty_external"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    designation: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    organization: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    expertise: Mapped[Optional[List[str]]] = mapped_column(
        ARRAY(String).with_variant(JSON, "sqlite"), nullable=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Personal
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Academic
    highest_qualification: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    experience_years: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Financial / Compliance
    is_gst_applicable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    gst_rate_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=18.0, nullable=False)
    pan: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    gst_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    bank_account_no: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    bank_ifsc: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    bank_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    standard_rate_type: Mapped[str] = mapped_column(
        String(50), default="per_hour", nullable=False
    )
    standard_rate: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    agreement_start: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    agreement_end: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped[Optional["User"]] = relationship("User")
    documents: Mapped[List["FacultyDocument"]] = relationship(
        "FacultyDocument", back_populates="faculty_external", cascade="all, delete-orphan"
    )


class FacultyDocument(Base, TimestampMixin):
    __tablename__ = "faculty_documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    faculty_external_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("faculty_external.id", ondelete="CASCADE"), nullable=False
    )
    doc_type: Mapped[str] = mapped_column(String(50), nullable=False)  # agreement|pan|gst|bank_proof|other
    file_path: Mapped[str] = mapped_column(String(512), nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    expiry_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    uploaded_at: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)

    faculty_external: Mapped["FacultyExternal"] = relationship("FacultyExternal", back_populates="documents")
