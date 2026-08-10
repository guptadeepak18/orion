from datetime import datetime, timezone
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.finance import Invoice, Payment
from app.agents.invoice_sentinel import invoice_sentinel


async def verify_invoice_upload(
    db: AsyncSession, invoice_id: UUID, file_path: str, extracted_amount: float, verifier_id: UUID
) -> Invoice:
    inv_stmt = select(Invoice).where(Invoice.id == invoice_id)
    res = await db.execute(inv_stmt)
    invoice = res.scalar_one()

    invoice.file_path = file_path
    invoice.verified_by = verifier_id
    invoice.verified_at = datetime.now(timezone.utc)
    invoice.status = "verified"

    # Run Invoice Sentinel OCR Verification
    await invoice_sentinel.verify_invoice_ocr(db, invoice_id, extracted_amount)

    await db.commit()
    await db.refresh(invoice)
    return invoice


async def release_payment(
    db: AsyncSession, payment_id: UUID, reference_no: str
) -> Payment:
    p_stmt = select(Payment).where(Payment.id == payment_id)
    res = await db.execute(p_stmt)
    payment = res.scalar_one()

    payment.payment_reference = reference_no
    payment.paid_at = datetime.now(timezone.utc)
    payment.status = "released"

    # Update associated invoice status to paid
    inv_stmt = select(Invoice).where(Invoice.id == payment.invoice_id)
    i_res = await db.execute(inv_stmt)
    invoice = i_res.scalar_one_or_none()
    if invoice:
        invoice.status = "paid"

    await db.commit()
    await db.refresh(payment)
    return payment


async def list_invoices(db: AsyncSession, status: Optional[str] = None) -> List[Invoice]:
    stmt = select(Invoice).where(Invoice.is_deleted == False)
    if status:
        stmt = stmt.where(Invoice.status == status)
    stmt = stmt.order_by(Invoice.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def list_payments(db: AsyncSession, status: Optional[str] = None) -> List[Payment]:
    stmt = select(Payment).where(Payment.is_deleted == False)
    if status:
        stmt = stmt.where(Payment.status == status)
    stmt = stmt.order_by(Payment.created_at.desc())
    res = await db.execute(stmt)
    return list(res.scalars().all())
