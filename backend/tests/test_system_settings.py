import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_system_settings_and_agent_trigger_flow(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Get System Settings
    res = await client.get("/system/settings", headers=headers)
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["institution_name"] == "Lexicon MILE"

    # 2. Update System Settings
    up_res = await client.put(
        "/system/settings",
        json={"institution_name": "Lexicon Institute of Management", "default_session_sla_hours": 48},
        headers=headers,
    )
    assert up_res.status_code == 200
    assert up_res.json()["data"]["institution_name"] == "Lexicon Institute of Management"
    assert up_res.json()["data"]["default_session_sla_hours"] == 48

    # 3. Trigger Agent Execution Manually
    trig_res = await client.post("/system/agents/faculty_compliance_agent/trigger", headers=headers)
    assert trig_res.status_code == 200
    assert trig_res.json()["data"]["agent_name"] == "faculty_compliance_agent"
