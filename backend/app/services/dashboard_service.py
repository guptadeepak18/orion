from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.academic import Program
from app.models.faculty import FacultyExternal, FacultyInternal
from app.models.session import Session
from app.models.approval import ApprovalAction
from app.schemas.dashboard import DashboardSummaryResponse


async def get_dashboard_summary(db: AsyncSession) -> DashboardSummaryResponse:
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

    return DashboardSummaryResponse(
        active_programs_count=programs_count,
        faculty_count=fac_ext_count + fac_int_count,
        scheduled_sessions_count=sessions_count,
        pending_approvals_count=approvals_count,
    )
