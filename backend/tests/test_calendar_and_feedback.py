from datetime import date
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_calendar_and_feedback_flow(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Setup Academic & Session
    p_res = await client.post("/academic/programs", json={"name": "MBA HR", "code": "MBA-HR", "description": "HR"}, headers=headers)
    p_id = p_res.json()["data"]["id"]
    ay_res = await client.post("/academic/academic-years", json={"label": "2026-27", "start_date": "2026-07-01", "end_date": "2027-06-30"}, headers=headers)
    ay_id = ay_res.json()["data"]["id"]
    sem_res = await client.post("/academic/semesters", json={"program_id": p_id, "academic_year_id": ay_id, "number": 1, "label": "Sem 1", "start_date": "2026-07-01", "end_date": "2026-11-30"}, headers=headers)
    sem_id = sem_res.json()["data"]["id"]
    b_res = await client.post("/academic/batches", json={"program_id": p_id, "academic_year_id": ay_id, "semester_id": sem_id, "name": "HR-A", "code": "HR-A"}, headers=headers)
    b_id = b_res.json()["data"]["id"]
    sub_res = await client.post("/academic/subjects", json={"batch_id": b_id, "name": "Org Behavior", "code": "OB101"}, headers=headers)
    sub_id = sub_res.json()["data"]["id"]

    sess_payload = {
        "program_id": p_id,
        "batch_id": b_id,
        "semester_id": sem_id,
        "subject_id": sub_id,
        "session_date": "2026-11-05",
        "start_time": "10:00:00",
        "end_time": "12:00:00",
        "faculty_type": "internal",
        "venue": "Room 302",
        "duration_minutes": 120,
    }
    s_res = await client.post("/sessions", json=sess_payload, headers=headers)
    assert s_res.status_code == 201
    s_id = s_res.json()["data"]["id"]

    # 2. Test Calendar Events Endpoint
    cal_res = await client.get("/calendar/events", headers=headers)
    assert cal_res.status_code == 200
    events = cal_res.json()["data"]
    assert len(events) >= 1

    # 3. Complete Session & Auto-Create Feedback Form & QR Code
    fb_res = await client.post(f"/feedback/session/{s_id}/complete", headers=headers)
    assert fb_res.status_code == 200
    fb_data = fb_res.json()["data"]
    assert fb_data["status"] == "completed"
    assert "qr_code_path" in fb_data
    form_id = fb_data["form_id"]

    # 4. Submit Student Feedback Response & Verify Sentiment Scoring
    resp_res = await client.post(
        "/feedback/responses",
        json={
            "form_id": form_id,
            "ratings": {"q1": 5, "q2": 4, "q3": 5},
            "open_text": "Excellent and engaging session! Clear explanations of concepts.",
        },
    )
    assert resp_res.status_code == 201
    assert resp_res.json()["data"]["sentiment_score"] is not None
