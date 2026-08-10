import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.finance import Invoice, RemunerationCalculation, Payment
from app.models.session import Engagement
from app.models.system import AIAgentRun

logger = logging.getLogger("crc_one.invoice_sentinel")


class InvoiceSentinel:
    """
    Invoice & Payment Sentinel Agent:
    1. Auto-drafts invoices when external engagement is approved.
    2. Performs OCR verification on invoice upload to flag mismatch (`ocr_mismatch = True`).
    """

    async def auto_draft_invoice_on_engagement_approval(
        self, db: AsyncSession, engagement_id: UUID
    ) -> Invoice:
        eng_stmt = select(Engagement).where(Engagement.id == engagement_id)
        res = await db.execute(eng_stmt)
        engagement = res.scalar_one()

        if engagement.faculty_type != "external" or not engagement.faculty_external_id:
            return None

        # Fetch remuneration calculation
        calc_stmt = select(RemunerationCalculation).where(
            RemunerationCalculation.engagement_id == engagement_id
        )
        c_res = await db.execute(calc_stmt)
        calc = c_res.scalar_one_or_none()

        if not calc:
            # Fallback values if calculation engine hasn't run yet
            gross = float(engagement.hours * 2500.0)
            gst = gross * 0.18
            total = gross + gst
        else:
            gst = float(calc.tax_amount)
            total = float(calc.net_payable)

        # Generate invoice number: INV-YEAR-UUID_PREFIX
        inv_no = f"INV-{datetime.now().year}-{str(engagement.id)[:8].upper()}"

        # Check existing
        ex_stmt = select(Invoice).where(Invoice.invoice_number == inv_no)
        ex_res = await db.execute(ex_stmt)
        existing = ex_res.scalar_one_or_none()
        if existing:
            return existing

        invoice = Invoice(
            engagement_id=engagement.id,
            faculty_external_id=engagement.faculty_external_id,
            invoice_number=inv_no,
            gst_amount=gst,
            total_amount=total,
            status="draft",
            ocr_mismatch=False
        )
        db.add(invoice)
        await db.flush()

        # Create pending payment entry
        payment = Payment(
            invoice_id=invoice.id,
            amount=total,
            status="pending"
        )
        db.add(payment)

        run = AIAgentRun(
            agent_name="invoice_sentinel",
            triggered_by="event",
            input_context={"engagement_id": str(engagement_id)},
            output={"invoice_id": str(invoice.id), "total_amount": total},
            action_taken=f"Auto-created draft invoice {inv_no} for amount ₹{total:.2f}"
        )
        db.add(run)
        await db.commit()
        await db.refresh(invoice)
        return invoice

    async def verify_invoice_ocr(
        self, db: AsyncSession, invoice_id: UUID, extracted_total: float
    ) -> Tuple[bool, Invoice]:
        inv_stmt = select(Invoice).where(Invoice.id == invoice_id)
        res = await db.execute(inv_stmt)
        invoice = res.scalar_one()

        # Check mismatch if > 1.0 rupee difference
        mismatch = abs(float(invoice.total_amount) - extracted_total) > 1.0
        invoice.ocr_mismatch = mismatch

        run = AIAgentRun(
            agent_name="invoice_sentinel",
            triggered_by="event",
            input_context={"invoice_id": str(invoice_id), "extracted_total": extracted_total},
            output={"ocr_mismatch": mismatch, "expected": float(invoice.total_amount)},
            action_taken=f"OCR verification complete. Mismatch = {mismatch}"
        )
        db.add(run)
        await db.commit()
        await db.refresh(invoice)
        return mismatch, invoice


invoice_sentinel = InvoiceSentinel()
