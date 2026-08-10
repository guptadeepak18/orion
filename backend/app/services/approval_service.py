from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.approval import ApprovalWorkflow, ApprovalStage, ApprovalAction
from app.models.session import Engagement
from app.agents.approval_watchdog import approval_watchdog
from app.agents.invoice_sentinel import invoice_sentinel


async def create_approval_workflow(
    db: AsyncSession, name: str, applies_to: str
) -> ApprovalWorkflow:
    wf = ApprovalWorkflow(name=name, applies_to=applies_to, is_active=True)
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return wf


async def add_approval_stage(
    db: AsyncSession, workflow_id: UUID, sequence_no: int, name: str, approver_role_id: UUID, sla_hours: int = 24
) -> ApprovalStage:
    stage = ApprovalStage(
        workflow_id=workflow_id,
        sequence_no=sequence_no,
        name=name,
        approver_role_id=approver_role_id,
        sla_hours=sla_hours
    )
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    return stage


async def process_approval_action(
    db: AsyncSession,
    stage_id: UUID,
    entity_type: str,
    entity_id: UUID,
    actor_user_id: Optional[UUID],
    action: str,  # approved|rejected|escalated|commented
    comments: Optional[str] = None
) -> ApprovalAction:
    prev_status = "pending"
    new_status = "approved" if action == "approved" else ("rejected" if action == "rejected" else action)

    # Generate LLM context summary
    context_summary = await approval_watchdog.generate_action_summary(
        entity_type, {"entity_id": str(entity_id), "action": action, "comments": comments}
    )

    act = ApprovalAction(
        stage_id=stage_id,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_user_id=actor_user_id,
        action=action,
        comments=comments,
        context_summary=context_summary,
        previous_status=prev_status,
        new_status=new_status,
        acted_at=datetime.now(timezone.utc)
    )
    db.add(act)

    # If entity is Engagement and approved -> update engagement approval_status and trigger InvoiceSentinel auto-draft!
    if entity_type == "engagement":
        e_stmt = select(Engagement).where(Engagement.id == entity_id)
        e_res = await db.execute(e_stmt)
        eng = e_res.scalar_one_or_none()
        if eng:
            eng.approval_status = new_status
            await db.flush()
            if action == "approved":
                await invoice_sentinel.auto_draft_invoice_on_engagement_approval(db, entity_id)

    await db.commit()
    await db.refresh(act)
    return act


async def list_pending_approvals(db: AsyncSession) -> List[ApprovalAction]:
    stmt = select(ApprovalAction).where(ApprovalAction.new_status == "pending").order_by(ApprovalAction.acted_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())
