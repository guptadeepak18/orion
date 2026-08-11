import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Text, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, TimestampMixin


class StudentRegistration(Base, TimestampMixin):
    """
    Holds a student's self-submitted registration request.
    status: pending_verification | pending_review | approved | rejected
    """
    __tablename__ = "student_registrations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # --- Auth ---
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # --- Identity ---
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    gender: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # --- Academic ID (student-supplied at registration) ---
    prn_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)

    # --- Family ---
    father_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mother_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # --- Contact ---
    mobile_number: Mapped[str] = mapped_column(String(50), nullable=False)
    email_personal: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    alternate_contact_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # --- Emergency contact ---
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    emergency_contact_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    emergency_contact_relation: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # --- Health ---
    blood_group: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # --- UG Background ---
    ug_degree: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    ug_score_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    ug_score: Mapped[Optional[float]] = mapped_column(nullable=True)

    # --- Email verification ---
    verification_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    verification_code_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # --- Approval workflow ---
    status: Mapped[str] = mapped_column(
        String(30), default="pending_verification", nullable=False, index=True
    )
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    reviewer: Mapped[Optional["User"]] = relationship("User", foreign_keys=[reviewed_by])
