import re
import json
import logging
import httpx
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.schemas.email_template import EmailTemplateAIGenerateRequest, EmailTemplateAIGenerateResponse

logger = logging.getLogger(__name__)

COLOR_PRESETS = {
    "corporate": {"primary": "#0f172a", "accent": "#0284c7", "light": "#f0f9ff", "border": "#bae6fd"},
    "modern_gradient": {"primary": "#0e7490", "accent": "#06b6d4", "light": "#f0fdfa", "border": "#99f6e4"},
    "academic": {"primary": "#4338ca", "accent": "#6366f1", "light": "#f5f3ff", "border": "#ddd6fe"},
    "alert": {"primary": "#b91c1c", "accent": "#ef4444", "light": "#fef2f2", "border": "#fecaca"},
    "celebratory": {"primary": "#047857", "accent": "#10b981", "light": "#ecfdf5", "border": "#a7f3d0"},
    "gold": {"primary": "#854d0e", "accent": "#eab308", "light": "#fefce8", "border": "#fef08a"},
}


async def generate_email_template_with_ai(
    req: EmailTemplateAIGenerateRequest
) -> EmailTemplateAIGenerateResponse:
    """
    Synthesizes a responsive HTML email template from natural language prompt,
    selected theme, and optional file attachments.
    Uses Gemini LLM when configured, or a robust template synthesis engine as fallback.
    """
    prompt = req.prompt.strip()
    theme = req.style_theme or "corporate"
    palette = COLOR_PRESETS.get(theme, COLOR_PRESETS["corporate"])

    # Include file attachments text context if present
    file_context = ""
    if req.file_attachments:
        file_context = "\nAttached Reference Files:\n"
        for f in req.file_attachments:
            name = f.get("name", "Document")
            content = f.get("text_content") or f.get("description") or ""
            if content:
                file_context += f"- File '{name}': {content[:400]}...\n"

    # Attempt Gemini API if key is present
    if settings.GEMINI_API_KEY:
        try:
            gemini_result = await _call_gemini_template_generation(prompt, file_context, req.category or "General")
            if gemini_result:
                return gemini_result
        except Exception as e:
            logger.warning(f"Gemini API generation failed, falling back to synthesizer: {e}")

    # Fallback to intelligent template synthesis engine
    return _synthesize_template_heuristic(prompt, req.category or "General", theme, palette, req.file_attachments or [])


async def _call_gemini_template_generation(
    prompt: str, file_context: str, category: str
) -> Optional[EmailTemplateAIGenerateResponse]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    
    system_instruction = (
        "You are an expert HTML email designer for Orion academic and corporate campus portal. "
        "Generate a complete, mobile-responsive HTML email template with modern inline CSS styling. "
        "Use {{variable_name}} placeholders for dynamic values like {{full_name}}, {{session_date}}, {{app_name}}, etc. "
        "Return STRICT JSON only matching this schema:\n"
        "{\n"
        '  "name": "Template Title",\n'
        '  "category": "Category",\n'
        '  "event_key": "snake_case_event_key",\n'
        '  "subject": "Email Subject with {{placeholders}}",\n'
        '  "description": "Brief description",\n'
        '  "variables": ["variable_1", "variable_2"],\n'
        '  "html_content": "<!DOCTYPE html><html>...</html>"\n'
        "}"
    )

    user_query = f"Prompt: {prompt}\nCategory: {category}\n{file_context}"

    payload = {
        "contents": [{"parts": [{"text": system_instruction + "\n\n" + user_query}]}],
        "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json"}
    }

    async with httpx.AsyncClient(timeout=25.0) as client:
        res = await client.post(url, json=payload)
        if res.status_code == 200:
            data = res.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw_text)
            return EmailTemplateAIGenerateResponse(
                name=parsed.get("name", "AI Generated Template"),
                category=parsed.get("category", category),
                event_key=parsed.get("event_key", "custom_generated_template"),
                subject=parsed.get("subject", "Notification from {{app_name}}"),
                html_content=parsed.get("html_content", ""),
                variables=parsed.get("variables", ["full_name", "app_name"]),
                description=parsed.get("description", "Generated via AI prompt"),
            )
    return None


def _synthesize_template_heuristic(
    prompt: str,
    category: str,
    theme: str,
    palette: Dict[str, str],
    attachments: List[Dict[str, Any]],
) -> EmailTemplateAIGenerateResponse:
    """Intelligent responsive template generator based on keywords, style theme, and attachments."""
    # Derive name and event_key
    clean_words = re.findall(r"[a-zA-Z0-9]+", prompt)
    event_key = "_".join(clean_words[:4]).lower() or "custom_event_template"
    title = prompt[:50].title() if prompt else "Campus Announcement"

    # Identify context keywords
    p_lower = prompt.lower()
    is_placement = any(k in p_lower for k in ["placement", "job", "recruitment", "interview", "drive", "hire"])
    is_exam = any(k in p_lower for k in ["exam", "test", "marks", "grade", "assessment", "result"])
    is_event = any(k in p_lower for k in ["lecture", "seminar", "workshop", "webinar", "summit", "conference", "guest"])
    is_alert = any(k in p_lower for k in ["urgent", "warning", "deadline", "mandatory", "alert", "notice"])

    if is_placement:
        palette = COLOR_PRESETS["celebratory"]
        subject = "Placement Update: {{company_name}} — {{announcement_title}}"
        variables = ["student_name", "company_name", "job_role", "event_date", "action_url", "app_name"]
    elif is_exam:
        palette = COLOR_PRESETS["academic"]
        subject = "Academic Examination Schedule: {{subject_name}} ({{exam_date}})"
        variables = ["student_name", "subject_name", "exam_date", "exam_time", "venue", "app_name"]
    elif is_event:
        palette = COLOR_PRESETS["gold"] if "alumni" in p_lower or "summit" in p_lower else COLOR_PRESETS["modern_gradient"]
        subject = "Campus Event: {{event_title}} on {{event_date}} at {{event_time}}"
        variables = ["recipient_name", "event_title", "speaker_name", "event_date", "event_time", "venue", "app_name"]
    elif is_alert:
        palette = COLOR_PRESETS["alert"]
        subject = "Urgent Notice: {{notice_title}} (Action Required)"
        variables = ["recipient_name", "notice_title", "deadline_date", "support_email", "app_name"]
    else:
        subject = "{{title}} — Notification from {{app_name}}"
        variables = ["recipient_name", "title", "message_content", "action_url", "app_name"]

    # Generate attached files section if any
    attachment_html = ""
    if attachments:
        attachment_html = f"""
      <div style="background: {palette['light']}; border: 1px solid {palette['border']}; border-radius: 12px; padding: 18px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px; color: {palette['primary']}; font-size: 13px; font-weight: 700;">📎 Attached Documents & Resources:</h4>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 1.6;">
"""
        for a in attachments:
            name = a.get("name", "Document")
            attachment_html += f"          <li><strong>{name}</strong></li>\n"
        attachment_html += "        </ul>\n      </div>"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }}
    .card {{ max-width: 560px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.25); }}
    .header {{ background: linear-gradient(135deg, {palette['primary']} 0%, {palette['accent']} 100%); padding: 28px 32px; text-align: left; }}
    .header h1 {{ color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }}
    .header p {{ color: rgba(255,255,255,0.85); margin: 4px 0 0; font-size: 13px; font-weight: 500; }}
    .content {{ padding: 36px; }}
    .content p {{ font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }}
    .callout-box {{ background: {palette['light']}; border: 1px solid {palette['border']}; border-radius: 14px; padding: 22px; margin: 24px 0; }}
    .btn {{ display: inline-block; background: {palette['accent']}; color: #ffffff !important; padding: 12px 28px; border-radius: 12px; font-weight: 700; text-decoration: none; font-size: 14px; margin: 16px 0; box-shadow: 0 4px 14px rgba(0,0,0,0.15); }}
    .footer {{ background: #f8fafc; padding: 22px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>{title}</h1>
            <p>{{{{app_name}}}} — Campus Notification</p>
          </td>
          <td style="vertical-align: middle; text-align: right; width: 130px; padding-left: 12px;">
            <div style="display: inline-block; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 10px; padding: 7px 14px; text-align: center;">
              <span style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; font-weight: 900; letter-spacing: 1px; color: #ffffff; display: block; line-height: 1.1; text-transform: uppercase;">
                ✨ ORION
              </span>
              <span style="font-size: 8px; font-weight: 700; letter-spacing: 1.5px; color: rgba(255, 255, 255, 0.9); text-transform: uppercase; display: block; margin-top: 2px;">
                LEXICON MILE
              </span>
            </div>
          </td>
        </tr>
      </table>
    </div>
    <div class="content">
      <p>Dear <strong>{{{{{variables[0]}}}}}</strong>,</p>
      <p>{prompt}</p>
      
      <div class="callout-box">
        <div style="font-size: 14px; line-height: 1.8; color: {palette['primary']};">
          <div><strong>Activity / Purpose:</strong> {title}</div>
          <div><strong>Target Audience:</strong> Students & Faculty Members</div>
          <div><strong>Schedule & Details:</strong> Refer to attached portal instructions</div>
        </div>
      </div>
{attachment_html}
      <div style="text-align: center; margin: 28px 0 16px;">
        <a href="{{{{action_url}}}}" class="btn">View on Orion Portal →</a>
      </div>
      
      <p style="margin-top: 24px;">Warm regards,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal<br />
      If you have questions, please reach out to <a href="mailto:{{{{support_email}}}}" style="color: {palette['accent']}; text-decoration: none;">{{{{support_email}}}}</a>.
    </div>
  </div>
</body>
</html>"""

    return EmailTemplateAIGenerateResponse(
        name=title,
        category=category,
        event_key=event_key,
        subject=subject,
        html_content=html_content,
        variables=variables,
        description=f"Generated template for: {prompt[:80]}",
    )
