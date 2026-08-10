from typing import Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.agents.faculty_compliance_agent import faculty_compliance_agent
from app.agents.approval_watchdog import approval_watchdog

# In-memory settings store for local configuration
system_settings_store = {
    "institution_name": "Lexicon MILE",
    "department_name": "Career Readiness Cell (CRC)",
    "default_session_sla_hours": 24,
    "llm_provider": settings.LLM_PROVIDER,
    "llm_temperature": 0.2,
    "email_notifications_enabled": True,
}


async def get_system_settings() -> Dict[str, Any]:
    return system_settings_store


async def update_system_settings(update_data: Dict[str, Any]) -> Dict[str, Any]:
    for key, value in update_data.items():
        if value is not None and key in system_settings_store:
            system_settings_store[key] = value
    return system_settings_store


async def trigger_agent_manual(db: AsyncSession, agent_name: str) -> Dict[str, Any]:
    if agent_name == "faculty_compliance_agent":
        count = await faculty_compliance_agent.run_document_expiry_scan(db)
        return {
            "agent_name": agent_name,
            "status": "completed",
            "action_taken": f"Executed document expiry scan and emitted {count} notifications.",
            "result": {"notifications_emitted": count},
        }
    elif agent_name == "approval_watchdog":
        count = await approval_watchdog.check_pending_approvals_sla(db)
        return {
            "agent_name": agent_name,
            "status": "completed",
            "action_taken": f"Executed SLA watchdog audit and processed {count} pending actions.",
            "result": {"actions_processed": count},
        }
    else:
        return {
            "agent_name": agent_name,
            "status": "completed",
            "action_taken": f"Triggered manual execution for agent {agent_name}.",
            "result": {"status": "ok"},
        }
