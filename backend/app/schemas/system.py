from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict


class SystemSettingsUpdate(BaseModel):
    institution_name: Optional[str] = None
    department_name: Optional[str] = None
    default_session_sla_hours: Optional[int] = None
    llm_provider: Optional[str] = None  # anthropic|openai|local_fallback
    llm_temperature: Optional[float] = None
    email_notifications_enabled: Optional[bool] = None


class SystemSettingsResponse(BaseModel):
    institution_name: str
    department_name: str
    default_session_sla_hours: int
    llm_provider: str
    llm_temperature: float
    email_notifications_enabled: bool

    model_config = ConfigDict(from_attributes=True)


class AgentTriggerResponse(BaseModel):
    agent_name: str
    status: str
    action_taken: str
    result: Dict[str, Any]
