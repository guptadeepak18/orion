from datetime import date
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_academic_full_flow(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create Program
    p_res = await client.post(
        "/academic/programs",
        json={"name": "MBA Executive", "code": "MBA-EXEC", "description": "Exec MBA"},
        headers=headers,
    )
    assert p_res.status_code == 201
    program_id = p_res.json()["data"]["id"]

    # 2. Create Academic Year
    ay_res = await client.post(
        "/academic/academic-years",
        json={"label": "2026-2027", "start_date": "2026-07-01", "end_date": "2027-06-30"},
        headers=headers,
    )
    assert ay_res.status_code == 201
    ay_id = ay_res.json()["data"]["id"]

    # 3. Create Semester
    s_res = await client.post(
        "/academic/semesters",
        json={
            "program_id": program_id,
            "academic_year_id": ay_id,
            "number": 1,
            "label": "Term 1",
            "start_date": "2026-07-01",
            "end_date": "2026-11-30",
        },
        headers=headers,
    )
    assert s_res.status_code == 201
    sem_id = s_res.json()["data"]["id"]

    # 4. Create Batch
    b_res = await client.post(
        "/academic/batches",
        json={
            "program_id": program_id,
            "academic_year_id": ay_id,
            "semester_id": sem_id,
            "name": "MBA Exec Division A",
            "code": "MBA-A",
            "division": "A",
            "student_count": 60,
        },
        headers=headers,
    )
    assert b_res.status_code == 201
    batch_id = b_res.json()["data"]["id"]

    # 5. Create Subject
    sub_res = await client.post(
        "/academic/subjects",
        json={"batch_id": batch_id, "name": "Strategic Management", "code": "MGT601", "credits": 3},
        headers=headers,
    )
    assert sub_res.status_code == 201
    subject_id = sub_res.json()["data"]["id"]

    # 6. Create Topic
    t_res = await client.post(
        "/academic/topics",
        json={"subject_id": subject_id, "name": "Industry Analysis & Five Forces", "sequence_no": 1, "planned_hours": 2},
        headers=headers,
    )
    assert t_res.status_code == 201
    assert t_res.json()["data"]["name"] == "Industry Analysis & Five Forces"

    # 7. Update Program
    up_res = await client.put(
        f"/academic/programs/{program_id}",
        json={"name": "MBA Executive Updated"},
        headers=headers,
    )
    assert up_res.status_code == 200
    assert up_res.json()["data"]["name"] == "MBA Executive Updated"

    # 8. Update Batch
    ub_res = await client.put(
        f"/academic/batches/{batch_id}",
        json={"student_count": 75},
        headers=headers,
    )
    assert ub_res.status_code == 200
    assert ub_res.json()["data"]["student_count"] == 75

    # 9. Update Subject
    us_res = await client.put(
        f"/academic/subjects/{subject_id}",
        json={"credits": 4},
        headers=headers,
    )
    assert us_res.status_code == 200
    assert us_res.json()["data"]["credits"] == 4

    # 10. Delete Topic
    topic_id = t_res.json()["data"]["id"]
    dt_res = await client.delete(
        f"/academic/topics/{topic_id}",
        headers=headers,
    )
    assert dt_res.status_code == 200
    assert dt_res.json()["data"]["deleted"] is True

