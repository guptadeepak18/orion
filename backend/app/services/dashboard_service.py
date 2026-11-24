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

    # Consolidated single roundtrip query using scalar subqueries to eliminate the 7-query waterfall across WAN
    stmt_prog = select(func.count()).select_from(Program).where(Program.is_active == True).scalar_subquery()
    stmt_fac_ext = (
        select(func.count())
        .select_from(FacultyExternal)
        .where(
            FacultyExternal.is_deleted == False,
            FacultyExternal.is_archived == False,
            FacultyExternal.is_active == True,
        )
        .scalar_subquery()
    )
    stmt_fac_int = (
        select(func.count())
        .select_from(FacultyInternal)
        .where(
            FacultyInternal.is_deleted == False,
            FacultyInternal.is_archived == False,
            FacultyInternal.is_active == True,
        )
        .scalar_subquery()
    )
    stmt_sess = select(func.count()).select_from(Session).where(Session.is_deleted == False).scalar_subquery()
    stmt_app = select(func.count()).select_from(ApprovalAction).where(ApprovalAction.new_status == "pending").scalar_subquery()
    stmt_today = select(func.count()).select_from(Session).where(
        Session.session_date == today,
        Session.is_deleted == False,
        Session.status != "cancelled"
    ).scalar_subquery()
    stmt_reg = select(func.count()).select_from(StudentRegistration).where(
        StudentRegistration.status == "pending_review"
    ).scalar_subquery()
    stmt_ev = select(func.count()).select_from(AcademicEvent).where(
        AcademicEvent.is_deleted == False,
        func.coalesce(AcademicEvent.end_date, AcademicEvent.start_date) >= today,
        AcademicEvent.status != "cancelled"
    ).scalar_subquery()

    consolidated_stmt = select(
        stmt_prog.label("programs"),
        stmt_fac_ext.label("fac_ext"),
        stmt_fac_int.label("fac_int"),
        stmt_sess.label("sessions"),
        stmt_app.label("approvals"),
        stmt_today.label("today_sessions"),
        stmt_reg.label("registrations"),
        stmt_ev.label("events"),
    )
    res = await db.execute(consolidated_stmt)
    row = res.one()

    return DashboardSummaryResponse(
        active_programs_count=row.programs or 0,
        faculty_count=(row.fac_ext or 0) + (row.fac_int or 0),
        scheduled_sessions_count=row.sessions or 0,
        pending_approvals_count=row.approvals or 0,
        today_sessions_count=row.today_sessions or 0,
        pending_registrations_count=row.registrations or 0,
        upcoming_events_count=row.events or 0,
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
    # Count enrolled subjects, upcoming sessions, today's sessions, and case studies in a single roundtrip
    from app.models.academic import SubjectBatch
    from app.models.session import Session
    from app.models.case_study import CaseStudy
    from datetime import date
    today_date = date.today()

    sub_sq = select(func.count(SubjectBatch.id)).where(SubjectBatch.batch_id == student.batch_id).scalar_subquery() if student.batch_id else select(func.coalesce(6, 6)).scalar_subquery()
    sess_sq = select(func.count(Session.id)).where(
        Session.batch_id == student.batch_id,
        Session.is_deleted == False,
        Session.status.in_(["scheduled", "in_progress", "pending_review"])
    ).scalar_subquery() if student.batch_id else select(func.coalesce(0, 0)).scalar_subquery()
    today_sq = select(func.count(Session.id)).where(
        Session.batch_id == student.batch_id,
        Session.session_date == today_date,
        Session.is_deleted == False,
        Session.status != "cancelled"
    ).scalar_subquery() if student.batch_id else select(func.coalesce(0, 0)).scalar_subquery()
    case_sq = select(func.count(CaseStudy.id)).where(CaseStudy.is_deleted == False).scalar_subquery()

    consolidated_student_stmt = select(
        sub_sq.label("sub_cnt"),
        sess_sq.label("sess_cnt"),
        today_sq.label("today_cnt"),
        case_sq.label("case_cnt")
    )
    s_row = (await db.execute(consolidated_student_stmt)).one()
    if student.batch_id and (s_row.sub_cnt or 0) > 0:
        enrolled_count = s_row.sub_cnt
    upcoming_count = s_row.sess_cnt or 0
    today_sessions_count = s_row.today_cnt or 0
    case_cnt = s_row.case_cnt or 0

    if enriched.total_sessions_conducted == 0:
        standing = "Classes Pending"
    elif enriched.attendance_percentage >= 75.0:
        standing = "Good Standing"
    else:
        standing = "Attendance Advisory (< 75%)"
    div_name = enriched.division_names[0] if (enriched.division_names and len(enriched.division_names) > 0) else None

    recent_att_items = []
    if student and student.id:
        from app.models.session import StudentAttendance, Session, HyperbuildActivity
        from app.schemas.dashboard import StudentRecentAttendanceItem
        from sqlalchemy.orm import selectinload

        recent_att_stmt = (
            select(StudentAttendance)
            .join(Session, StudentAttendance.session_id == Session.id)
            .options(
                selectinload(StudentAttendance.session).selectinload(Session.subject),
                selectinload(StudentAttendance.session).selectinload(Session.faculty_internal),
                selectinload(StudentAttendance.session).selectinload(Session.faculty_external),
                selectinload(StudentAttendance.session).selectinload(Session.hyperbuild_activities).selectinload(HyperbuildActivity.subject),
            )
            .where(
                StudentAttendance.student_id == student.id,
                Session.is_deleted == False,
                Session.attendance_status == "marked",
                StudentAttendance.status.isnot(None),
            )
            .order_by(Session.session_date.desc(), Session.start_time.desc())
            .limit(10)
        )
        recent_res = await db.execute(recent_att_stmt)
        for att in recent_res.scalars().all():
            sess = att.session
            if not sess:
                continue

            sub_name = sess.subject.name if sess.subject else ("HyperBuild Session" if sess.session_type == "hyperbuild" else "Class Session")
            sub_code = sess.subject.code if sess.subject else ("HB" if sess.session_type == "hyperbuild" else "SUB")

            if sess.session_type == "hyperbuild" and sess.hyperbuild_activities and len(sess.hyperbuild_activities) > 0:
                first_act = sess.hyperbuild_activities[0]
                if first_act.subject:
                    sub_name = first_act.subject.name
                    sub_code = first_act.subject.code or first_act.subject.course_code or "HB"
                elif first_act.title:
                    sub_name = first_act.title

            fac_name = "Assigned Faculty"
            if sess.faculty_internal:
                fac_name = sess.faculty_internal.full_name or "Internal Faculty"
            elif sess.faculty_external:
                fac_name = sess.faculty_external.name or "External Faculty"

            s_time = sess.start_time.strftime("%H:%M") if hasattr(sess.start_time, "strftime") else (str(sess.start_time)[:5] if sess.start_time else None)
            e_time = sess.end_time.strftime("%H:%M") if hasattr(sess.end_time, "strftime") else (str(sess.end_time)[:5] if sess.end_time else None)

            eff_status = att.status
            eff_remarks = att.remarks

            if sess.session_type == "hyperbuild" and sess.hyperbuild_activities and len(sess.hyperbuild_activities) > 0:
                PRESENT_STATUSES = ["present", "late", "excused", "leave_approved", "od_duty", "on_duty", "on duty"]
                roll_is_present = (att.status in PRESENT_STATUSES) or (getattr(att, "roll_call_status", None) in PRESENT_STATUSES)
                acts_req_key = [
                    a for a in sess.hyperbuild_activities
                    if (a.challenge_key is not None or a.status in ["active", "closed"])
                ]
                if acts_req_key:
                    from app.models.session import HyperbuildActivityVerification
                    act_ids = [a.id for a in acts_req_key]
                    v_stmt = select(HyperbuildActivityVerification).where(
                        HyperbuildActivityVerification.session_id == sess.id,
                        HyperbuildActivityVerification.student_id == student.id,
                        HyperbuildActivityVerification.activity_id.in_(act_ids),
                        HyperbuildActivityVerification.verification_status.in_(["verified_present", "late_submission", "present"]),
                        HyperbuildActivityVerification.is_key_valid == True,
                    )
                    v_res = await db.execute(v_stmt)
                    valid_verifs = v_res.scalars().all()

                    if not roll_is_present:
                        eff_status = "absent"
                        eff_remarks = "Absent (Marked absent during classroom roll call)"
                    elif len(valid_verifs) == 0:
                        eff_status = "absent"
                        eff_remarks = "Absent (Secret key not entered)"
                    else:
                        eff_status = "present"
                        eff_remarks = f"Verified ({len(valid_verifs)}/{len(acts_req_key)} activities completed)"

            recent_att_items.append(
                StudentRecentAttendanceItem(
                    attendance_id=str(att.id),
                    session_id=str(sess.id),
                    session_date=str(sess.session_date),
                    start_time=s_time,
                    end_time=e_time,
                    subject_code=sub_code,
                    subject_name=sub_name,
                    faculty_name=fac_name,
                    venue=sess.venue or "Campus Classroom",
                    session_type=sess.session_type or "lecture",
                    status=eff_status,
                    remarks=eff_remarks,
                )
            )

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
        recent_attendance=recent_att_items,
    )


async def get_faculty_dashboard_summary(db: AsyncSession, user_id: Optional[UUID] = None) -> FacultyDashboardSummaryResponse:
    from datetime import date
    from app.services.attendance_service import get_faculty_profile_id_by_user_id
    from app.models.academic import SubjectBatch
    today = date.today()
    faculty_internal = None
    faculty_external = None
    fac_id = None
    fac_type = "internal"

    if user_id:
        fac_id, resolved_type = await get_faculty_profile_id_by_user_id(db, user_id)
        if fac_id:
            fac_type = resolved_type or "internal"
            if fac_type == "internal":
                faculty_internal = (await db.execute(select(FacultyInternal).where(FacultyInternal.id == fac_id))).scalar_one_or_none()
            else:
                faculty_external = (await db.execute(select(FacultyExternal).where(FacultyExternal.id == fac_id))).scalar_one_or_none()

    fac_name = (faculty_internal.full_name or "Faculty") if faculty_internal else (faculty_external.name if faculty_external else "Faculty")

    today_count = 0
    upcoming_count = 0
    hyper_count = 0
    subjects_cnt = 0

    if fac_id:
        if fac_type == "internal":
            filter_clause = (Session.faculty_internal_id == fac_id)
        else:
            filter_clause = (Session.faculty_external_id == fac_id)

        # Consolidate faculty session, subject, and event counts into 1 roundtrip
        sq_today = select(func.count(Session.id)).where(
            filter_clause,
            Session.session_date == today,
            Session.is_deleted == False,
            Session.status != "cancelled"
        ).scalar_subquery()

        sq_up = select(func.count(Session.id)).where(
            filter_clause,
            Session.session_date >= today,
            Session.is_deleted == False,
            Session.status != "cancelled"
        ).scalar_subquery()

        sq_hyp = select(func.count(Session.id)).where(
            filter_clause,
            Session.session_type == "hyperbuild",
            Session.is_deleted == False
        ).scalar_subquery()

        if fac_type == "internal":
            sq_sub = select(func.count(func.distinct(SubjectBatch.subject_id))).where(
                SubjectBatch.faculty_internal_id == fac_id,
                SubjectBatch.status == "active"
            ).scalar_subquery()
        else:
            sq_sub = select(func.count(func.distinct(SubjectBatch.subject_id))).where(
                SubjectBatch.faculty_external_id == fac_id,
                SubjectBatch.status == "active"
            ).scalar_subquery()

        sq_ev = select(func.count()).select_from(AcademicEvent).where(
            AcademicEvent.is_deleted == False,
            func.coalesce(AcademicEvent.end_date, AcademicEvent.start_date) >= today,
            AcademicEvent.status != "cancelled",
        ).scalar_subquery()

        fac_consolidated = select(
            sq_today.label("today_cnt"),
            sq_up.label("up_cnt"),
            sq_hyp.label("hyp_cnt"),
            sq_sub.label("sub_cnt"),
            sq_ev.label("ev_cnt"),
        )
        frow = (await db.execute(fac_consolidated)).one()
        today_count = frow.today_cnt or 0
        upcoming_count = frow.up_cnt or 0
        hyper_count = frow.hyp_cnt or 0
        subjects_cnt = frow.sub_cnt or 0
        events_count = frow.ev_cnt or 0
    else:
        stmt_ev = select(func.count()).select_from(AcademicEvent).where(
            AcademicEvent.is_deleted == False,
            func.coalesce(AcademicEvent.end_date, AcademicEvent.start_date) >= today,
            AcademicEvent.status != "cancelled",
        )
        events_count = (await db.execute(stmt_ev)).scalar() or 0

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
