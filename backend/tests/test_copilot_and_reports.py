import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_copilot_and_reports_flow(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Test Operational Copilot NLQ Endpoint
    copilot_res = await client.post(
        "/copilot/query",
        json={"prompt": "Show me active external faculty members"},
        headers=headers,
    )
    assert copilot_res.status_code == 200
    copilot_data = copilot_res.json()["data"]
    assert copilot_data["tool_call"] == "list_external_faculty"
    assert "summary" in copilot_data

    # 2. Test Analytical Reporting Endpoints
    rem_res = await client.get("/reports/remuneration-statement", headers=headers)
    assert rem_res.status_code == 200
    assert isinstance(rem_res.json()["data"], list)

    venue_res = await client.get("/reports/venue-utilization", headers=headers)
    assert venue_res.status_code == 200
    assert isinstance(venue_res.json()["data"], list)

    syl_res = await client.get("/reports/syllabus-completion", headers=headers)
    assert syl_res.status_code == 200
    assert isinstance(syl_res.json()["data"], list)

    audit_res = await client.get("/reports/audit-trail", headers=headers)
    assert audit_res.status_code == 200
    assert isinstance(audit_res.json()["data"], list)

    # 3. Test CSV Export Endpoint
    export_res = await client.get("/reports/export?report_type=remuneration", headers=headers)
    assert export_res.status_code == 200
    assert "text/csv" in export_res.headers["content-type"]
