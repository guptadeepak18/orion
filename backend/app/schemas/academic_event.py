import uuid
from datetime import date, time, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class AcademicEventBase(BaseModel):
    title: str
    event_category: str = "other"  # guest_lecture, workshop, exam_midterm, exam_endterm, milestone_deadline, placement_drive, conclave, industrial_visit, orientation, holiday, faculty_meeting, other
    program_id: Optional[uuid.UUID] = None
    batch_id: Optional[uuid.UUID] = None
    division_id: Optional[uuid.UUID] = None
    start_date: date
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_all_day: bool = False
    venue: Optional[str] = None
    mode: str = "offline"  # offline, online, hybrid
    organizer_name: Optional[str] = None
    speaker_guest_details: Optional[str] = None
    description: Optional[str] = None
    target_audience: Optional[str] = "all_students"
    is_mandatory: bool = True
    registration_link: Optional[str] = None
    status: str = "scheduled"  # scheduled, in_progress, completed, postponed, cancelled
    color_code: Optional[str] = None
    poster_url: Optional[str] = None
    poster_filename: Optional[str] = None


class AcademicEventCreate(AcademicEventBase):
    pass


class AcademicEventUpdate(BaseModel):
    title: Optional[str] = None
    event_category: Optional[str] = None
    program_id: Optional[uuid.UUID] = None
    batch_id: Optional[uuid.UUID] = None
    division_id: Optional[uuid.UUID] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_all_day: Optional[bool] = None
    venue: Optional[str] = None
    mode: Optional[str] = None
    organizer_name: Optional[str] = None
    speaker_guest_details: Optional[str] = None
    description: Optional[str] = None
    target_audience: Optional[str] = None
    is_mandatory: Optional[bool] = None
    registration_link: Optional[str] = None
    status: Optional[str] = None
    color_code: Optional[str] = None
    poster_url: Optional[str] = None
    poster_filename: Optional[str] = None


class AcademicEventResponse(AcademicEventBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_by_id: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Enriched fields for easy UI consumption
    program_name: Optional[str] = None
    program_code: Optional[str] = None
    batch_name: Optional[str] = None
    batch_code: Optional[str] = None
    division_name: Optional[str] = None
    division_code: Optional[str] = None
    created_by_name: Optional[str] = None
