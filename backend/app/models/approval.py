import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import String, Text, Integer, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class ApprovalWorkflow(Base, TimestampMixin):
    __tablename__ = "approval_workflows"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    applies_to: Mapped[str] = mapped_column(String(50), nullable=False)  # engagement|invoice
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    stages: Mapped[List["ApprovalStage"]] = relationship(
        "ApprovalStage", back_populates="workflow", cascade="all, delete-orphan"
    )


class ApprovalStage(Base, TimestampMixin):
    __tablename__ = "approval_stages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_workflows.id", ondelete="CASCADE"), nullable=False
    )
    sequence_no: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    approver_role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False
    )
    sla_hours: Mapped[int] = mapped_column(Integer, default=24, nullable=False)

    workflow: Mapped["ApprovalWorkflow"] = relationship("ApprovalWorkflow", back_populates="stages")
    approver_role: Mapped["Role"] = relationship("Role")


class ApprovalAction(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "approval_actions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("approval_stages.id", ondelete="RESTRICT"), nullable=False
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # engagement|invoice
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )  # null = agent action
    action: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # approved|rejected|escalated|commented
    comments: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    context_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    previous_status: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    new_status: Mapped[str] = mapped_column(String(50), nullable=False)
    acted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    stage: Mapped["ApprovalStage"] = relationship("ApprovalStage")
    actor: Mapped[Optional["User"]] = relationship("User")
