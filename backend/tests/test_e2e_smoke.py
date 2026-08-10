from datetime import date, timedelta
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.auth import Role, User
from app.models.faculty import FacultyExternal
from app.models.approval import ApprovalWorkflow, ApprovalStage
from app.agents.approval_watchdog import approval_watchdog
from app.services import approval_service


@pytest.mark.asyncio
async def test_full_crc_one_e2e_lifecycle(
    client: AsyncClient, admin_token: str, db_session: AsyncSession
):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # STEP 1: Health & User Verification
    me_res = await client.get("/auth/me", headers=headers)
    assert me_res.status_code == 200
    assert me_res.json()["data"]["email"] == "admin_test@lexiconmile.com"

    # STEP 2: Academic Structure Setup
    p_res = await client.post(
        "/academic/programs",
        json={"name": "Executive PGDM", "code": "E-PGDM", "description": "Executive Leadership"},
        headers=headers,
    )
    assert p_res.status_code == 201
    p_id = p_res.json()["data"]["id"]

    ay_res = await client.post(
        "/academic/academic-years",
        json={"label": "2026-27", "start_date": "2026-07-01", "end_date": "2027-06-30"},
        headers=headers,
    )
    assert ay_res.status_code == 201
    ay_id = ay_res.json()["data"]["id"]

    sem_res = await client.post(
        "/academic/semesters",
        json={
            "program_id": p_id,
            "academic_year_id": ay_id,
            "number": 1,
            "label": "Trimester 1",
            "start_date": "2026-07-01",
            "end_date": "2026-10-31",
        },
        headers=headers,
    )
    assert sem_res.status_code == 201
    sem_id = sem_res.json()["data"]["id"]

    b_res = await client.post(
        "/academic/batches",
        json={
            "program_id": p_id,
            "academic_year_id": ay_id,
            "semester_id": sem_id,
            "name": "E-PGDM Batch 2026",
            "code": "EPGDM-26",
        },
        headers=headers,
    )
    assert b_res.status_code == 201
    b_id = b_res.json()["data"]["id"]

    sub_res = await client.post(
        "/academic/subjects",
        json={"batch_id": b_id, "name": "Corporate Strategy", "code": "MGT901", "credits": 4},
        headers=headers,
    )
    assert sub_res.status_code == 201
    sub_id = sub_res.json()["data"]["id"]

    # STEP 2.5: Create Internal Faculty for Timetable Import
    int_fac_res = await client.post(
        "/faculty/internal",
        json={
            "employee_id": "EMP-STRAT-01",
            "department": "Strategy",
            "designation": "Professor",
            "email": "prof_strategy@lexiconmile.com",
        },
        headers=headers,
    )
    assert int_fac_res.status_code == 201

    # STEP 3: Timetable Preview & Commit
    preview_res = await client.post(
        "/timetable/upload",
        json={
            "batch_id": b_id,
            "raw_rows": [
                {
                    "row_number": 1,
                    "session_date": "2026-09-20",
                    "start_time": "09:00",
                    "end_time": "11:00",
                    "subject_code": "MGT901",
                    "topic_name": "Competitive Advantage",
                    "faculty_email": "prof_strategy@lexiconmile.com",
                    "faculty_type": "internal",
                    "venue": "Executive Suite",
                    "mode": "offline",
                }
            ],
        },
        headers=headers,
    )
    assert preview_res.status_code == 200
    assert len(preview_res.json()["data"]["valid_rows"]) == 1

    commit_res = await client.post(
        "/timetable/commit",
        json={
            "batch_id": b_id,
            "term_label": "Trimester 1",
            "valid_rows": preview_res.json()["data"]["valid_rows"],
        },
        headers=headers,
    )
    assert commit_res.status_code == 201
    assert commit_res.json()["data"]["term_label"] == "Trimester 1"

    # STEP 4: Scheduler Sentinel Blocks Conflict
    conflict_res = await client.post(
        "/sessions",
        json={
            "program_id": p_id,
            "batch_id": b_id,
            "semester_id": sem_id,
            "subject_id": sub_id,
            "session_date": "2026-09-20",
            "start_time": "10:00:00",  # Overlaps 09:00-11:00
            "end_time": "12:00:00",
            "faculty_type": "internal",
            "venue": "Executive Suite",  # Same venue
            "duration_minutes": 120,
        },
        headers=headers,
    )
    assert conflict_res.status_code == 409
    assert "conflict" in conflict_res.json()["detail"]["message"].lower()

    # STEP 5: Add External Faculty & Document
    fac_res = await client.post(
        "/faculty/external",
        json={
            "name": "Dr. Aris Thorne",
            "organization": "McKinsey",
            "expertise": ["Strategy", "M&A"],
            "email": "aris.thorne@mckinsey.com",
            "standard_rate_type": "per_hour",
            "standard_rate": 5000.0,
            "agreement_start": "2026-01-01",
            "agreement_end": "2027-12-31",
        },
        headers=headers,
    )
    assert fac_res.status_code == 201
    fac_id = fac_res.json()["data"]["id"]

    doc_res = await client.post(
        f"/faculty/external/{fac_id}/documents",
        json={"doc_type": "agreement", "file_path": "/vault/agreement_thorne.pdf", "expiry_date": "2027-12-31"},
        headers=headers,
    )
    assert doc_res.status_code == 201

    # STEP 6: Schedule Valid Session for External Faculty
    valid_sess_res = await client.post(
        "/sessions",
        json={
            "program_id": p_id,
            "batch_id": b_id,
            "semester_id": sem_id,
            "subject_id": sub_id,
            "session_date": "2026-09-21",
            "start_time": "14:00:00",
            "end_time": "18:00:00",
            "faculty_type": "external",
            "faculty_external_id": fac_id,
            "venue": "Auditorium 2",
            "duration_minutes": 240,
        },
        headers=headers,
    )
    assert valid_sess_res.status_code == 201
    s2_id = valid_sess_res.json()["data"]["id"]

    # STEP 7: Create Engagement & Calculate Remuneration with Anomaly Check
    eng_res = await client.post(
        "/engagements",
        json={
            "session_id": s2_id,
            "faculty_type": "external",
            "faculty_external_id": fac_id,
            "topic_delivered": "M&A Valuation Models",
            "hours": 6.0,
            "program_id": p_id,
            "batch_id": b_id,
        },
        headers=headers,
    )
    assert eng_res.status_code == 201
    eng_id = eng_res.json()["data"]["id"]

    calc_res = await client.post(f"/remuneration/calculate?engagement_id={eng_id}", headers=headers)
    assert calc_res.status_code == 200
    calc_data = calc_res.json()["data"]
    assert calc_data["gross_amount"] == 30000.0  # 6h * 5000 = 30,000 > 25,000 threshold
    assert calc_data["is_anomaly_flagged"] == True

    # STEP 8: Process Approval -> Triggers InvoiceSentinel Auto-Draft
    role_res = await db_session.execute(select(Role).where(Role.name == "approver"))
    approver_role = role_res.scalar_one()
    wf = await approval_service.create_approval_workflow(db_session, "Strategy Approval", "engagement")
    stage = await approval_service.add_approval_stage(db_session, wf.id, 1, "Dean Approval", approver_role.id)

    app_res = await client.post(
        "/approvals/action",
        json={
            "stage_id": str(stage.id),
            "entity_type": "engagement",
            "entity_id": eng_id,
            "action": "approved",
            "comments": "Approved by Dean",
        },
        headers=headers,
    )
    assert app_res.status_code == 200

    # STEP 9: Verify Invoice OCR & Release Payment
    inv_res = await client.get("/invoices", headers=headers)
    target_inv = inv_res.json()["data"][0]

    verify_res = await client.post(
        f"/invoices/{target_inv['id']}/verify",
        json={"file_path": "/uploads/inv_thorne.pdf", "extracted_amount": 35400.0},
        headers=headers,
    )
    assert verify_res.status_code == 200
    assert verify_res.json()["data"]["ocr_mismatch"] == False

    pay_res = await client.get("/payments", headers=headers)
    target_pay = pay_res.json()["data"][0]
    rel_res = await client.post(
        f"/payments/{target_pay['id']}/release",
        json={"reference_no": "TXN-EPGDM-8899"},
        headers=headers,
    )
    assert rel_res.status_code == 200

    # STEP 10: Complete Session & Submit Student Feedback with Sentiment Analysis
    fb_res = await client.post(f"/feedback/session/{s2_id}/complete", headers=headers)
    assert fb_res.status_code == 200
    form_id = fb_res.json()["data"]["form_id"]

    resp_res = await client.post(
        "/feedback/responses",
        json={
            "form_id": form_id,
            "ratings": {"q1": 5, "q2": 5, "q3": 5},
            "open_text": "Masterclass in valuation! Highly practical and insightful.",
        },
    )
    assert resp_res.status_code == 201
    assert resp_res.json()["data"]["sentiment_score"] is not None

    # STEP 11: Query Operational Copilot & Export CSV Reports
    copilot_res = await client.post(
        "/copilot/query",
        json={"prompt": "Summarize scheduled sessions"},
        headers=headers,
    )
    assert copilot_res.status_code == 200

    export_res = await client.get("/reports/export?report_type=remuneration", headers=headers)
    assert export_res.status_code == 200
    assert "faculty_name" in export_res.text
