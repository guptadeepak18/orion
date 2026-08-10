from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.feedback import FeedbackForm, FeedbackResponse
from app.models.session import Session
from app.agents.feedback_intelligence_agent import feedback_intelligence_agent


async def complete_session_and_trigger_feedback(
    db: AsyncSession, session_id: UUID
) -> Tuple[Session, FeedbackForm]:
    s_stmt = select(Session).where(Session.id == session_id)
    s_res = await db.execute(s_stmt)
    session = s_res.scalar_one()

    session.status = "completed"
    await db.flush()

    # Trigger Feedback Intelligence Agent auto-form creation
    form = await feedback_intelligence_agent.auto_create_feedback_form(db, session_id)
    return session, form


async def submit_feedback_response(
    db: AsyncSession, form_id: UUID, ratings: Dict[str, Any], open_text: Optional[str] = None
) -> FeedbackResponse:
    resp = FeedbackResponse(
        form_id=form_id,
        ratings=ratings,
        open_text=open_text
    )
    db.add(resp)
    await db.flush()

    # Analyze sentiment
    await feedback_intelligence_agent.analyze_response_sentiment(db, resp.id)

    await db.commit()
    await db.refresh(resp)
    return resp


async def get_feedback_form(db: AsyncSession, form_id: UUID) -> Optional[FeedbackForm]:
    stmt = select(FeedbackForm).where(FeedbackForm.id == form_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()
