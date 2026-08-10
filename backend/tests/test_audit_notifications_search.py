import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_search_notifications_and_audit(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Global Search
    search_res = await client.get("/search?q=Lexicon", headers=headers)
    assert search_res.status_code == 200
    assert "results" in search_res.json()["data"]

    # 2. Get Notifications
    notif_res = await client.get("/notifications", headers=headers)
    assert notif_res.status_code == 200

    # 3. Get Audit Trail
    audit_res = await client.get("/audit", headers=headers)
    assert audit_res.status_code == 200
