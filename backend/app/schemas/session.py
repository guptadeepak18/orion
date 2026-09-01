from datetime import date, time
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, ConfigDict


# Session schemas
class SessionCreate(BaseModel):
    timetable_id: Optional[UUID] = None
    program_id: UUID
    batch_id: UUID
    semester_id: UUID
    subject_id: UUID
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


class SessionUpdate(BaseModel):
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


class SessionResponse(BaseModel):
    id: UUID
    timetable_id: Optional[UUID] = None
    program_id: UUID
    batch_id: UUID
    semester_id: UUID
    subject_id: UUID
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
    feedback_status: Optional[str] = None
    notes: Optional[str] = None

    # Enriched details for Daily/Weekly views
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    topic_name: Optional[str] = None
    faculty_name: Optional[str] = None
    program_name: Optional[str] = None
    batch_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


class SessionAttendanceSheetResponse(BaseModel):
    session_id: UUID
    batch_id: UUID
    batch_name: Optional[str] = None
    subject_name: Optional[str] = None
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

