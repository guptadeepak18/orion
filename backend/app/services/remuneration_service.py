from datetime import date
from typing import List, Optional
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.finance import RemunerationRule, RemunerationCalculation, Invoice
from app.models.faculty import FacultyExternal
from app.models.session import Engagement, Session
from app.models.academic import Program, Batch, Subject
from app.schemas.remuneration import ExternalRemunerationBillingResponse


async def create_remuneration_rule(
    db: AsyncSession,
    faculty_external_id: Optional[UUID],
    rate_type: str,
    rate_value: float,
    tax_percent: float = 18.0,
    effective_from: date = date.today(),
) -> RemunerationRule:
    rule = RemunerationRule(
        faculty_external_id=faculty_external_id,
        rate_type=rate_type,
        rate_value=rate_value,
        tax_percent=tax_percent,
        effective_from=effective_from,
    )
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


async def calculate_engagement_remuneration(
    db: AsyncSession, engagement_id: UUID
) -> RemunerationCalculation:
    eng_stmt = select(Engagement).where(Engagement.id == engagement_id)
    res = await db.execute(eng_stmt)
    engagement = res.scalar_one()

    rate_type = "per_hour"
    rate_val = 2500.0
    tax_pct = 0.0
    is_gst_applicable = False

    if engagement.faculty_external_id:
        fac_stmt = select(FacultyExternal).where(FacultyExternal.id == engagement.faculty_external_id)
        f_res = await db.execute(fac_stmt)
        faculty = f_res.scalar_one_or_none()
        if faculty:
            rate_type = faculty.standard_rate_type or "per_hour"
            rate_val = float(faculty.standard_rate or 0.0)
            is_gst_applicable = bool(faculty.is_gst_applicable)
            if is_gst_applicable:
                tax_pct = float(faculty.gst_rate_percent or 18.0)

    hours = float(engagement.hours)
    if rate_type == "per_hour":
        gross = hours * rate_val
    elif rate_type == "per_session":
        gross = rate_val
    else:  # fixed
        gross = rate_val

    tax_amount = gross * (tax_pct / 100.0) if is_gst_applicable else 0.0
    net_payable = gross + tax_amount

    # Anomaly Detection: Flag if hours > 8
    is_anomaly = False
    anomaly_reason = None
    if hours > 8.0:
        is_anomaly = True
        anomaly_reason = f"High workload anomaly: Single engagement duration {hours}h exceeds 8.0h limit"

    calc = RemunerationCalculation(
        engagement_id=engagement.id,
        hours=hours,
        gross_amount=gross,
        tax_amount=tax_amount,
        deductions=0.0,
        net_payable=net_payable,
        is_anomaly_flagged=is_anomaly,
        anomaly_reason=anomaly_reason,
    )
    db.add(calc)
    await db.flush()

    engagement.remuneration_calculation_id = calc.id
    await db.commit()
    await db.refresh(calc)
    return calc


async def process_completed_external_session(db: AsyncSession, session: Session) -> Optional[Engagement]:
    """
    When an external faculty session is marked as completed:
    1. Ensure an Engagement record exists
    2. Automatically calculate remuneration based on the cost defined in the faculty profile (including GST applicability)
    3. Auto-draft an Invoice for finance processing
    """
    if session.faculty_type != "external" or not session.faculty_external_id:
        return None

    # Check existing engagement
    eng_stmt = select(Engagement).where(Engagement.session_id == session.id)
    eng_res = await db.execute(eng_stmt)
    engagement = eng_res.scalar_one_or_none()

    hours = round(float(session.duration_minutes) / 60.0, 2)
    if hours <= 0:
        hours = 1.0

    if not engagement:
        # Determine topic / subject name
        topic_str = session.notes or f"Academic Session ({session.session_date})"
        if session.subject_id:
            sub_res = await db.execute(select(Subject).where(Subject.id == session.subject_id))
            sub = sub_res.scalar_one_or_none()
            if sub:
                topic_str = f"{sub.code} - {sub.name}"

        engagement = Engagement(
            session_id=session.id,
            faculty_type="external",
            faculty_external_id=session.faculty_external_id,
            topic_delivered=topic_str,
            hours=hours,
            program_id=session.program_id,
            batch_id=session.batch_id,
            payment_status="unpaid",
            approval_status="approved",
        )
        db.add(engagement)
        await db.commit()
        await db.refresh(engagement)

    # Calculate Remuneration if missing
    if not engagement.remuneration_calculation_id:
        calc = await calculate_engagement_remuneration(db, engagement.id)
        engagement.remuneration_calculation_id = calc.id

    # Create Invoice if missing
    inv_stmt = select(Invoice).where(Invoice.engagement_id == engagement.id)
    inv_res = await db.execute(inv_stmt)
    invoice = inv_res.scalar_one_or_none()
    if not invoice:
        calc_stmt = select(RemunerationCalculation).where(RemunerationCalculation.id == engagement.remuneration_calculation_id)
        c_res = await db.execute(calc_stmt)
        calc = c_res.scalar_one_or_none()

        inv_no = f"INV-{session.session_date.strftime('%Y%m%d')}-{str(session.id)[:6].upper()}"
        total_amt = float(calc.net_payable) if calc else float(hours * 2500.0)
        gst_amt = float(calc.tax_amount) if calc else 0.0

        invoice = Invoice(
            engagement_id=engagement.id,
            faculty_external_id=session.faculty_external_id,
            invoice_number=inv_no,
            gst_amount=gst_amt,
            total_amount=total_amt,
            status="draft",
        )
        db.add(invoice)
        engagement.payment_status = "invoiced"
        await db.commit()

    return engagement


async def list_external_remuneration_billings(db: AsyncSession) -> List[ExternalRemunerationBillingResponse]:
    """
    Fetch all completed external faculty sessions with their complete remuneration calculation,
    faculty cost structure, GST applicability, tax, bank details, and invoice status.
    """
    stmt = (
        select(Session)
        .options(
            selectinload(Session.faculty_external),
            selectinload(Session.program),
            selectinload(Session.batch),
            selectinload(Session.subject),
        )
        .where(Session.faculty_type == "external", Session.is_deleted == False)
        .order_by(Session.session_date.desc(), Session.start_time.desc())
    )
    res = await db.execute(stmt)
    sessions = list(res.scalars().all())

    billings: List[ExternalRemunerationBillingResponse] = []

    for sess in sessions:
        if not sess.faculty_external:
            continue

        engagement = await process_completed_external_session(db, sess)
        if not engagement:
            continue

        calc_stmt = select(RemunerationCalculation).where(RemunerationCalculation.id == engagement.remuneration_calculation_id)
        c_res = await db.execute(calc_stmt)
        calc = c_res.scalar_one_or_none()

        inv_stmt = select(Invoice).where(Invoice.engagement_id == engagement.id)
        i_res = await db.execute(inv_stmt)
        invoice = i_res.scalar_one_or_none()

        fac = sess.faculty_external

        is_gst = bool(fac.is_gst_applicable)
        tax_pct = float(fac.gst_rate_percent or 18.0) if is_gst else 0.0

        gross = float(calc.gross_amount) if calc else float(engagement.hours * fac.standard_rate)
        tax = float(calc.tax_amount) if calc else float(gross * (tax_pct / 100.0) if is_gst else 0.0)
        net = float(calc.net_payable) if calc else float(gross + tax)

        billing_item = ExternalRemunerationBillingResponse(
            id=engagement.id,
            session_id=sess.id,
            session_date=sess.session_date,
            start_time=sess.start_time.strftime("%H:%M") if hasattr(sess.start_time, "strftime") else str(sess.start_time),
            end_time=sess.end_time.strftime("%H:%M") if hasattr(sess.end_time, "strftime") else str(sess.end_time),
            duration_minutes=sess.duration_minutes,
            duration_hours=float(engagement.hours),
            venue=sess.venue,
            session_status=sess.status,
            program_name=sess.program.name if sess.program else None,
            batch_name=sess.batch.name if sess.batch else None,
            subject_code=sess.subject.code if sess.subject else None,
            subject_name=sess.subject.name if sess.subject else None,
            topic_delivered=engagement.topic_delivered or (sess.subject.name if sess.subject else "Class Session"),
            faculty_id=fac.id,
            faculty_name=fac.name,
            faculty_designation=fac.designation,
            organization=fac.organization,
            email=fac.email,
            phone=fac.phone,
            is_gst_applicable=is_gst,
            pan=fac.pan,
            gst_number=fac.gst_number if is_gst else None,
            bank_name=fac.bank_name,
            bank_account_no=fac.bank_account_no,
            bank_ifsc=fac.bank_ifsc,
            rate_type=fac.standard_rate_type or "per_hour",
            rate_value=float(fac.standard_rate or 0.0),
            gross_amount=gross,
            tax_percent=tax_pct,
            tax_amount=tax,
            net_payable=net,
            is_anomaly_flagged=calc.is_anomaly_flagged if calc else False,
            anomaly_reason=calc.anomaly_reason if calc else None,
            approval_status=engagement.approval_status,
            payment_status=engagement.payment_status,
            invoice_number=invoice.invoice_number if invoice else None,
            invoice_status=invoice.status if invoice else None,
        )
        billings.append(billing_item)

    return billings
