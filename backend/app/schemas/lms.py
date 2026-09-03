from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, date
from pydantic import BaseModel, ConfigDict

# --- Resources Schemas ---
class ResourceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    resource_type: str = "document"
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    external_link: Optional[str] = None
    unit_number: Optional[int] = None
    is_published: bool = True

class ResourceResponse(BaseModel):
    id: UUID
    subject_id: UUID
    title: str
    description: Optional[str] = None
    resource_type: str
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    external_link: Optional[str] = None
    unit_number: Optional[int] = None
    is_published: bool
    uploaded_by_id: Optional[UUID] = None
    uploaded_by_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Recordings Schemas ---
class RecordingCreate(BaseModel):
    title: str
    recording_url: str
    recording_date: Optional[date] = None
    duration_minutes: Optional[int] = None
    platform: str = "Zoom"
    topic_covered: Optional[str] = None
    unit_number: Optional[int] = None
    passcode: Optional[str] = None
    is_published: bool = True
    session_id: Optional[UUID] = None

class RecordingUpdate(BaseModel):
    title: Optional[str] = None
    recording_url: Optional[str] = None
    recording_date: Optional[date] = None
    duration_minutes: Optional[int] = None
    platform: Optional[str] = None
    topic_covered: Optional[str] = None
    unit_number: Optional[int] = None
    passcode: Optional[str] = None
    is_published: Optional[bool] = None

class RecordingResponse(BaseModel):
    id: UUID
    subject_id: UUID
    session_id: Optional[UUID] = None
    title: str
    recording_url: str
    recording_date: Optional[date] = None
    duration_minutes: Optional[int] = None
    platform: str
    topic_covered: Optional[str] = None
    unit_number: Optional[int] = None
    passcode: Optional[str] = None
    is_published: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# --- Assessment Schemas ---
class AssessmentCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assessment_type: str = "assignment"
    total_marks: float = 100.0
    weightage_percentage: Optional[float] = None
    due_date: Optional[datetime] = None
    instructions: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    is_published: bool = True

class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assessment_type: Optional[str] = None
    total_marks: Optional[float] = None
    weightage_percentage: Optional[float] = None
    due_date: Optional[datetime] = None
    instructions: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    is_published: Optional[bool] = None

class SubmissionCreate(BaseModel):
    submission_text: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None

class SubmissionGrade(BaseModel):
    marks_obtained: float
    feedback: Optional[str] = None
    status: str = "graded"

class SubmissionResponse(BaseModel):
    id: UUID
    assessment_id: UUID
    student_id: UUID
    student_name: Optional[str] = None
    student_prn: Optional[str] = None
    submission_text: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    submitted_at: datetime
    status: str
    marks_obtained: Optional[float] = None
    graded_by_name: Optional[str] = None
    graded_at: Optional[datetime] = None
    feedback: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class AssessmentResponse(BaseModel):
    id: UUID
    subject_id: UUID
    title: str
    description: Optional[str] = None
    assessment_type: str
    total_marks: float
    weightage_percentage: Optional[float] = None
    due_date: Optional[datetime] = None
    instructions: Optional[str] = None
    attachment_url: Optional[str] = None
    attachment_name: Optional[str] = None
    is_published: bool
    created_at: Optional[datetime] = None
    my_submission: Optional[SubmissionResponse] = None
    submissions_count: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


# --- HyperBuild Activity Submissions ---
class ActivitySubmissionCreate(BaseModel):
    submission_text: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    files: Optional[List[Dict[str, Any]]] = None  # List of {file_name, file_url, file_size, file_type, saved_path}
    ai_verification_notes: Optional[str] = None

class ActivitySubmissionGrade(BaseModel):
    grade: str  # Distinction|Merit|Pass|Needs Work
    score: Optional[float] = None
    feedback: Optional[str] = None
    status: str = "graded"

class ActivitySubmissionResponse(BaseModel):
    id: UUID
    activity_id: UUID
    student_id: UUID
    student_name: Optional[str] = None
    student_prn: Optional[str] = None
    submission_text: Optional[str] = None
    file_url: Optional[str] = None
    file_name: Optional[str] = None
    file_size: Optional[int] = None
    files: Optional[List[Dict[str, Any]]] = None
    ai_verification_notes: Optional[str] = None
    ai_evaluation: Optional[Dict[str, Any]] = None
    submitted_at: datetime
    status: str
    grade: Optional[str] = None
    score: Optional[float] = None
    graded_by_name: Optional[str] = None
    graded_at: Optional[datetime] = None
    feedback: Optional[str] = None
    allow_resubmission: bool = False
    resubmission_granted_at: Optional[datetime] = None
    resubmission_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class GrantResubmissionRequest(BaseModel):
    reason: Optional[str] = None



# --- Attendance Summary ---
class SubjectAttendanceSessionItem(BaseModel):
    session_id: UUID
    session_date: date
    start_time: str
    end_time: str
    session_type: str
    topic_name: Optional[str] = None
    venue: str
    status: str  # present|absent|late|excused
    remarks: Optional[str] = None

class SubjectAttendanceResponse(BaseModel):
    total_sessions_conducted: int
    sessions_attended: int
    attendance_percentage: float
    sessions_log: List[SubjectAttendanceSessionItem]


# --- Enrolled Subject Card ---
class EnrolledSubjectCard(BaseModel):
    id: UUID
    name: str
    code: str
    course_code: Optional[str] = None
    trimester: int
    credits: int
    is_non_credit: bool
    total_hours: Optional[int] = 30
    course_category: Optional[str] = "core"
    elective_domain: Optional[str] = None
    program_id: Optional[UUID] = None
    program_name: Optional[str] = None
    batch_id: Optional[UUID] = None
    batch_name: Optional[str] = None
    faculty_name: Optional[str] = None
    attendance_percentage: float
    resources_count: int
    recordings_count: int
    activities_count: int
    assessments_count: int
    units_count: int = 0
    case_studies_count: int = 0
    course_overview: Optional[str] = None
    total_marks: int = 100

    model_config = ConfigDict(from_attributes=True)
