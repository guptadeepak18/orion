from typing import List, Optional
from fastapi import APIRouter, Depends, Body, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission, get_current_token_payload
from app.schemas.common import ResponseEnvelope
from app.agents.copilot_agent import copilot_agent

router = APIRouter(prefix="/copilot", tags=["Copilot"])


@router.post(
    "/query",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("copilot", "query"))],
)
async def query_copilot(
    prompt: str = Body(..., embed=True),
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_roles = payload.get("roles", [])
    result = await copilot_agent.execute_query(db, prompt, user_roles)
    return ResponseEnvelope(data=result)
