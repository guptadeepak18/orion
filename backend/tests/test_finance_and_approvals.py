from datetime import date
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.auth import Role
from app.models.faculty import FacultyExternal
from app.models.session import Engagement, Session
from app.models.finance import Invoice, Payment
from app.models.approval import ApprovalWorkflow, ApprovalStage
from app.services import approval_service, invoice_service, remuneration_service
from app.agents.approval_watchdog import approval_watchdog


@pytest.mark.asyncio
async def test_remuneration_approval_invoice_full_flow(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Setup Academic Backbone & External Faculty
    p_res = await client.post("/academic/programs", json={"name": "FinTech", "code": "FT", "description": "FT"}, headers=headers)
    p_id = p_res.json()["data"]["id"]
    ay_res = await client.post("/academic/academic-years", json={"label": "2026-27", "start_date": "2026-07-01", "end_date": "2027-06-30"}, headers=headers)
    ay_id = ay_res.json()["data"]["id"]
    sem_res = await client.post("/academic/semesters", json={"program_id": p_id, "academic_year_id": ay_id, "number": 1, "label": "Sem 1", "start_date": "2026-07-01", "end_date": "2026-11-30"}, headers=headers)
    sem_id = sem_res.json()["data"]["id"]
    b_res = await client.post("/academic/batches", json={"program_id": p_id, "academic_year_id": ay_id, "semester_id": sem_id, "name": "FT-1", "code": "FT-1"}, headers=headers)
    b_id = b_res.json()["data"]["id"]
    sub_res = await client.post("/academic/subjects", json={"batch_id": b_id, "name": "Blockchain", "code": "BC101"}, headers=headers)
    sub_id = sub_res.json()["data"]["id"]

    ext_fac = FacultyExternal(
        name="Dr. Finance Expert",
        email="fin_expert@wallstreet.com",
        standard_rate_type="per_hour",
        standard_rate=3000.0,
        agreement_start=date(2026, 1, 1),
        agreement_end=date(2027, 12, 31),
        is_active=True
    )
    db_session.add(ext_fac)
    await db_session.commit()

    # 2. Create Session & Engagement
    sess_payload = {
        "program_id": p_id,
        "batch_id": b_id,
        "semester_id": sem_id,
        "subject_id": sub_id,
        "session_date": "2026-10-15",
        "start_time": "09:00:00",
        "end_time": "12:00:00",
        "faculty_type": "external",
        "faculty_external_id": str(ext_fac.id),
        "venue": "Hall A",
        "duration_minutes": 180,
    }
    s_res = await client.post("/sessions", json=sess_payload, headers=headers)
    assert s_res.status_code == 201
    s_id = s_res.json()["data"]["id"]

    eng_res = await client.post(
        "/engagements",
        json={
            "session_id": s_id,
            "faculty_type": "external",
            "faculty_external_id": str(ext_fac.id),
            "topic_delivered": "Smart Contracts",
            "hours": 3.0,
            "program_id": p_id,
            "batch_id": b_id,
        },
        headers=headers,
    )
    assert eng_res.status_code == 201
    eng_id = eng_res.json()["data"]["id"]

    # 3. Calculate Remuneration
    rem_res = await client.post(f"/remuneration/calculate?engagement_id={eng_id}", headers=headers)
    assert rem_res.status_code == 200
    calc_data = rem_res.json()["data"]
    assert calc_data["gross_amount"] == 9000.0  # 3h * 3000

    # 4. Setup Approval Workflow & Stage
    role_res = await db_session.execute(select(Role).where(Role.name == "approver"))
    approver_role = role_res.scalar_one()

    wf = await approval_service.create_approval_workflow(db_session, "Engagement Approval WF", "engagement")
    stage = await approval_service.add_approval_stage(db_session, wf.id, 1, "Director Approval", approver_role.id, sla_hours=24)

    # 5. Process Approval -> Must trigger InvoiceSentinel auto-draft invoice!
    app_res = await client.post(
        "/approvals/action",
        json={
            "stage_id": str(stage.id),
            "entity_type": "engagement",
            "entity_id": eng_id,
            "action": "approved",
            "comments": "Approved after reviewing topic coverage",
        },
        headers=headers,
    )
    assert app_res.status_code == 200
    assert app_res.json()["data"]["new_status"] == "approved"

    # 6. Verify Draft Invoice was auto-created by InvoiceSentinel
    inv_res = await client.get("/invoices", headers=headers)
    assert inv_res.status_code == 200
    invoices = inv_res.json()["data"]
    assert len(invoices) >= 1
    target_inv = invoices[0]
    assert target_inv["status"] == "draft"

    # 7. Verify Invoice with OCR (simulate extracted 8000 != expected 10620 -> ocr_mismatch = True)
    ocr_res = await client.post(
        f"/invoices/{target_inv['id']}/verify",
        json={"file_path": "/uploads/inv_001.pdf", "extracted_amount": 8000.0},
        headers=headers,
    )
    assert ocr_res.status_code == 200
    assert ocr_res.json()["data"]["ocr_mismatch"] == True

    # 8. Release Payment
    pay_res = await client.get("/payments", headers=headers)
    payments = pay_res.json()["data"]
    target_pay = payments[0]

    rel_res = await client.post(
        f"/payments/{target_pay['id']}/release",
        json={"reference_no": "TXN-99887766"},
        headers=headers,
    )
    assert rel_res.status_code == 200
    assert rel_res.json()["data"]["status"] == "released"

    # 9. Test Approval Watchdog SLA scan
    processed = await approval_watchdog.check_pending_approvals_sla(db_session)
    assert isinstance(processed, int)
