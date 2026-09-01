from typing import Optional
from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    active_programs_count: int
    faculty_count: int
    scheduled_sessions_count: int
    pending_approvals_count: int


class ThoughtOfTheDayResponse(BaseModel):
    thought: str
    author: str
    date: str
    source: str = "gemini"


class StudentDashboardSummaryResponse(BaseModel):
    student_id: Optional[str] = None
    student_name: str = "Student"
    program_name: Optional[str] = None
    batch_name: Optional[str] = None
    division_name: Optional[str] = None
    trimester: int = 1
    attendance_percentage: float = 100.0
    total_sessions_conducted: int = 0
    total_sessions_attended: int = 0
    attendance_standing: str = "Good Standing"
    enrolled_subjects_count: int = 0
    upcoming_sessions_count: int = 0
    case_studies_count: int = 0
    cgpa: Optional[float] = None
