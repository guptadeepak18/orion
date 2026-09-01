from datetime import date, time, datetime
from typing import Optional, List, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class AttendanceCorrectionCreate(BaseModel):
    attendance_id: UUID
    requested_status: str  # present | excused | leave_approved | od_duty | late
    reason: str
    document_url: Optional[str] = None


class AttendanceCorrectionReview(BaseModel):
    action: str  # approved | rejected
    remarks: Optional[str] = None


class AttendanceCorrectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    attendance_id: UUID
    session_id: UUID
    student_id: UUID
    requested_by_id: UUID
    student_name: Optional[str] = None
    student_prn: Optional[str] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    batch_name: Optional[str] = None
    session_date: Optional[date] = None
    session_time: Optional[str] = None
    venue: Optional[str] = None
    current_status: str
    requested_status: str
    reason: str
    document_url: Optional[str] = None
    status: str  # pending_faculty_approval | pending_admin_approval | approved | rejected
    faculty_approver_id: Optional[UUID] = None
    faculty_approver_name: Optional[str] = None
    faculty_action: Optional[str] = None
    faculty_acted_at: Optional[datetime] = None
    faculty_remarks: Optional[str] = None
    admin_approver_id: Optional[UUID] = None
    admin_approver_name: Optional[str] = None
    admin_action: Optional[str] = None
    admin_acted_at: Optional[datetime] = None
    admin_remarks: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime


class SubjectStudentAttendanceItem(BaseModel):
    student_id: UUID
    student_name: str
    student_prn: str
    roll_no: Optional[str] = None
    sessions_conducted: int
    attended_count: int
    absent_count: int
    excused_count: int
    attendance_percentage: float
    is_debarred_risk: bool  # True if < 75%


class SubjectSessionAttendanceItem(BaseModel):
    session_id: UUID
    session_date: date
    start_time: str
    end_time: str
    topic_delivered: Optional[str] = None
    venue: str
    faculty_name: Optional[str] = None
    attendance_status: str
    is_locked: bool
    present_count: int
    absent_count: int
    total_students: int


class SubjectAttendanceSummaryResponse(BaseModel):
    subject_id: UUID
    subject_name: str
    subject_code: Optional[str] = None
    batch_id: Optional[UUID] = None
    batch_name: Optional[str] = None
    program_name: Optional[str] = None
    total_sessions_conducted: int
    total_sessions_scheduled: int
    total_delivered_hours: float
    class_average_percentage: float
    students_summary: List[SubjectStudentAttendanceItem]
    recent_sessions: List[SubjectSessionAttendanceItem]


class StudentSubjectAttendanceBreakdown(BaseModel):
    subject_id: UUID
    subject_name: str
    subject_code: Optional[str] = None
    total_sessions: int
    attended: int
    absent: int
    excused: int
    percentage: float
    is_at_risk: bool


class StudentSessionAttendanceRecordItem(BaseModel):
    attendance_id: UUID
    session_id: UUID
    subject_id: UUID
    subject_name: str
    subject_code: Optional[str] = None
    faculty_name: Optional[str] = None
    session_date: date
    start_time: str
    end_time: str
    venue: str
    status: str
    remarks: Optional[str] = None
    is_locked: bool
    has_pending_correction: bool = False
    correction_request_id: Optional[UUID] = None
    correction_status: Optional[str] = None


class StudentAttendanceDossierResponse(BaseModel):
    student_id: UUID
    student_name: str
    student_prn: str
    roll_no: Optional[str] = None
    program_name: Optional[str] = None
    batch_name: Optional[str] = None
    overall_attendance_percentage: float
    total_classes_conducted: int
    total_classes_attended: int
    subjects_breakdown: List[StudentSubjectAttendanceBreakdown]
    session_records: List[StudentSessionAttendanceRecordItem]


class DebarredStudentItemResponse(BaseModel):
    student_id: UUID
    student_name: str
    student_prn: str
    roll_no: Optional[str] = None
    program_name: Optional[str] = None
    batch_name: Optional[str] = None
    attendance_percentage: float
    total_sessions: int
    attended_sessions: int
    shortfall_sessions: int
