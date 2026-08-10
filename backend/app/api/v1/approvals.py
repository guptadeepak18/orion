from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission, get_current_token_payload
from app.schemas.common import ResponseEnvelope
from app.services import approval_service

router = APIRouter(prefix="/approvals", tags=["Approvals"])


@router.post(
    "/action",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("approvals", "approve"))],
)
async def action_approval(
    stage_id: UUID = Body(...),
    entity_type: str = Body(...),
    entity_id: UUID = Body(...),
    action: str = Body(...),  # approved|rejected|escalated|commented
    comments: Optional[str] = Body(None),
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id_str = payload.get("sub")
    actor_id = UUID(user_id_str) if user_id_str else None

    act = await approval_service.process_approval_action(
        db, stage_id, entity_type, entity_id, actor_id, action, comments
    )

    return ResponseEnvelope(
        data={
            "id": str(act.id),
            "action": act.action,
            "new_status": act.new_status,
            "context_summary": act.context_summary,
            "acted_at": act.acted_at.isoformat(),
        }
    )


@router.get(
    "/pending",
    response_model=ResponseEnvelope[List[dict]],
    dependencies=[Depends(require_permission("approvals", "view"))],
)
async def list_pending_approvals(db: AsyncSession = Depends(get_db)):
    actions = await approval_service.list_pending_approvals(db)
    return ResponseEnvelope(
        data=[
            {
                "id": str(a.id),
                "entity_type": a.entity_type,
                "entity_id": str(a.entity_id),
                "new_status": a.new_status,
                "context_summary": a.context_summary,
                "acted_at": a.acted_at.isoformat(),
            }
            for a in actions
        ]
    )
