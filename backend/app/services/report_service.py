import csv
import io
from typing import List, Dict, Any, Optional
from uuid import UUID
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


async def get_syllabus_completion_index(
    db: AsyncSession,
    faculty_id: Optional[UUID] = None,
    faculty_type: Optional[str] = "internal",
) -> List[Dict[str, Any]]:
    from app.models.academic import SubjectBatch
    stmt = select(Subject).where(Subject.is_deleted == False)
    if faculty_id:
        if faculty_type == "external":
            stmt = stmt.where(
                Subject.id.in_(
                    select(SubjectBatch.subject_id).where(
                        SubjectBatch.faculty_external_id == faculty_id,
                        SubjectBatch.status == "active"
                    )
                )
            )
        else:
            stmt = stmt.where(
                Subject.id.in_(
                    select(SubjectBatch.subject_id).where(
                        SubjectBatch.faculty_internal_id == faculty_id,
                        SubjectBatch.status == "active"
                    )
                )
            )
    res = await db.execute(stmt)
    subjects = res.scalars().all()

    sub_ids = [s.id for s in subjects]
    topic_counts = {}
    if sub_ids:
        counts_stmt = (
            select(
                Topic.subject_id,
                func.count(Topic.id).label("total"),
                func.count(func.nullif(Topic.is_completed, False)).label("completed"),
            )
            .where(Topic.subject_id.in_(sub_ids))
            .group_by(Topic.subject_id)
        )
        c_res = await db.execute(counts_stmt)
        for s_id, tot, comp in c_res.all():
            topic_counts[s_id] = (tot or 0, comp or 0)

    report = []
    for sub in subjects:
        total_topics, completed_topics = topic_counts.get(sub.id, (0, 0))
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
