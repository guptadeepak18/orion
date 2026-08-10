from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    active_programs_count: int
    faculty_count: int
    scheduled_sessions_count: int
    pending_approvals_count: int
