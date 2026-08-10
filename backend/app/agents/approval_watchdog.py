import logging
from datetime import datetime, timezone
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.approval import ApprovalAction, ApprovalStage
from app.models.auth import User
from app.models.system import Notification, AIAgentRun
from app.services.llm_client import llm_client

logger = logging.getLogger("crc_one.approval_watchdog")


class ApprovalWatchdog:
    """
    Approval Watchdog Agent:
    1. Generates LLM context summary on approval action creation.
    2. Hourly SLA monitoring: sends reminder at 50% SLA elapsed; escalates at 100% SLA elapsed.
    """

    async def generate_action_summary(self, entity_type: str, entity_data: dict) -> str:
        prompt = f"Summarize approval request for {entity_type}: {entity_data}"
        return await llm_client.generate_summary(prompt, context=entity_data)

    async def check_pending_approvals_sla(self, db: AsyncSession) -> int:
        now = datetime.now(timezone.utc)
        stmt = (
            select(ApprovalAction, ApprovalStage)
            .join(ApprovalStage, ApprovalAction.stage_id == ApprovalStage.id)
            .where(ApprovalAction.new_status == "pending")
        )
        res = await db.execute(stmt)
        pending_actions = res.all()

        actions_processed = 0

        for action, stage in pending_actions:
            elapsed_hours = (now - action.acted_at).total_seconds() / 3600.0
            sla_hours = stage.sla_hours or 24

            # 50% SLA reminder
            if 0.5 * sla_hours <= elapsed_hours < sla_hours:
                # Find approvers with stage.approver_role_id
                notif = Notification(
                    user_id=action.actor_user_id or action.entity_id,  # Target approver
                    type="approval_reminder",
                    title=f"Approval Reminder: {stage.name} (50% SLA elapsed)",
                    body=f"Approval item for {action.entity_type} ID {action.entity_id} has been pending for {elapsed_hours:.1f}h (SLA: {sla_hours}h).",
                    priority="high",
                    source="approval_watchdog",
                    related_entity_type=action.entity_type,
                    related_entity_id=action.entity_id,
                )
                db.add(notif)
                actions_processed += 1

            # 100% SLA escalation
            elif elapsed_hours >= sla_hours:
                action.new_status = "escalated"
                action.comments = f"[Approval Watchdog] Automatically escalated after exceeding SLA of {sla_hours}h."
                
                notif = Notification(
                    user_id=action.actor_user_id or action.entity_id,
                    type="approval_escalation",
                    title=f"URGENT: Approval Escalated ({stage.name})",
                    body=f"Approval item for {action.entity_type} ID {action.entity_id} exceeded {sla_hours}h SLA and has been escalated.",
                    priority="urgent",
                    source="approval_watchdog",
                    related_entity_type=action.entity_type,
                    related_entity_id=action.entity_id,
                )
                db.add(notif)
                actions_processed += 1

        run = AIAgentRun(
            agent_name="approval_watchdog",
            triggered_by="schedule",
            input_context={"now": str(now)},
            output={"actions_processed": actions_processed},
            action_taken=f"Evaluated SLA turnaround for pending approvals. Processed {actions_processed} actions."
        )
        db.add(run)
        await db.commit()
        return actions_processed


approval_watchdog = ApprovalWatchdog()
