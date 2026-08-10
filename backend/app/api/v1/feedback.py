from typing import Optional, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Body, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission
from app.schemas.common import ResponseEnvelope
from app.services import feedback_service

router = APIRouter(prefix="/feedback", tags=["Feedback"])


@router.post(
    "/session/{session_id}/complete",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("academic", "edit"))],
)
async def complete_session_and_create_feedback(
    session_id: UUID, db: AsyncSession = Depends(get_db)
):
    session, form = await feedback_service.complete_session_and_trigger_feedback(db, session_id)
    return ResponseEnvelope(
        data={
            "session_id": str(session.id),
            "status": session.status,
            "form_id": str(form.id),
            "qr_code_path": form.qr_code_path,
            "questions": form.questions,
        }
    )


@router.post(
    "/responses",
    response_model=ResponseEnvelope[dict],
    status_code=status.HTTP_201_CREATED,
)
async def submit_feedback(
    form_id: UUID = Body(...),
    ratings: Dict[str, Any] = Body(...),
    open_text: Optional[str] = Body(None),
    db: AsyncSession = Depends(get_db),
):
    resp = await feedback_service.submit_feedback_response(db, form_id, ratings, open_text)
    return ResponseEnvelope(
        data={
            "id": str(resp.id),
            "form_id": str(resp.form_id),
            "sentiment_score": resp.sentiment_score,
            "submitted_at": resp.submitted_at.isoformat(),
        }
    )


@router.get(
    "/forms/{form_id}",
    response_model=ResponseEnvelope[dict],
)
async def get_feedback_form(form_id: UUID, db: AsyncSession = Depends(get_db)):
    form = await feedback_service.get_feedback_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Feedback form not found")
    return ResponseEnvelope(
        data={
            "id": str(form.id),
            "session_id": str(form.session_id),
            "qr_code_path": form.qr_code_path,
            "questions": form.questions,
        }
    )
