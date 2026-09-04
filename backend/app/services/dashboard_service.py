from typing import Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.academic import Program
from app.models.faculty import FacultyExternal, FacultyInternal
from app.models.session import Session
from app.models.approval import ApprovalAction
from datetime import date
from app.models.academic_event import AcademicEvent
from app.models.student_registration import StudentRegistration
from app.schemas.dashboard import (
    DashboardSummaryResponse,
    StudentDashboardSummaryResponse,
    FacultyDashboardSummaryResponse,
)


async def get_dashboard_summary(db: AsyncSession) -> DashboardSummaryResponse:
    today = date.today()

    # 1. Programs count
    stmt_prog = select(func.count()).select_from(Program).where(Program.is_active == True)
    res_prog = await db.execute(stmt_prog)
    programs_count = res_prog.scalar_one() or 0

    # 2. Faculty count (Active non-deleted internal + external faculty)
    stmt_fac_ext = (
        select(func.count())
        .select_from(FacultyExternal)
        .where(
            FacultyExternal.is_deleted == False,
            FacultyExternal.is_archived == False,
            FacultyExternal.is_active == True,
        )
    )
    res_fac_ext = await db.execute(stmt_fac_ext)
    fac_ext_count = res_fac_ext.scalar_one() or 0

    stmt_fac_int = (
        select(func.count())
        .select_from(FacultyInternal)
        .where(
            FacultyInternal.is_deleted == False,
            FacultyInternal.is_archived == False,
            FacultyInternal.is_active == True,
        )
    )
    res_fac_int = await db.execute(stmt_fac_int)
    fac_int_count = res_fac_int.scalar_one() or 0

    # 3. Scheduled sessions count
    stmt_sess = select(func.count()).select_from(Session).where(Session.is_deleted == False)
    res_sess = await db.execute(stmt_sess)
    sessions_count = res_sess.scalar_one() or 0

    # 4. Pending approvals count
    stmt_app = select(func.count()).select_from(ApprovalAction).where(ApprovalAction.new_status == "pending")
    res_app = await db.execute(stmt_app)
    approvals_count = res_app.scalar_one() or 0

    # 5. Sessions scheduled today
    stmt_today = select(func.count()).select_from(Session).where(
        Session.session_date == today,
        Session.is_deleted == False,
        Session.status != "cancelled"
    )
    today_sessions_count = (await db.execute(stmt_today)).scalar_one() or 0

    # 6. Pending student registrations
    stmt_reg = select(func.count()).select_from(StudentRegistration).where(
        StudentRegistration.status == "pending_review"
    )
    pending_registrations_count = (await db.execute(stmt_reg)).scalar_one() or 0

    # 7. Upcoming academic events
    stmt_ev = select(func.count()).select_from(AcademicEvent).where(
        AcademicEvent.is_deleted == False,
        func.coalesce(AcademicEvent.end_date, AcademicEvent.start_date) >= today,
        AcademicEvent.status != "cancelled"
    )
    upcoming_events_count = (await db.execute(stmt_ev)).scalar_one() or 0

    return DashboardSummaryResponse(
        active_programs_count=programs_count,
        faculty_count=fac_ext_count + fac_int_count,
        scheduled_sessions_count=sessions_count,
        pending_approvals_count=approvals_count,
        today_sessions_count=today_sessions_count,
        pending_registrations_count=pending_registrations_count,
        upcoming_events_count=upcoming_events_count,
    )


async def get_student_dashboard_summary(db: AsyncSession, user_id: Optional[UUID] = None) -> StudentDashboardSummaryResponse:
    student = None
    if user_id:
        from app.services.student_service import get_student_by_user_id
        student = await get_student_by_user_id(db, user_id)

    if not student:
        # Fallback to first available active student for demo/preview
        from app.models.student import Student
        from sqlalchemy.orm import selectinload
        res = await db.execute(
            select(Student)
            .options(
                selectinload(Student.program),
                selectinload(Student.batch),
                selectinload(Student.divisions),
            )
            .where(Student.is_deleted == False)
            .limit(1)
        )
        student = res.scalar_one_or_none()

    if not student:
        return StudentDashboardSummaryResponse()

    from app.services.student_service import to_student_response_enriched
    enriched = await to_student_response_enriched(db, student)

    # Count enrolled subjects for this batch
    enrolled_count = 6
    if student.batch_id:
        from app.models.academic import SubjectBatch
        sub_cnt = (
            await db.execute(
                select(func.count(SubjectBatch.id)).where(SubjectBatch.batch_id == student.batch_id)
            )
        ).scalar() or 0
        if sub_cnt > 0:
            enrolled_count = sub_cnt

    # Count upcoming sessions
    upcoming_count = 0
    if student.batch_id:
        from app.models.session import Session
        sess_cnt = (
            await db.execute(
                select(func.count(Session.id)).where(
                    Session.batch_id == student.batch_id,
                    Session.is_deleted == False,
                    Session.status.in_(["scheduled", "in_progress", "pending_review"])
                )
            )
        ).scalar() or 0
        upcoming_count = sess_cnt

    # Count today's sessions for student
    today_sessions_count = 0
    if student.batch_id:
        from datetime import date
        today_date = date.today()
        from app.models.session import Session
        sess_today_cnt = (
            await db.execute(
                select(func.count(Session.id)).where(
                    Session.batch_id == student.batch_id,
                    Session.session_date == today_date,
                    Session.is_deleted == False,
                    Session.status != "cancelled"
                )
            )
        ).scalar() or 0
        today_sessions_count = sess_today_cnt

    # Count active case studies
    from app.models.case_study import CaseStudy
    case_cnt = (
        await db.execute(
            select(func.count(CaseStudy.id)).where(CaseStudy.is_deleted == False)
        )
    ).scalar() or 0

    standing = "Good Standing" if enriched.attendance_percentage >= 75.0 else "Attendance Advisory (< 75%)"
    div_name = enriched.division_names[0] if (enriched.division_names and len(enriched.division_names) > 0) else None

    return StudentDashboardSummaryResponse(
        student_id=str(student.id),
        student_name=student.full_name or "Student",
        program_name=enriched.program_name or "PGDM",
        batch_name=enriched.batch_name or "Batch 2025-27",
        division_name=div_name,
        trimester=student.trimester or 1,
        attendance_percentage=enriched.attendance_percentage,
        total_sessions_conducted=enriched.total_sessions_conducted,
        total_sessions_attended=enriched.total_sessions_attended,
        attendance_standing=standing,
        enrolled_subjects_count=enrolled_count,
        upcoming_sessions_count=upcoming_count,
        today_sessions_count=today_sessions_count,
        case_studies_count=case_cnt,
        cgpa=student.cgpa,
    )


async def get_faculty_dashboard_summary(db: AsyncSession, user_id: Optional[UUID] = None) -> FacultyDashboardSummaryResponse:
    from datetime import date
    today = date.today()
    faculty_internal = None
    faculty_external = None

    if user_id:
        res_int = await db.execute(
            select(FacultyInternal).where(FacultyInternal.user_id == user_id, FacultyInternal.is_deleted == False)
        )
        faculty_internal = res_int.scalar_one_or_none()
        if not faculty_internal:
            res_ext = await db.execute(
                select(FacultyExternal).where(FacultyExternal.user_id == user_id, FacultyExternal.is_deleted == False)
            )
            faculty_external = res_ext.scalar_one_or_none()

    # Fallback to first active faculty if admin testing / previewing
    if not faculty_internal and not faculty_external:
        res_int = await db.execute(
            select(FacultyInternal).where(FacultyInternal.is_deleted == False, FacultyInternal.is_active == True).limit(1)
        )
        faculty_internal = res_int.scalar_one_or_none()

    fac_id = faculty_internal.id if faculty_internal else (faculty_external.id if faculty_external else None)
    fac_name = (faculty_internal.full_name or "Faculty") if faculty_internal else (faculty_external.name if faculty_external else "Faculty")
    fac_type = "internal" if faculty_internal else "external"

    today_count = 0
    upcoming_count = 0
    hyper_count = 0

    if fac_id:
        if fac_type == "internal":
            filter_clause = (Session.faculty_internal_id == fac_id)
        else:
            filter_clause = (Session.faculty_external_id == fac_id)

        # Today's sessions
        stmt_today = select(func.count(Session.id)).where(
            filter_clause,
            Session.session_date == today,
            Session.is_deleted == False,
            Session.status != "cancelled"
        )
        today_count = (await db.execute(stmt_today)).scalar() or 0

        # Upcoming sessions
        stmt_up = select(func.count(Session.id)).where(
            filter_clause,
            Session.session_date >= today,
            Session.is_deleted == False,
            Session.status != "cancelled"
        )
        upcoming_count = (await db.execute(stmt_up)).scalar() or 0

        # Hyperbuild sessions
        stmt_hyp = select(func.count(Session.id)).where(
            filter_clause,
            Session.session_type == "hyperbuild",
            Session.is_deleted == False
        )
        hyper_count = (await db.execute(stmt_hyp)).scalar() or 0

    # Upcoming events
    stmt_ev = select(func.count()).select_from(AcademicEvent).where(
        AcademicEvent.is_deleted == False,
        func.coalesce(AcademicEvent.end_date, AcademicEvent.start_date) >= today,
        AcademicEvent.status != "cancelled",
    )
    events_count = (await db.execute(stmt_ev)).scalar() or 0

    subjects_cnt = len(getattr(faculty_internal, 'subjects_handled', []) or []) if faculty_internal else 0

    return FacultyDashboardSummaryResponse(
        faculty_id=str(fac_id) if fac_id else None,
        faculty_name=fac_name,
        faculty_type=fac_type,
        today_sessions_count=today_count,
        upcoming_sessions_count=upcoming_count,
        active_hyperbuild_count=hyper_count,
        assigned_subjects_count=subjects_cnt,
        upcoming_events_count=events_count,
    )
