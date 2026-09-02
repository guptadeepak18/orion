from datetime import date, time, datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, model_validator

_UUID_FIELDS = {"timetable_id", "subject_id", "topic_id", "faculty_internal_id", "faculty_external_id",
                "program_id", "batch_id", "semester_id", "original_subject_id",
                "original_faculty_internal_id", "original_faculty_external_id", "rescheduled_session_id",
                "variance_recorded_by_id", "swapped_subject_id", "swapped_topic_id",
                "substitute_faculty_internal_id", "substitute_faculty_external_id"}


def _clean_uuid_fields(data):
    """Convert empty/invalid/falsy non-None values to None (or valid UUID) for UUID fields."""
    if not isinstance(data, dict):
        return data
    for key in list(data.keys()):
        if key in _UUID_FIELDS or key.endswith("_id"):
            val = data[key]
            if val is None:
                continue
            if isinstance(val, UUID):
                continue
            if isinstance(val, str):
                s = val.strip()
                if not s or s.lower() in ("null", "undefined", "none", "nan", ""):
                    data[key] = None
                    continue
                try:
                    data[key] = UUID(s)
                except (ValueError, TypeError, AttributeError):
                    data[key] = None
                continue
            # Everything else (e.g. 0, False, [], {}) -> None
            data[key] = None
    return data


# Session schemas
class SessionCreate(BaseModel):
    timetable_id: Optional[UUID] = None
    program_id: UUID
    batch_id: UUID
    semester_id: UUID
    subject_id: Optional[UUID] = None
    topic_id: Optional[UUID] = None
    session_date: date
    start_time: time
    end_time: time
    session_type: str = "lecture"
    faculty_type: str  # internal|external
    faculty_internal_id: Optional[UUID] = None
    faculty_external_id: Optional[UUID] = None
    venue: str
    mode: str = "offline"  # online|offline|hybrid
    duration_minutes: int
    notes: Optional[str] = None
    hyperbuild_activity_no: Optional[int] = None
    lecture_number: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def clean_uuids(cls, data):
        return _clean_uuid_fields(data)


class SessionUpdate(BaseModel):
    program_id: Optional[UUID] = None
    batch_id: Optional[UUID] = None
    semester_id: Optional[UUID] = None
    subject_id: Optional[UUID] = None
    topic_id: Optional[UUID] = None
    session_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    session_type: Optional[str] = None
    faculty_type: Optional[str] = None
    faculty_internal_id: Optional[UUID] = None
    faculty_external_id: Optional[UUID] = None
    venue: Optional[str] = None
    mode: Optional[str] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    hyperbuild_activity_no: Optional[int] = None
    lecture_number: Optional[int] = None

    @model_validator(mode="before")
    @classmethod
    def clean_uuids(cls, data):
        return _clean_uuid_fields(data)


class SessionResponse(BaseModel):
    id: UUID
    timetable_id: Optional[UUID] = None
    program_id: UUID
    batch_id: UUID
    semester_id: UUID
    subject_id: Optional[UUID] = None
    topic_id: Optional[UUID] = None
    session_date: date
    start_time: time
    end_time: time
    session_type: str
    faculty_type: str
    faculty_internal_id: Optional[UUID] = None
    faculty_external_id: Optional[UUID] = None
    venue: str
    mode: str
    duration_minutes: int
    status: str
    attendance_status: Optional[str] = None
    hyperbuild_activity_no: Optional[int] = None
    lecture_number: Optional[int] = None
    feedback_status: Optional[str] = None
    notes: Optional[str] = None

    # Baseline & Real-Time Variance Details
    variance_status: str = "as_planned"
    variance_reason: Optional[str] = None
    variance_recorded_at: Optional[datetime] = None
    original_subject_id: Optional[UUID] = None
    original_subject_name: Optional[str] = None
    original_subject_code: Optional[str] = None
    original_faculty_type: Optional[str] = None
    original_faculty_internal_id: Optional[UUID] = None
    original_faculty_external_id: Optional[UUID] = None
    original_faculty_name: Optional[str] = None
    original_venue: Optional[str] = None
    rescheduled_session_id: Optional[UUID] = None
    variance_history: Optional[Any] = None

    # Enriched details for Daily/Weekly views
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    topic_name: Optional[str] = None
    faculty_name: Optional[str] = None
    program_name: Optional[str] = None
    batch_name: Optional[str] = None
    hyperbuild_activities: Optional[List[Any]] = None

    model_config = ConfigDict(from_attributes=True)


class SessionVarianceRecordRequest(BaseModel):
    variance_type: str  # faculty_substitution | subject_swapped | cancelled | rescheduled | special_replacement | revert_as_planned
    reason: str
    substitute_faculty_type: Optional[str] = None  # internal | external
    substitute_faculty_internal_id: Optional[UUID] = None
    substitute_faculty_external_id: Optional[UUID] = None
    swapped_subject_id: Optional[UUID] = None
    swapped_topic_id: Optional[UUID] = None
    new_venue: Optional[str] = None
    rescheduled_date: Optional[date] = None
    rescheduled_start_time: Optional[time] = None
    rescheduled_end_time: Optional[time] = None

    @model_validator(mode="before")
    @classmethod
    def clean_uuids(cls, data):
        return _clean_uuid_fields(data)


class TimetableVarianceItem(BaseModel):
    session_id: UUID
    session_date: date
    start_time: str
    end_time: str
    venue: str
    program_name: Optional[str] = None
    batch_name: Optional[str] = None
    planned_subject_name: str
    planned_subject_code: Optional[str] = None
    planned_faculty_name: str
    planned_faculty_type: str
    actual_subject_name: str
    actual_subject_code: Optional[str] = None
    actual_faculty_name: str
    actual_faculty_type: str
    status: str
    variance_status: str
    variance_reason: Optional[str] = None
    variance_recorded_at: Optional[datetime] = None
    is_adherent: bool = True

    model_config = ConfigDict(from_attributes=True)


class TimetableVarianceSummaryResponse(BaseModel):
    total_planned_sessions: int
    conducted_as_planned: int
    faculty_substituted: int
    subject_swapped: int
    cancelled_sessions: int
    rescheduled_sessions: int
    adherence_percentage: float
    reasons_distribution: dict
    faculty_variance_summary: List[dict] = []
    subject_variance_summary: List[dict] = []
    sessions_breakdown: List[TimetableVarianceItem] = []


class SessionBulkEditRequest(BaseModel):
    session_ids: List[UUID]
    session_date: Optional[date] = None
    venue: Optional[str] = None
    mode: Optional[str] = None
    status: Optional[str] = None



# Timetable Schemas
class TimetableCreate(BaseModel):
    batch_id: UUID
    term_label: str
    source: str = "manual"  # upload_excel|upload_csv|manual


class TimetableResponse(BaseModel):
    id: UUID
    batch_id: UUID
    term_label: str
    source: str
    status: str
    created_by: UUID

    model_config = ConfigDict(from_attributes=True)


# Timetable Import Preview
class RawImportRow(BaseModel):
    row_number: int
    session_date: str
    start_time: str
    end_time: str
    subject_code: str
    topic_name: Optional[str] = None
    faculty_email: str
    faculty_type: str
    venue: str
    mode: str = "offline"


class TimetableImportPreviewResponse(BaseModel):
    total_rows: int
    valid_rows: List[RawImportRow]
    conflicts: List[dict]
    unmapped_subjects: List[str]
    unmapped_faculty: List[str]


class TimetableCommitRequest(BaseModel):
    batch_id: UUID
    term_label: str
    valid_rows: List[RawImportRow]


# Student Attendance Schemas
class StudentAttendanceItem(BaseModel):
    student_id: UUID
    status: str = "present"  # present | absent | late | excused
    remarks: Optional[str] = None


class SessionAttendanceBulkRequest(BaseModel):
    attendances: List[StudentAttendanceItem]


class StudentAttendanceRecordResponse(BaseModel):
    id: Optional[UUID] = None
    session_id: UUID
    student_id: UUID
    student_name: str
    student_prn: str
    status: str
    remarks: Optional[str] = None
    session_date: Optional[date] = None
    subject_name: Optional[str] = None
    venue: Optional[str] = None
    specialization_major: Optional[str] = None
    specialization_minor: Optional[str] = None
    specializations: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SessionAttendanceSheetResponse(BaseModel):
    session_id: UUID
    batch_id: UUID
    batch_name: Optional[str] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    course_category: Optional[str] = "core"
    elective_domain: Optional[str] = None
    session_type: Optional[str] = "lecture"
    session_date: date
    start_time: time
    end_time: time
    venue: str
    status: str
    attendance_status: Optional[str] = None
    total_students: int
    present_count: int
    absent_count: int
    students: List[StudentAttendanceRecordResponse]


