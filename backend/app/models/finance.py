import uuid
from datetime import datetime, date, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Numeric, Date, DateTime, Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class RemunerationRule(Base, TimestampMixin):
    __tablename__ = "remuneration_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    faculty_external_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("faculty_external.id", ondelete="CASCADE"), nullable=True
    )
    rate_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # fixed|per_hour|per_session|custom
    rate_value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    tax_percent: Mapped[float] = mapped_column(Numeric(5, 2), default=18.0, nullable=False)
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    faculty_external: Mapped[Optional["FacultyExternal"]] = relationship("FacultyExternal")


class RemunerationCalculation(Base, TimestampMixin):
    __tablename__ = "remuneration_calculations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("engagements.id", ondelete="CASCADE"), nullable=False
    )
    rule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("remuneration_rules.id", ondelete="SET NULL"), nullable=True
    )
    hours: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    gross_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    deductions: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    net_payable: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    is_anomaly_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    anomaly_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    calculated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    engagement: Mapped["Engagement"] = relationship("Engagement", foreign_keys=[engagement_id])
    rule: Mapped[Optional["RemunerationRule"]] = relationship("RemunerationRule")


class Invoice(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    engagement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("engagements.id", ondelete="RESTRICT"), nullable=False
    )
    faculty_external_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("faculty_external.id", ondelete="RESTRICT"), nullable=False
    )
    invoice_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    gst_amount: Mapped[float] = mapped_column(Numeric(10, 2), default=0.0, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    file_path: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="draft", nullable=False
    )  # draft|submitted|verified|paid|rejected
    ocr_mismatch: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    engagement: Mapped["Engagement"] = relationship("Engagement")
    faculty_external: Mapped["FacultyExternal"] = relationship("FacultyExternal")
    verifier: Mapped[Optional["User"]] = relationship("User")
    payments: Mapped[List["Payment"]] = relationship(
        "Payment", back_populates="invoice", cascade="all, delete-orphan"
    )


class Payment(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    paid_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    payment_reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False
    )  # pending|released|failed

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")
