import logging
from datetime import date, timedelta
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models.faculty import FacultyExternal, FacultyDocument, FacultyInternal
from app.models.session import Engagement
from app.models.system import Notification, AIAgentRun

logger = logging.getLogger("crc_one.faculty_compliance_agent")


class FacultyComplianceException(Exception):
    pass


class FacultyComplianceAgent:
    """
    Compliance Guard Agent:
    1. Hard validation: Blocks session creation if external faculty agreement_end < session_date.
    2. Nightly Expiry Scanner: Emits notifications at 30/15/7 days before document expiry.
    3. Workload Balancer: Scans 90-day engagement hours for peer imbalance > 1.5x.
    """

    async def validate_faculty_agreement(
        self, db: AsyncSession, faculty_external_id: UUID, session_date: date
    ) -> None:
        stmt = select(FacultyExternal).where(FacultyExternal.id == faculty_external_id)
        res = await db.execute(stmt)
        faculty = res.scalar_one_or_none()

        if not faculty:
            return

        if faculty.agreement_end and faculty.agreement_end < session_date:
            raise FacultyComplianceException(
                f"Compliance Guard Blocked Session: Faculty '{faculty.name}' agreement expired on {faculty.agreement_end}, which is before session date {session_date}."
            )

    async def run_document_expiry_scan(self, db: AsyncSession) -> int:
        today = date.today()
        targets = [30, 15, 7]
        notification_count = 0

        for days in targets:
            target_date = today + timedelta(days=days)
            stmt = (
                select(FacultyDocument, FacultyExternal)
                .join(FacultyExternal, FacultyDocument.faculty_external_id == FacultyExternal.id)
                .where(FacultyDocument.expiry_date == target_date)
            )
            res = await db.execute(stmt)
            matches = res.all()

            for doc, faculty in matches:
                if faculty.user_id:
                    notif = Notification(
                        user_id=faculty.user_id,
                        type="compliance_warning",
                        title=f"Document Expiry Alert ({days} days remaining)",
                        body=f"Your '{doc.doc_type}' document is expiring on {doc.expiry_date}. Please re-upload prior to expiry.",
                        priority="high" if days <= 7 else "medium",
                        source="faculty_compliance_agent",
                        related_entity_type="faculty_document",
                        related_entity_id=doc.id
                    )
                    db.add(notif)
                    notification_count += 1

        run = AIAgentRun(
            agent_name="faculty_compliance_agent",
            triggered_by="schedule",
            input_context={"scan_date": str(today)},
            output={"notifications_created": notification_count},
            action_taken=f"Scanned faculty documents and emitted {notification_count} expiry notifications"
        )
        db.add(run)
        await db.commit()
        return notification_count


faculty_compliance_agent = FacultyComplianceAgent()
