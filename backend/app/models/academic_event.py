import uuid
from datetime import date, time
from typing import Optional
from sqlalchemy import Column, String, Text, Boolean, Date, Time, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.models.base import Base, TimestampMixin, SoftDeleteMixin


class AcademicEvent(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "academic_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    event_category = Column(String(50), nullable=False, default="other")  # guest_lecture, workshop, exam_midterm, exam_endterm, milestone_deadline, placement_drive, conclave, industrial_visit, orientation, holiday, faculty_meeting, other
    
    # Scope
    program_id = Column(UUID(as_uuid=True), ForeignKey("programs.id", ondelete="SET NULL"), nullable=True)
    batch_id = Column(UUID(as_uuid=True), ForeignKey("batches.id", ondelete="SET NULL"), nullable=True)
    division_id = Column(UUID(as_uuid=True), ForeignKey("divisions.id", ondelete="SET NULL"), nullable=True)
    
    # Timing
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    start_time = Column(Time, nullable=True)
    end_time = Column(Time, nullable=True)
    is_all_day = Column(Boolean, nullable=False, default=False)
    
    # Venue & Delivery
    venue = Column(String(255), nullable=True)
    mode = Column(String(50), nullable=False, default="offline")  # offline, online, hybrid
    
    # Details
    organizer_name = Column(String(255), nullable=True)
    speaker_guest_details = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    target_audience = Column(String(100), default="all_students")
    is_mandatory = Column(Boolean, nullable=False, default=True)
    registration_link = Column(Text, nullable=True)
    
    # Status & Appearance
    status = Column(String(50), nullable=False, default="scheduled")  # scheduled, in_progress, completed, postponed, cancelled
    color_code = Column(String(30), nullable=True)
    poster_url = Column(Text, nullable=True)
    poster_filename = Column(String(255), nullable=True)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    program = relationship("Program", lazy="joined")
    batch = relationship("Batch", lazy="joined")
    division = relationship("Division", lazy="joined")
    created_by = relationship("User", foreign_keys=[created_by_id], lazy="joined")
