from datetime import date, timedelta
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_faculty_crud_and_compliance_hard_validation(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create Internal Faculty
    int_res = await client.post(
        "/faculty/internal",
        json={
            "employee_id": "EMP-200",
            "department": "Analytics",
            "designation": "Associate Professor",
            "email": "prof_analytics@lexiconmile.com",
            "phone": "+91 9876543210",
        },
        headers=headers,
    )
    assert int_res.status_code == 201
    assert int_res.json()["data"]["employee_id"] == "EMP-200"

    # 2. Create External Faculty with EXPIRED agreement (expired 2 days ago)
    past_date = str(date.today() - timedelta(days=2))
    ext_res = await client.post(
        "/faculty/external",
        json={
            "name": "Dr. Industry Expert",
            "organization": "Tech Corp",
            "expertise": ["AI", "Machine Learning"],
            "email": "dr_expert@techcorp.com",
            "standard_rate_type": "per_hour",
            "standard_rate": 2500.0,
            "agreement_start": "2025-01-01",
            "agreement_end": past_date,
        },
        headers=headers,
    )
    assert ext_res.status_code == 201
    ext_fac_id = ext_res.json()["data"]["id"]

    # 3. Document Vault Upload
    doc_res = await client.post(
        f"/faculty/external/{ext_fac_id}/documents",
        json={
            "doc_type": "agreement",
            "file_path": "/uploads/agreement_v1.pdf",
            "expiry_date": past_date,
        },
        headers=headers,
    )
    assert doc_res.status_code == 201
    assert doc_res.json()["data"]["version"] == 1

    # 4. Attempt to create session for external faculty with EXPIRED agreement -> MUST BE BLOCKED BY COMPLIANCE GUARD!
    # Setup academic backbone first
    p_res = await client.post("/academic/programs", json={"name": "Data Science", "code": "DS", "description": "DS"}, headers=headers)
    p_id = p_res.json()["data"]["id"]
    ay_res = await client.post("/academic/academic-years", json={"label": "2026-27", "start_date": "2026-07-01", "end_date": "2027-06-30"}, headers=headers)
    ay_id = ay_res.json()["data"]["id"]
    sem_res = await client.post("/academic/semesters", json={"program_id": p_id, "academic_year_id": ay_id, "number": 1, "label": "Sem 1", "start_date": "2026-07-01", "end_date": "2026-11-30"}, headers=headers)
    sem_id = sem_res.json()["data"]["id"]
    b_res = await client.post("/academic/batches", json={"program_id": p_id, "academic_year_id": ay_id, "semester_id": sem_id, "name": "DS Batch 1", "code": "DS-1"}, headers=headers)
    b_id = b_res.json()["data"]["id"]
    sub_res = await client.post("/academic/subjects", json={"batch_id": b_id, "name": "Deep Learning", "code": "AI501"}, headers=headers)
    sub_id = sub_res.json()["data"]["id"]

    sess_payload = {
        "program_id": p_id,
        "batch_id": b_id,
        "semester_id": sem_id,
        "subject_id": sub_id,
        "session_date": str(date.today()),
        "start_time": "14:00:00",
        "end_time": "16:00:00",
        "faculty_type": "external",
        "faculty_external_id": ext_fac_id,
        "venue": "Lab 1",
        "duration_minutes": 120,
    }

    sess_res = await client.post("/sessions", json=sess_payload, headers=headers)
    assert sess_res.status_code == 400
    assert "agreement expired" in sess_res.json()["detail"]
