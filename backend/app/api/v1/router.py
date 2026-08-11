from fastapi import APIRouter
from app.api.v1 import (
    auth, users, health, academic, sessions, timetable,
    faculty, engagements, remuneration, approvals, invoices, payments,
    calendar, feedback, copilot, reports, system, search, notifications, audit, dashboard,
    students, student_registrations
)

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(dashboard.router)
api_router.include_router(academic.router)
api_router.include_router(students.router)
api_router.include_router(student_registrations.router)
api_router.include_router(sessions.router)

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
