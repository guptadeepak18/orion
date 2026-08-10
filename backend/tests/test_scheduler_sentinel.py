import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.faculty import FacultyInternal


@pytest.mark.asyncio
async def test_scheduler_sentinel_conflict_blocking(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Setup academic backbone first
    p_res = await client.post("/academic/programs", json={"name": "PGDM", "code": "PGDM", "description": "PGDM"}, headers=headers)
    p_id = p_res.json()["data"]["id"]
    ay_res = await client.post("/academic/academic-years", json={"label": "2026-27", "start_date": "2026-07-01", "end_date": "2027-06-30"}, headers=headers)
    ay_id = ay_res.json()["data"]["id"]
    sem_res = await client.post("/academic/semesters", json={"program_id": p_id, "academic_year_id": ay_id, "number": 1, "label": "Sem 1", "start_date": "2026-07-01", "end_date": "2026-11-30"}, headers=headers)
    sem_id = sem_res.json()["data"]["id"]
    b_res = await client.post("/academic/batches", json={"program_id": p_id, "academic_year_id": ay_id, "semester_id": sem_id, "name": "Batch A", "code": "B-A"}, headers=headers)
    b_id = b_res.json()["data"]["id"]
    sub_res = await client.post("/academic/subjects", json={"batch_id": b_id, "name": "Finance", "code": "FIN101"}, headers=headers)
    sub_id = sub_res.json()["data"]["id"]

    # Create Faculty
    faculty = FacultyInternal(
        employee_id="EMP-101",
        department="Finance",
        designation="Professor",
        email="prof_finance@lexiconmile.com"
    )
    db_session.add(faculty)
    await db_session.commit()

    # 1. Create first valid session
    s1_payload = {
        "program_id": p_id,
        "batch_id": b_id,
        "semester_id": sem_id,
        "subject_id": sub_id,
        "session_date": "2026-09-10",
        "start_time": "10:00:00",
        "end_time": "12:00:00",
        "faculty_type": "internal",
        "faculty_internal_id": str(faculty.id),
        "venue": "Auditorium 1",
        "duration_minutes": 120
    }
    res1 = await client.post("/sessions", json=s1_payload, headers=headers)
    assert res1.status_code == 201

    # 2. Try to create conflicting session in SAME VENUE at overlapping time (11:00 to 13:00)
    s2_payload = {
        "program_id": p_id,
        "batch_id": b_id,
        "semester_id": sem_id,
        "subject_id": sub_id,
        "session_date": "2026-09-10",
        "start_time": "11:00:00",
        "end_time": "13:00:00",
        "faculty_type": "internal",
        "venue": "Auditorium 1",
        "duration_minutes": 120
    }
    res2 = await client.post("/sessions", json=s2_payload, headers=headers)
    assert res2.status_code == 409
    err_detail = res2.json()["detail"]
    assert "Venue conflict" in err_detail["message"]
    assert len(err_detail["alternate_slots"]) > 0
