from uuid import UUID
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import require_permission
from app.schemas.common import ResponseEnvelope
from app.schemas.email_template import (
    EmailTemplateResponse,
    EmailTemplateCreate,
    EmailTemplateUpdate,
    EmailTemplateTestSendRequest,
    EmailTemplatePreviewRequest,
    EmailTemplatePreviewResponse,
    EmailTemplateAIGenerateRequest,
    EmailTemplateAIGenerateResponse,
)
from app.services import email_template_service
from app.services.email_template_ai_service import generate_email_template_with_ai
from app.services.email_service import _send_via_hostinger_mail_api, send_custom_html_email
from app.core.config import settings

router = APIRouter(prefix="/email-templates", tags=["Email Notification Templates"])


@router.get(
    "",
    response_model=ResponseEnvelope[List[EmailTemplateResponse]],
    dependencies=[Depends(require_permission("system_settings", "view"))],
)
async def list_templates(
    category: Optional[str] = Query(None, description="Filter by category"),
    is_active: Optional[bool] = Query(None, description="Filter by active state"),
    db: AsyncSession = Depends(get_db),
):
    # Ensure default templates are seeded
    await email_template_service.seed_default_templates(db)
    templates = await email_template_service.list_templates(db, category=category, is_active=is_active)
    return ResponseEnvelope(data=[EmailTemplateResponse.model_validate(t) for t in templates])


@router.get(
    "/{template_id}",
    response_model=ResponseEnvelope[EmailTemplateResponse],
    dependencies=[Depends(require_permission("system_settings", "view"))],
)
async def get_template(template_id: UUID, db: AsyncSession = Depends(get_db)):
    template = await email_template_service.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Email template not found")
    return ResponseEnvelope(data=EmailTemplateResponse.model_validate(template))


@router.post(
    "",
    response_model=ResponseEnvelope[EmailTemplateResponse],
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("system_settings", "edit"))],
)
async def create_template(data: EmailTemplateCreate, db: AsyncSession = Depends(get_db)):
    try:
        template = await email_template_service.create_template(db, data)
        return ResponseEnvelope(data=EmailTemplateResponse.model_validate(template))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put(
    "/{template_id}",
    response_model=ResponseEnvelope[EmailTemplateResponse],
    dependencies=[Depends(require_permission("system_settings", "edit"))],
)
async def update_template(
    template_id: UUID,
    data: EmailTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    try:
        template = await email_template_service.update_template(db, template_id, data)
        return ResponseEnvelope(data=EmailTemplateResponse.model_validate(template))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete(
    "/{template_id}",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("system_settings", "edit"))],
)
async def delete_template(template_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        await email_template_service.delete_template(db, template_id)
        return ResponseEnvelope(data={"message": "Template deleted successfully."})
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/{template_id}/reset",
    response_model=ResponseEnvelope[EmailTemplateResponse],
    dependencies=[Depends(require_permission("system_settings", "edit"))],
)
async def reset_template(template_id: UUID, db: AsyncSession = Depends(get_db)):
    try:
        template = await email_template_service.reset_to_default(db, template_id)
        return ResponseEnvelope(data=EmailTemplateResponse.model_validate(template))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/preview",
    response_model=ResponseEnvelope[EmailTemplatePreviewResponse],
    dependencies=[Depends(require_permission("system_settings", "view"))],
)
async def preview_template(req: EmailTemplatePreviewRequest):
    context = req.context_data or {
        "full_name": "Deepak Gupta",
        "student_name": "Deepak Gupta",
        "faculty_name": "Prof. Deepak Gupta",
        "recipient_name": "Deepak Gupta",
        "prn_number": "26PGDM001",
        "otp": "749201",
        "expiry_minutes": "10",
        "program_name": "PGDM - Post Graduate Diploma in Management",
        "batch_name": "PGDM Batch 2026-2028",
        "division_name": "Division A",
        "subject_name": "Marketing Strategy & Operations",
        "session_date": "15 Sep 2026",
        "session_time": "10:00 AM - 12:00 PM",
        "room_no": "Auditorium Hall 2",
        "attendance_percentage": "68",
        "threshold_percentage": "75",
        "sessions_attended": "17",
        "total_sessions": "25",
        "title": "Upcoming Campus Industry Lecture",
        "message": "We are pleased to invite you to our upcoming executive leadership seminar.",
        "action_url": "https://orion.mile.education/dashboard",
        "action_button_text": "View Session Details",
        "rejection_reason": "Graduation marks statement attachment is unverified or incomplete.",
        "login_url": "https://orion.mile.education/login",
        "app_name": "Orion Portal",
        "support_email": "deepak.gupta@mile.education",
    }
    rendered_sub = email_template_service.render_placeholders(req.subject, context)
    rendered_html = email_template_service.render_placeholders(req.html_content, context)
    return ResponseEnvelope(
        data=EmailTemplatePreviewResponse(
            rendered_subject=rendered_sub,
            rendered_html=rendered_html,
        )
    )


@router.post(
    "/{template_id}/send-test",
    response_model=ResponseEnvelope[dict],
    dependencies=[Depends(require_permission("system_settings", "edit"))],
)
async def send_test_email(
    template_id: UUID,
    req: EmailTemplateTestSendRequest,
    db: AsyncSession = Depends(get_db),
):
    template = await email_template_service.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Email template not found")

    recipient = req.recipient_email or "deepak.gupta@mile.education"
    subject_raw = req.subject or template.subject
    html_raw = req.html_content or template.html_content

    context = req.context_data or {
        "full_name": "Deepak Gupta",
        "student_name": "Deepak Gupta",
        "faculty_name": "Prof. Deepak Gupta",
        "recipient_name": "Deepak Gupta",
        "prn_number": "26PGDM001",
        "otp": "749201",
        "expiry_minutes": "10",
        "program_name": "PGDM - Post Graduate Diploma in Management",
        "batch_name": "PGDM Batch 2026-2028",
        "division_name": "Division A",
        "subject_name": "Marketing Strategy & Operations",
        "session_date": "15 Sep 2026",
        "session_time": "10:00 AM - 12:00 PM",
        "room_no": "Auditorium Hall 2",
        "attendance_percentage": "68",
        "threshold_percentage": "75",
        "sessions_attended": "17",
        "total_sessions": "25",
        "title": "Upcoming Campus Industry Lecture",
        "message": "We are pleased to invite you to our upcoming executive leadership seminar.",
        "action_url": "https://orion.mile.education/dashboard",
        "action_button_text": "View Session Details",
        "rejection_reason": "Graduation marks statement attachment is unverified or incomplete.",
        "login_url": "https://orion.mile.education/login",
        "app_name": "Orion Portal",
        "support_email": "deepak.gupta@mile.education",
    }

    rendered_sub = email_template_service.render_placeholders(subject_raw, context)
    rendered_html = email_template_service.render_placeholders(html_raw, context)

    success = send_custom_html_email(
        to_email=recipient,
        subject=f"[TEST PREVIEW] {rendered_sub}",
        html_content=rendered_html,
    )

    if not success:
        raise HTTPException(
            status_code=500,
            detail="Failed to dispatch test email. Check server logs or Hostinger API configuration.",
        )

    return ResponseEnvelope(
        data={
            "message": f"Test email successfully dispatched to {recipient}",
            "recipient": recipient,
            "subject": f"[TEST PREVIEW] {rendered_sub}",
        }
    )


@router.post(
    "/ai-generate",
    response_model=ResponseEnvelope[EmailTemplateAIGenerateResponse],
    dependencies=[Depends(require_permission("system_settings", "edit"))],
)
async def ai_generate_template(req: EmailTemplateAIGenerateRequest):
    """
    Synthesizes a modern, responsive HTML email template using AI prompt and attached files.
    """
    try:
        generated = await generate_email_template_with_ai(req)
        return ResponseEnvelope(data=generated)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI template generation failed: {str(e)}")

