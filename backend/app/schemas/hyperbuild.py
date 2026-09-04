from datetime import date, time, datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.schemas.session import _clean_uuid_fields


class HyperbuildActivityBase(BaseModel):
    activity_no: int
    title: str
    description: Optional[str] = None
    subject_id: Optional[UUID] = None
    start_time: time
    end_time: time
    duration_minutes: int
    submission_type: str = "link_or_text"  # link_or_text | file | pulse_check | checklist
    instructions: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def clean_uuids(cls, data):
        return _clean_uuid_fields(data)


class HyperbuildActivityCreate(HyperbuildActivityBase):
    pass


class HyperbuildActivityUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    subject_id: Optional[UUID] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    duration_minutes: Optional[int] = None
    submission_type: Optional[str] = None
    instructions: Optional[str] = None
    status: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def clean_uuids(cls, data):
        return _clean_uuid_fields(data)


class HyperbuildActivityResponse(BaseModel):
    id: UUID
    session_id: UUID
    activity_no: int
    title: str
    description: Optional[str] = None
    subject_id: Optional[UUID] = None
    start_time: time
    end_time: time
    duration_minutes: int
    submission_type: str
    instructions: Optional[str] = None
    status: str  # pending | active | closed
    challenge_key: Optional[str] = None
    challenge_key_active_until: Optional[datetime] = None

    # Dynamic Window Management & Lock Status
    auto_lock_at_end_time: bool = True
    is_submission_locked: bool = False
    extended_until: Optional[datetime] = None
    reopened_until: Optional[datetime] = None
    is_reopened_indefinite: bool = False
    lock_reason: Optional[str] = None
    is_window_open: bool = True
    
    # Enriched Academic Context
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    course_category: Optional[str] = None
    elective_domain: Optional[str] = None
    
    # Student Personalized Context (when queried by student)
    is_eligible: bool = True
    eligibility_reason: Optional[str] = None
    is_verified_by_student: bool = False
    student_verification_status: Optional[str] = None
    
    # Stats (for faculty)
    verified_count: int = 0
    total_eligible_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class HyperbuildExtendWindowRequest(BaseModel):
    extension_minutes: int = Field(default=15, ge=1, le=360, description="Additional minutes to keep submission window open")
    reason: Optional[str] = Field(default=None, max_length=500, description="Optional justification for audit trail")


class HyperbuildLockWindowRequest(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500, description="Reason for locking submissions")


class HyperbuildReopenWindowRequest(BaseModel):
    mode: str = Field(default="timed", description="'timed' (reopen with countdown) or 'manual_indefinite' (reopen until faculty locks)")
    duration_minutes: Optional[int] = Field(default=15, ge=1, le=360, description="Timer duration if mode is timed")
    reason: Optional[str] = Field(default=None, max_length=500, description="Reason for reopening window")


class HyperbuildWindowActionResponse(BaseModel):
    activity_id: UUID
    session_id: UUID
    is_submission_locked: bool
    is_window_open: bool
    window_open_until: Optional[datetime] = None
    is_reopened_indefinite: bool = False
    action_performed: str
    message: str


class HyperbuildActivityAuditLogItem(BaseModel):
    id: UUID
    activity_id: UUID
    session_id: UUID
    faculty_id: Optional[UUID] = None
    faculty_name: Optional[str] = None
    action: str
    extension_minutes: Optional[int] = None
    reopened_duration_minutes: Optional[int] = None
    previous_status: Optional[str] = None
    new_status: Optional[str] = None
    window_open_until: Optional[datetime] = None
    reason: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HyperbuildAuditLogListResponse(BaseModel):
    activity_id: UUID
    total_events: int
    logs: List[HyperbuildActivityAuditLogItem]


class HyperbuildConfigureRequest(BaseModel):
    activities: List[HyperbuildActivityCreate]

    @model_validator(mode="before")
    @classmethod
    def clean_activities(cls, data):
        if isinstance(data, dict) and "activities" in data and isinstance(data["activities"], list):
            data["activities"] = [_clean_uuid_fields(act) for act in data["activities"]]
        return data


class HyperbuildChallengeKeyTriggerResponse(BaseModel):
    activity_id: UUID
    activity_no: int
    title: str
    challenge_key: str
    active_until: datetime
    active_seconds: int = 60


class HyperbuildVerificationRequest(BaseModel):
    challenge_key: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    submission_url: Optional[str] = None
    submission_text: Optional[str] = None


class HyperbuildVerificationResponse(BaseModel):
    activity_id: UUID
    student_id: UUID
    is_verified: bool
    verification_status: str
    is_geofence_valid: bool
    distance_from_campus_meters: Optional[float] = None
    message: str
    credited_subject_id: UUID
    credited_subject_name: str
    credited_duration_minutes: int
    verified_at: datetime


class HyperbuildSessionDetailResponse(BaseModel):
    session_id: UUID
    session_date: date
    start_time: time
    end_time: time
    venue: str
    duration_minutes: int
    status: str
    total_activities: int
    active_activity_id: Optional[UUID] = None
    activities: List[HyperbuildActivityResponse]

    model_config = ConfigDict(from_attributes=True)


class HyperbuildLiveRosterStudentItem(BaseModel):
    student_id: UUID
    full_name: str
    email: str
    prn_no: Optional[str] = None
    roll_no: Optional[str] = None
    major_specialization: Optional[str] = None
    minor_specialization: Optional[str] = None
    is_eligible: bool
    is_verified: bool
    verification_status: str  # verified_present | unverified_absent | not_applicable
    verified_at: Optional[datetime] = None
    submission_url: Optional[str] = None
    submission_text: Optional[str] = None
    distance_meters: Optional[float] = None
    is_geofence_valid: bool = True


class HyperbuildLiveRosterResponse(BaseModel):
    activity_id: UUID
    activity_no: int
    activity_title: str
    subject_name: str
    subject_code: Optional[str] = None
    course_category: str
    elective_domain: Optional[str] = None
    status: str
    challenge_key: Optional[str] = None
    challenge_key_active_until: Optional[datetime] = None
    total_batch_students: int
    total_eligible_students: int
    total_verified_present: int
    roster: List[HyperbuildLiveRosterStudentItem]


class HyperbuildManualAttendanceUpdateRequest(BaseModel):
    student_id: UUID
    status: str = Field(..., description="'present' | 'absent' | 'late' | 'excused'")
    remarks: Optional[str] = None


class HyperbuildBulkAttendanceUpdateRequest(BaseModel):
    updates: List[HyperbuildManualAttendanceUpdateRequest]
