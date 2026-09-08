from datetime import date, time, datetime
from typing import Optional, List, Dict, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class AttendanceCorrectionCreate(BaseModel):
    attendance_id: UUID
    session_id: Optional[UUID] = None
    student_id: Optional[UUID] = None
    activity_ids: Optional[List[UUID]] = None
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
    activity_ids: Optional[List[UUID]] = None
    activities_details: Optional[List[Dict[str, Any]]] = None
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

    # Category 1: Academic Lectures
    academic_total: int = 0
    academic_attended: int = 0
    academic_absent: int = 0
    academic_excused: int = 0
    academic_percentage: Optional[float] = None
    academic_eligible: bool = True
    academic_status: str = "safe"  # "safe" | "at_risk" | "pending"
    academic_shortfall: int = 0

    # Category 2: HyperBuild Activities
    hyperbuild_total: int = 0
    hyperbuild_attended: int = 0
    hyperbuild_absent: int = 0
    hyperbuild_excused: int = 0
    hyperbuild_percentage: Optional[float] = None
    hyperbuild_eligible: bool = True
    hyperbuild_status: str = "safe"  # "safe" | "at_risk" | "pending"
    hyperbuild_shortfall: int = 0

    # Combined metrics
    total_sessions: int = 0
    attended: int = 0
    absent: int = 0
    excused: int = 0
    percentage: float = 0.0

    # Exam Debarment & Eligibility Standing
    is_exam_eligible: bool = True
    is_debarred: bool = False
    debarred_category: Optional[str] = None  # None | "academic_only" | "hyperbuild_only" | "both"
    debarment_reason: Optional[str] = None
    is_at_risk: bool = False


class StudentSessionAttendanceRecordItem(BaseModel):
    attendance_id: UUID
    session_id: UUID
    activity_id: Optional[UUID] = None
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
    category: str = "academic_lecture"  # "academic_lecture" | "hyperbuild_activity"
    category_label: str = "Academic Lecture"  # "Academic Lecture" | "HyperBuild Activity"
    activity_title: Optional[str] = None
    activity_no: Optional[int] = None


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
    overall_academic_total: int = 0
    overall_academic_attended: int = 0
    overall_academic_percentage: float = 0.0
    overall_hyperbuild_total: int = 0
    overall_hyperbuild_attended: int = 0
    overall_hyperbuild_percentage: float = 0.0
    subjects_breakdown: List[StudentSubjectAttendanceBreakdown]
    session_records: List[StudentSessionAttendanceRecordItem]


class DebarredStudentItemResponse(BaseModel):
    student_id: UUID
    student_name: str
    student_prn: str
    roll_no: Optional[str] = None
    program_name: Optional[str] = None
    batch_name: Optional[str] = None
    subject_id: Optional[UUID] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    overall_percentage: float
    attendance_percentage: float  # Backwards compatibility
    total_sessions: int
    attended_sessions: int
    shortfall_sessions: int
    academic_percentage: Optional[float] = None
    academic_attended: int = 0
    academic_total: int = 0
    hyperbuild_percentage: Optional[float] = None
    hyperbuild_attended: int = 0
    hyperbuild_total: int = 0
    debarred_category: str = "overall"  # "academic", "hyperbuild", "both", "overall"
    debarment_reason: str = ""


class StudentLedgerItem(BaseModel):
    id: UUID
    student_id: UUID
    student_prn: str
    student_name: str
    roll_no: Optional[str] = None
    official_email: Optional[str] = None
    personal_email: Optional[str] = None
    phone: Optional[str] = None
    program_name: Optional[str] = None
    batch_name: Optional[str] = None
    division: Optional[str] = None
    trimester: Optional[int] = None
    session_id: UUID
    session_date: date
    day_of_week: str
    start_time: str
    end_time: str
    time_slot: str
    subject_id: Optional[UUID] = None
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    session_type: str
    topic_delivered: Optional[str] = None
    venue: str
    faculty_name: Optional[str] = None
    status: str
    remarks: Optional[str] = None
    is_locked: bool = False
    marked_at: Optional[datetime] = None
    activity_id: Optional[UUID] = None
    attendance_id: Optional[UUID] = None
    category: Optional[str] = None  # "Academic Lecture" | "HyperBuild Activity"
    activity_title: Optional[str] = None
    activity_no: Optional[int] = None


class StudentLedgerSummary(BaseModel):
    total_records: int
    present_count: int
    absent_count: int
    late_count: int
    excused_count: int
    od_count: int
    attendance_percentage: float
    unique_students: int
    unique_sessions: int


class StudentLedgerResponse(BaseModel):
    items: List[StudentLedgerItem]
    summary: StudentLedgerSummary
    total: int


class StudentLedgerExportRequest(BaseModel):
    fields: List[str]
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    batch_id: Optional[UUID] = None
    subject_id: Optional[UUID] = None
    session_id: Optional[UUID] = None
    category: Optional[str] = None
    status: Optional[str] = None
    search: Optional[str] = None
    filename: Optional[str] = None

