from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_role
from app.schemas.common import ResponseEnvelope
from app.schemas.system import SystemSettingsUpdate, SystemSettingsResponse, AgentTriggerResponse
from app.services import system_service

router = APIRouter(prefix="/system", tags=["System & Admin Settings"])


@router.get(
    "/settings",
    response_model=ResponseEnvelope[SystemSettingsResponse],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def get_settings():
    s = await system_service.get_system_settings()
    return ResponseEnvelope(data=SystemSettingsResponse.model_validate(s))


@router.put(
    "/settings",
    response_model=ResponseEnvelope[SystemSettingsResponse],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def update_settings(
    settings_in: SystemSettingsUpdate,
):
    updated = await system_service.update_system_settings(settings_in.model_dump(exclude_unset=True))
    return ResponseEnvelope(data=SystemSettingsResponse.model_validate(updated))


@router.post(
    "/agents/{agent_name}/trigger",
    response_model=ResponseEnvelope[AgentTriggerResponse],
    dependencies=[Depends(require_role(["crc_admin"]))],
)
async def trigger_agent(
    agent_name: str, db: AsyncSession = Depends(get_db)
):
    result = await system_service.trigger_agent_manual(db, agent_name)
    return ResponseEnvelope(data=AgentTriggerResponse.model_validate(result))
