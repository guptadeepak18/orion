import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_student_full_flow(client: AsyncClient, admin_token: str):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create Student
    create_res = await client.post(
        "/students",
        json={
            "roll_no": "2026-MBA-999",
            "enrollment_no": "LEX-2026-9999",
            "full_name": "Rohan Gupta",
            "email": "rohan.gupta@lexiconmile.com",
            "phone": "+91 9998887770",
            "cgpa": 3.75,
            "attendance_percentage": 96.0,
            "status": "active",
        },
        headers=headers,
    )
    assert create_res.status_code == 201
    student_data = create_res.json()["data"]
    student_id = student_data["id"]
    assert student_data["roll_no"] == "2026-MBA-999"

    # 2. List Students
    list_res = await client.get("/students", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()["data"]) >= 1

    # 3. Filter Students
    filter_res = await client.get("/students?q=Rohan", headers=headers)
    assert filter_res.status_code == 200
    assert len(filter_res.json()["data"]) == 1

    # 4. Get Student Detail
    get_res = await client.get(f"/students/{student_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["data"]["full_name"] == "Rohan Gupta"

    # 5. Update Student
    up_res = await client.put(
        f"/students/{student_id}",
        json={"cgpa": 3.88},
        headers=headers,
    )
    assert up_res.status_code == 200
    assert up_res.json()["data"]["cgpa"] == 3.88

    # 6. Delete Student
    del_res = await client.delete(f"/students/{student_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["data"]["deleted"] is True
