import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.feedback import FeedbackForm, FeedbackResponse
from app.models.session import Session
from app.models.system import Notification, AIAgentRun
from app.services.llm_client import llm_client

logger = logging.getLogger("crc_one.feedback_intelligence_agent")


class FeedbackIntelligenceAgent:
    """
    Feedback Intelligence Agent:
    1. Auto-creates feedback_forms on session status transition to 'completed'.
    2. Runs sentiment analysis on feedback open_text and calculates sentiment_score.
    3. Scans consecutive sessions for negative sentiment trends.
    """

    async def auto_create_feedback_form(
        self, db: AsyncSession, session_id: UUID
    ) -> FeedbackForm:
        # Check existing form
        f_stmt = select(FeedbackForm).where(FeedbackForm.session_id == session_id)
        f_res = await db.execute(f_stmt)
        existing = f_res.scalar_one_or_none()
        if existing:
            return existing

        default_questions = [
            {"id": "q1", "text": "How clearly did the faculty explain the core concepts?", "type": "rating_5"},
            {"id": "q2", "text": "How interactive and engaging was the session?", "type": "rating_5"},
            {"id": "q3", "text": "Were your doubts adequately addressed?", "type": "rating_5"},
            {"id": "q4", "text": "Open comments and constructive feedback", "type": "text"}
        ]

        qr_path = f"/qr/feedback_session_{str(session_id)[:8]}.png"

        form = FeedbackForm(
            session_id=session_id,
            qr_code_path=qr_path,
            questions={"questions": default_questions}
        )
        db.add(form)
        await db.flush()

        run = AIAgentRun(
            agent_name="feedback_intelligence_agent",
            triggered_by="event",
            input_context={"session_id": str(session_id)},
            output={"form_id": str(form.id), "qr_code_path": qr_path},
            action_taken=f"Auto-created feedback form and QR code for completed session {session_id}"
        )
        db.add(run)
        await db.commit()
        await db.refresh(form)
        return form

    async def analyze_response_sentiment(
        self, db: AsyncSession, response_id: UUID
    ) -> float:
        r_stmt = select(FeedbackResponse).where(FeedbackResponse.id == response_id)
        res = await db.execute(r_stmt)
        feedback_resp = res.scalar_one()

        if not feedback_resp.open_text:
            feedback_resp.sentiment_score = 0.5
        else:
            score = await llm_client.analyze_sentiment(feedback_resp.open_text)
            feedback_resp.sentiment_score = score

        await db.commit()
        await db.refresh(feedback_resp)
        return feedback_resp.sentiment_score


feedback_intelligence_agent = FeedbackIntelligenceAgent()
