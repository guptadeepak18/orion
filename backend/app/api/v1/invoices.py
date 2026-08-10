from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission, get_current_token_payload
from app.schemas.common import ResponseEnvelope
from app.services import invoice_service

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.post(
    "/{invoice_id}/verify",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("invoice", "edit"))],
)
async def verify_invoice(
    invoice_id: UUID,
    file_path: str = Body(...),
    extracted_amount: float = Body(...),
    payload: dict = Depends(get_current_token_payload),
    db: AsyncSession = Depends(get_db),
):
    user_id_str = payload.get("sub")
    verifier_id = UUID(user_id_str) if user_id_str else None

    invoice = await invoice_service.verify_invoice_upload(
        db, invoice_id, file_path, extracted_amount, verifier_id
    )

    return ResponseEnvelope(
        data={
            "id": str(invoice.id),
            "invoice_number": invoice.invoice_number,
            "status": invoice.status,
            "ocr_mismatch": invoice.ocr_mismatch,
            "total_amount": float(invoice.total_amount),
        }
    )


@router.get(
    "",
    response_model=ResponseEnvelope[List[dict]],
    dependencies=[Depends(require_permission("invoice", "view"))],
)
async def list_invoices(
    status: Optional[str] = None, db: AsyncSession = Depends(get_db)
):
    invoices = await invoice_service.list_invoices(db, status)
    return ResponseEnvelope(
        data=[
            {
                "id": str(i.id),
                "invoice_number": i.invoice_number,
                "status": i.status,
                "total_amount": float(i.total_amount),
                "gst_amount": float(i.gst_amount),
                "ocr_mismatch": i.ocr_mismatch,
                "submitted_at": i.submitted_at.isoformat(),
            }
            for i in invoices
        ]
    )
