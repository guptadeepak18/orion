import csv
import io
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.session import Session, Engagement
from app.models.finance import RemunerationCalculation, Invoice, Payment
from app.models.academic import Program, Batch, Subject, Topic
from app.models.faculty import FacultyExternal, FacultyInternal
from app.models.system import AIAgentRun


async def get_remuneration_statement(db: AsyncSession) -> List[Dict[str, Any]]:
    stmt = (
        select(Engagement, FacultyExternal, RemunerationCalculation)
        .join(FacultyExternal, Engagement.faculty_external_id == FacultyExternal.id)
        .outerjoin(RemunerationCalculation, Engagement.remuneration_calculation_id == RemunerationCalculation.id)
    )
    res = await db.execute(stmt)
    rows = res.all()

    report = []
    for eng, fac, calc in rows:
        report.append({
            "faculty_name": fac.name,
            "organization": fac.organization or "Independent",
            "topic_delivered": eng.topic_delivered,
            "hours": float(eng.hours),
            "rate": f"₹{fac.standard_rate}/{fac.standard_rate_type}",
            "gross_amount": float(calc.gross_amount) if calc else float(eng.hours * fac.standard_rate),
            "gst_amount": float(calc.tax_amount) if calc else 0.0,
            "net_payable": float(calc.net_payable) if calc else float(eng.hours * fac.standard_rate),
            "approval_status": eng.approval_status,
            "payment_status": eng.payment_status,
        })
    return report


async def get_venue_utilization_matrix(db: AsyncSession) -> List[Dict[str, Any]]:
    stmt = select(
        Session.venue,
        func.count(Session.id).label("total_sessions"),
        func.sum(Session.duration_minutes).label("total_minutes")
    ).group_by(Session.venue)

    res = await db.execute(stmt)
    rows = res.all()

    report = []
    for venue, total_sessions, total_minutes in rows:
        total_hours = (total_minutes or 0) / 60.0
        util_pct = min(100.0, (total_hours / 40.0) * 100.0)  # assumed 40h capacity
        report.append({
            "venue": venue,
            "total_sessions": total_sessions,
            "total_hours": total_hours,
            "utilization_percentage": round(util_pct, 1),
        })
    return report


async def get_syllabus_completion_index(db: AsyncSession) -> List[Dict[str, Any]]:
    stmt = select(Subject).where(Subject.is_deleted == False)
    res = await db.execute(stmt)
    subjects = res.scalars().all()

    report = []
    for sub in subjects:
        top_stmt = select(func.count(Topic.id)).where(Topic.subject_id == sub.id)
        t_res = await db.execute(top_stmt)
        total_topics = t_res.scalar() or 0

        comp_stmt = select(func.count(Topic.id)).where(Topic.subject_id == sub.id, Topic.is_completed == True)
        c_res = await db.execute(comp_stmt)
        completed_topics = c_res.scalar() or 0

        pct = (completed_topics / total_topics * 100.0) if total_topics > 0 else 0.0
        report.append({
            "subject_code": sub.code,
            "subject_name": sub.name,
            "total_topics": total_topics,
            "completed_topics": completed_topics,
            "completion_index": round(pct, 1),
        })
    return report


async def get_audit_trail(db: AsyncSession) -> List[Dict[str, Any]]:
    stmt = select(AIAgentRun).order_by(AIAgentRun.created_at.desc()).limit(50)
    res = await db.execute(stmt)
    runs = res.scalars().all()

    return [
        {
            "id": str(r.id),
            "agent_name": r.agent_name,
            "triggered_by": r.triggered_by,
            "action_taken": r.action_taken,
            "timestamp": r.created_at.isoformat(),
        }
        for r in runs
    ]


async def export_report_to_csv(data: List[Dict[str, Any]]) -> str:
    if not data:
        return "No data available"

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows(data)
    return output.getvalue()
