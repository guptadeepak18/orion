from fastapi import APIRouter
from app.api.v1 import (
    auth, users, health, academic, sessions, timetable,
    faculty, engagements, remuneration, approvals, invoices, payments,
    calendar, feedback, copilot, reports, system, search, notifications, audit, dashboard,
    students, student_registrations, activities, lms, case_studies, attendance, ai_intelligence, academic_operations,
    email_templates
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(email_templates.router)
api_router.include_router(users.router)
api_router.include_router(dashboard.router)
api_router.include_router(academic.router)
api_router.include_router(academic_operations.router)
api_router.include_router(case_studies.router)
api_router.include_router(activities.router)
api_router.include_router(lms.router)
api_router.include_router(students.router)
api_router.include_router(student_registrations.router)
api_router.include_router(sessions.router)
api_router.include_router(attendance.router)
api_router.include_router(ai_intelligence.router)

api_router.include_router(timetable.router)
api_router.include_router(faculty.router)
api_router.include_router(engagements.router)
api_router.include_router(remuneration.router)
api_router.include_router(approvals.router)
api_router.include_router(invoices.router)
api_router.include_router(payments.router)
api_router.include_router(calendar.router)
api_router.include_router(feedback.router)
api_router.include_router(copilot.router)
api_router.include_router(reports.router)
api_router.include_router(system.router)
api_router.include_router(search.router)
api_router.include_router(notifications.router)
api_router.include_router(audit.router)
