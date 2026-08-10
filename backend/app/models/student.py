import uuid
from typing import Optional
from sqlalchemy import String, Float, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class Student(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    
    # 1 & 2. Name details
    first_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    last_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    gender: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="Male")

    # 3 & 4. Parents
    father_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    mother_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")

    # 5, 6, 7, 8. Contact details
    mobile_number: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    email_official: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    email_personal: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    alternate_contact_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # 9, 10, 11. Emergency contact
    emergency_contact_number: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    emergency_contact_name: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    emergency_contact_relation: Mapped[str] = mapped_column(String(100), nullable=False, default="")

    # 12 & 13. Health & Identification
    blood_group: Mapped[str] = mapped_column(String(20), nullable=False, default="O+")
    prn_number: Mapped[str] = mapped_column(String(50), index=True, nullable=False, default="")

    # 14 & 15. Program and Batch
    program_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("programs.id", ondelete="SET NULL"), nullable=True
    )
    batch_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True
    )

    # 16. Trimester
    trimester: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # 17 & 18. Undergraduate Background
    ug_degree: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    ug_score_type: Mapped[str] = mapped_column(String(20), default="cgpa", nullable=False)  # 'cgpa' or 'percentage'
    ug_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # 19 & 20. Specializations
    specialization_major: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    specialization_minor: Mapped[str] = mapped_column(String(150), nullable=False, default="")

    # Backwards compatibility & operational tracking
    roll_no: Mapped[str] = mapped_column(String(50), index=True, nullable=False, default="")
    enrollment_no: Mapped[str] = mapped_column(String(50), index=True, nullable=False, default="")
    email: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    cgpa: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    attendance_percentage: Mapped[float] = mapped_column(Float, default=100.0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User")
    program: Mapped[Optional["Program"]] = relationship("Program")
    batch: Mapped[Optional["Batch"]] = relationship("Batch")
