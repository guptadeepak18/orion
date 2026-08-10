from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Body, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission
from app.schemas.common import ResponseEnvelope
from app.services import invoice_service

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post(
    "/{payment_id}/release",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("invoice", "edit"))],
)
async def release_payment(
    payment_id: UUID,
    reference_no: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
):
    payment = await invoice_service.release_payment(db, payment_id, reference_no)
    return ResponseEnvelope(
        data={
            "id": str(payment.id),
            "amount": float(payment.amount),
            "status": payment.status,
            "payment_reference": payment.payment_reference,
            "paid_at": payment.paid_at.isoformat() if payment.paid_at else None,
        }
    )


@router.get(
    "",
    response_model=ResponseEnvelope[List[dict]],
    dependencies=[Depends(require_permission("invoice", "view"))],
)
async def list_payments(
    status: Optional[str] = None, db: AsyncSession = Depends(get_db)
):
    payments = await invoice_service.list_payments(db, status)
    return ResponseEnvelope(
        data=[
            {
                "id": str(p.id),
                "invoice_id": str(p.invoice_id),
                "amount": float(p.amount),
                "status": p.status,
                "payment_reference": p.payment_reference,
            }
            for p in payments
        ]
    )
