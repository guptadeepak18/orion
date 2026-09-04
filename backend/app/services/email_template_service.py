import re
import logging
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.email_template import EmailTemplate
from app.schemas.email_template import EmailTemplateCreate, EmailTemplateUpdate
from app.services.email_service import send_custom_html_email

logger = logging.getLogger(__name__)

# Pre-defined System Default Templates for All Platform Activities
DEFAULT_TEMPLATES: List[Dict[str, Any]] = [
    {
        "event_key": "student_registration_otp",
        "name": "Student Self-Registration Verification OTP",
        "category": "Authentication & Onboarding",
        "description": "Sent to students during self-registration to verify their @mile.education email address with a 6-digit OTP code.",
        "subject": "Orion — Verify Your Email Address (Code: {{otp}})",
        "variables": ["full_name", "otp", "expiry_minutes", "prn_number", "app_name", "support_email"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #0e7490 0%, #06b6d4 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .header p { color: #cffafe; margin: 4px 0 0; font-size: 13px; font-weight: 500; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .otp-wrapper { background: #f0fdfa; border: 2px dashed #0d9488; border-radius: 14px; padding: 24px; text-align: center; margin: 28px 0; }
    .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0f766e; font-family: 'Courier New', monospace; }
    .otp-note { font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>Student Portal Verification</h1>
            <p>{{app_name}} — Account Onboarding</p>
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
      <p>Dear <strong>{{full_name}}</strong>,</p>
      <p>Thank you for initiating your registration on <strong>{{app_name}}</strong> (PRN: <code>{{prn_number}}</code>). Please use the verification code below to verify your student email address:</p>
      
      <div class="otp-wrapper">
        <div class="otp-code">{{otp}}</div>
        <div class="otp-note">Valid for {{expiry_minutes}} minutes. Do not share this code with anyone.</div>
      </div>
      
      <p>If you did not submit this request, please disregard this email or contact support at <a href="mailto:{{support_email}}" style="color: #0891b2;">{{support_email}}</a>.</p>
      <p style="margin-top: 24px;">Warm regards,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "password_reset_otp",
        "name": "Password Reset & Security Verification Code",
        "category": "Authentication & Onboarding",
        "description": "Sent to users when requesting a password reset from the login page or updating password in profile.",
        "subject": "Orion — Password Reset Verification Code ({{otp}})",
        "variables": ["full_name", "otp", "expiry_minutes", "app_name", "support_email"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #0284c7 0%, #38bdf8 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .header p { color: #e0f2fe; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .otp-wrapper { background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 14px; padding: 24px; text-align: center; margin: 28px 0; }
    .otp-code { font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #0369a1; font-family: 'Courier New', monospace; }
    .otp-note { font-size: 12px; color: #64748b; margin-top: 8px; font-weight: 500; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>Password Reset Request 🔐</h1>
            <p>{{app_name}} — Account Security</p>
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
      <p>Dear <strong>{{full_name}}</strong>,</p>
      <p>We received a request to update your <strong>{{app_name}}</strong> account password. Please enter the 6-digit verification code below to authorize this change:</p>
      
      <div class="otp-wrapper">
        <div class="otp-code">{{otp}}</div>
        <div class="otp-note">Valid for {{expiry_minutes}} minutes. Never share this code with anyone.</div>
      </div>
      
      <p>If you did not request a password change, please disregard this email or report to <a href="mailto:{{support_email}}" style="color: #0284c7;">{{support_email}}</a> immediately.</p>
      <p style="margin-top: 24px;">Warm regards,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "student_registration_approved",
        "name": "Student Registration Approved & Enrolled",
        "category": "Student Lifecycle",
        "description": "Sent automatically when an Administrator approves a student's registration and assigns their academic program.",
        "subject": "Welcome to Orion — Your Registration has been Approved! (PRN: {{prn_number}})",
        "variables": ["full_name", "prn_number", "program_name", "batch_name", "division_name", "login_url", "app_name", "support_email"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .header p { color: #d1fae5; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .badge-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .btn { display: inline-block; background: #059669; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px; margin: 16px 0; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>Application Approved 🎉</h1>
            <p>{{app_name}} — Student Portal</p>
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
      <p>Congratulations <strong>{{full_name}}</strong>,</p>
      <p>Your student profile application has been verified and approved by the academic administration. You are now officially enrolled in:</p>
      
      <div class="badge-box">
        <div style="font-size: 13px; line-height: 1.8;">
          <div><strong>Program:</strong> {{program_name}}</div>
          <div><strong>Batch:</strong> {{batch_name}}</div>
          <div><strong>Division / Section:</strong> {{division_name}}</div>
          <div><strong>PRN:</strong> <code>{{prn_number}}</code></div>
        </div>
      </div>
      
      <p>You can now sign in to access your course LMS, lecture timetable, case study library, and attendance tracking:</p>
      <div style="text-align: center;">
        <a href="{{login_url}}" class="btn">Sign In to Orion Portal →</a>
      </div>
      <p style="margin-top: 24px;">Welcome aboard,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "student_registration_rejected",
        "name": "Student Registration Application Rejected",
        "category": "Student Lifecycle",
        "description": "Sent when an Administrator rejects a registration application with an explanation or guidance on re-applying.",
        "subject": "Update on your Orion Registration Application (PRN: {{prn_number}})",
        "variables": ["full_name", "prn_number", "rejection_reason", "support_email", "app_name"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #e11d48 0%, #f43f5e 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .header p { color: #ffe4e6; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .reason-box { background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 18px; margin: 20px 0; color: #9f1239; font-size: 14px; line-height: 1.5; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>Application Status Update</h1>
            <p>{{app_name}} — Student Portal</p>
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
      <p>Dear <strong>{{full_name}}</strong>,</p>
      <p>Thank you for submitting your student registration for PRN <code>{{prn_number}}</code>. After administrative review, we could not approve your application at this time for the following reason:</p>
      
      <div class="reason-box">
        <strong>Review Remarks:</strong><br />
        {{rejection_reason}}
      </div>
      
      <p>If you believe this is an error or have updated credentials to provide, please contact the academic coordinator at <a href="mailto:{{support_email}}" style="color: #e11d48;">{{support_email}}</a>.</p>
      <p style="margin-top: 24px;">Sincerely,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "class_session_scheduled",
        "name": "New Lecture & Class Timetable Scheduled",
        "category": "Academic & Schedule",
        "description": "Sent to enrolled students and faculty when a new class or session is scheduled.",
        "subject": "Class Scheduled: {{subject_name}} on {{session_date}} at {{session_time}} (Venue: {{venue}})",
        "variables": ["recipient_name", "subject_name", "faculty_name", "session_date", "session_time", "venue", "batch_name", "division_name", "app_name"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .header p { color: #e0e7ff; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .session-card { background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 14px; padding: 20px; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>Class Session Scheduled 📅</h1>
            <p>{{app_name}} — Timetable Update</p>
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
      <p>Hello <strong>{{recipient_name}}</strong>,</p>
      <p>A new academic lecture has been scheduled on your timetable:</p>
      
      <div class="session-card">
        <div style="font-size: 14px; line-height: 1.8; color: #312e81;">
          <div><strong>Subject:</strong> {{subject_name}}</div>
          <div><strong>Faculty:</strong> {{faculty_name}}</div>
          <div><strong>Date:</strong> {{session_date}}</div>
          <div><strong>Time:</strong> {{session_time}}</div>
          <div><strong>Venue / Hall:</strong> {{venue}}</div>
          <div><strong>Batch / Div:</strong> {{batch_name}} {{division_name}}</div>
        </div>
      </div>
      
      <p>Please ensure you arrive at the designated venue on time. Attendance will be recorded digitally.</p>
      <p style="margin-top: 24px;">Warm regards,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "class_session_cancelled",
        "name": "Class / Session Cancelled or Rescheduled",
        "category": "Academic & Schedule",
        "description": "Sent when a lecture session or exam slot is cancelled or rescheduled.",
        "subject": "Notice: Class Cancelled / Rescheduled — {{subject_name}} ({{session_date}})",
        "variables": ["recipient_name", "subject_name", "faculty_name", "session_date", "reason", "app_name"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .header p { color: #fee2e2; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .alert-card { background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 20px; margin: 20px 0; color: #991b1b; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>Class Session Cancelled ⚠️</h1>
            <p>{{app_name}} — Timetable Notification</p>
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
      <p>Dear <strong>{{recipient_name}}</strong>,</p>
      <p>Please note that the following lecture session has been cancelled or rescheduled:</p>
      
      <div class="alert-card">
        <div><strong>Subject:</strong> {{subject_name}}</div>
        <div><strong>Faculty:</strong> {{faculty_name}}</div>
        <div><strong>Date:</strong> {{session_date}}</div>
        <div style="margin-top: 8px;"><strong>Reason / Notes:</strong> {{reason}}</div>
      </div>
      
      <p>Please check your student portal timetable for the rescheduled makeup slot.</p>
      <p style="margin-top: 24px;">Sincerely,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "student_daily_attendance_absent",
        "name": "Daily Lecture Absence Notification",
        "category": "Academic & Attendance",
        "description": "Sent to a student when they are marked absent for a lecture session.",
        "subject": "Absence Notification: Marked Absent in {{subject_name}} on {{session_date}}",
        "variables": ["student_name", "subject_name", "session_date", "session_time", "faculty_name", "app_name", "support_email"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .header p { color: #ffedd5; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .absent-card { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 14px; padding: 20px; margin: 20px 0; color: #9a3412; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>Lecture Absence Notice</h1>
            <p>{{app_name}} — Attendance Record</p>
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
      <p>Dear <strong>{{student_name}}</strong>,</p>
      <p>You have been recorded as <strong>Absent</strong> for the following class session:</p>
      
      <div class="absent-card">
        <div><strong>Subject:</strong> {{subject_name}}</div>
        <div><strong>Date:</strong> {{session_date}}</div>
        <div><strong>Time:</strong> {{session_time}}</div>
        <div><strong>Faculty:</strong> {{faculty_name}}</div>
      </div>
      
      <p>If you were present or have an official approved on-duty/medical leave, please submit an Attendance Correction Request through your student portal within 48 hours.</p>
      <p style="margin-top: 24px;">Sincerely,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "student_attendance_warning",
        "name": "Low Attendance Warning Alert (< 75%)",
        "category": "Academic & Attendance",
        "description": "Triggered when a student's cumulative subject attendance falls below the compliance threshold (75%).",
        "subject": "Attendance Alert: {{attendance_percentage}}% in {{subject_name}} (Below Threshold)",
        "variables": ["student_name", "subject_name", "attendance_percentage", "threshold_percentage", "sessions_attended", "total_sessions", "app_name", "support_email"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #d97706 0%, #f59e0b 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .header p { color: #fef3c7; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .alert-card { background: #fffbeb; border: 1px solid #fde68a; border-radius: 14px; padding: 20px; margin: 20px 0; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>Attendance Compliance Alert ⚠️</h1>
            <p>{{app_name}} — Academic Operations</p>
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
      <p>Dear <strong>{{student_name}}</strong>,</p>
      <p>Your attendance for <strong>{{subject_name}}</strong> has fallen below the mandatory requirement of <strong>{{threshold_percentage}}%</strong>:</p>
      
      <div class="alert-card">
        <div style="font-size: 14px; line-height: 1.8; color: #92400e;">
          <div><strong>Current Attendance:</strong> <span style="font-size: 18px; font-weight: 800; color: #b45309;">{{attendance_percentage}}%</span></div>
          <div><strong>Sessions Attended:</strong> {{sessions_attended}} / {{total_sessions}} conducted</div>
          <div><strong>Required Minimum:</strong> {{threshold_percentage}}%</div>
        </div>
      </div>
      
      <p>Consistent attendance is mandatory for examination eligibility. Please consult your faculty mentor immediately to regularize pending classes.</p>
      <p style="margin-top: 24px;">Sincerely,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "academic_material_uploaded",
        "name": "New Study Material & Notes Uploaded",
        "category": "Academic & LMS",
        "description": "Sent to students when faculty or coordinators upload lecture presentations, unit notes, or reading cases.",
        "subject": "New Material: {{material_title}} uploaded for {{subject_name}}",
        "variables": ["student_name", "subject_name", "material_title", "faculty_name", "download_url", "app_name"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .header p { color: #f3e8ff; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .material-card { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 14px; padding: 20px; margin: 20px 0; color: #581c87; }
    .btn { display: inline-block; background: #7c3aed; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px; margin: 16px 0; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>New Study Material 📚</h1>
            <p>{{app_name}} — Course LMS</p>
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
      <p>Hello <strong>{{student_name}}</strong>,</p>
      <p>New academic study materials have been uploaded to your course LMS:</p>
      
      <div class="material-card">
        <div><strong>Subject:</strong> {{subject_name}}</div>
        <div><strong>Title / Unit:</strong> {{material_title}}</div>
        <div><strong>Uploaded by:</strong> {{faculty_name}}</div>
      </div>
      
      <div style="text-align: center;">
        <a href="{{download_url}}" class="btn">View & Download Material →</a>
      </div>
      
      <p style="margin-top: 24px;">Happy Learning,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "crc_placement_drive_announced",
        "name": "Campus Placement & Internship Drive Announcement",
        "category": "Corporate Relations & Placement",
        "description": "Sent to eligible students when Corporate Relations publishes a new campus recruitment drive or internship opening.",
        "subject": "Placement Alert: {{company_name}} is hiring for {{job_role}} (CTC: {{ctc_stipend}})",
        "variables": ["student_name", "company_name", "job_role", "ctc_stipend", "eligibility_criteria", "deadline_date", "apply_url", "app_name"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .header p { color: #ccfbf1; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .drive-card { background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 14px; padding: 20px; margin: 20px 0; color: #115e59; }
    .btn { display: inline-block; background: #0d9488; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px; margin: 16px 0; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>Recruitment Drive Announcement 💼</h1>
            <p>{{app_name}} — Corporate Relations</p>
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
      <p>Dear <strong>{{student_name}}</strong>,</p>
      <p>Corporate Relations is pleased to announce a new campus recruitment drive:</p>
      
      <div class="drive-card">
        <div style="font-size: 14px; line-height: 1.8;">
          <div><strong>Company:</strong> <span style="font-size: 16px; font-weight: 800;">{{company_name}}</span></div>
          <div><strong>Role / Profile:</strong> {{job_role}}</div>
          <div><strong>CTC / Compensation:</strong> {{ctc_stipend}}</div>
          <div><strong>Eligibility:</strong> {{eligibility_criteria}}</div>
          <div><strong>Application Deadline:</strong> <span style="color: #0f766e; font-weight: 700;">{{deadline_date}}</span></div>
        </div>
      </div>
      
      <p>Review the detailed job description and submit your updated resume before the deadline:</p>
      <div style="text-align: center;">
        <a href="{{apply_url}}" class="btn">Apply on Placement Portal →</a>
      </div>
      
      <p style="margin-top: 24px;">Best wishes,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "crc_application_shortlisted",
        "name": "Candidate Shortlisted for Interview Round",
        "category": "Corporate Relations & Placement",
        "description": "Sent to a student when they are shortlisted by a visiting recruiter for an interview or test round.",
        "subject": "Congratulations! Shortlisted for {{company_name}} (Round: {{round_name}})",
        "variables": ["student_name", "company_name", "job_role", "round_name", "interview_date", "interview_venue", "app_name"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #15803d 0%, #22c55e 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .header p { color: #dcfce7; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .shortlist-card { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 20px; margin: 20px 0; color: #166534; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>Shortlisted for Interview 🌟</h1>
            <p>{{app_name}} — Corporate Relations</p>
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
      <p>Congratulations <strong>{{student_name}}</strong>,</p>
      <p>You have been shortlisted for the next round of selection with <strong>{{company_name}}</strong>:</p>
      
      <div class="shortlist-card">
        <div style="font-size: 14px; line-height: 1.8;">
          <div><strong>Company:</strong> {{company_name}}</div>
          <div><strong>Role:</strong> {{job_role}}</div>
          <div><strong>Selection Round:</strong> {{round_name}}</div>
          <div><strong>Schedule:</strong> {{interview_date}}</div>
          <div><strong>Venue / Link:</strong> {{interview_venue}}</div>
        </div>
      </div>
      
      <p>Please ensure you dress in formal corporate attire and carry printed copies of your resume and portfolio.</p>
      <p style="margin-top: 24px;">All the best,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "general_announcement",
        "name": "General Campus Broadcast & Notification",
        "category": "Custom & Broadcast",
        "description": "General purpose template for administrative announcements, policy updates, or campus alerts.",
        "subject": "{{title}} — Orion Portal Announcement",
        "variables": ["recipient_name", "title", "message", "action_url", "action_button_text", "app_name"],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; margin: 0; padding: 20px; color: #334155; }
    .card { max-width: 540px; margin: 20px auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
    .header { background: linear-gradient(135deg, #0e7490 0%, #0284c7 100%); padding: 28px 32px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; }
    .header p { color: #bae6fd; margin: 4px 0 0; font-size: 13px; }
    .content { padding: 36px; }
    .content p { font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px; }
    .btn { display: inline-block; background: #0284c7; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; font-weight: 700; text-decoration: none; font-size: 14px; margin: 16px 0; }
    .footer { background: #f8fafc; padding: 20px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>{{title}}</h1>
            <p>{{app_name}} Announcement</p>
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
      <p>Hello <strong>{{recipient_name}}</strong>,</p>
      <div style="font-size: 15px; line-height: 1.7; color: #334155; margin: 16px 0;">
        {{message}}
      </div>
      
      <div style="text-align: center; margin: 24px 0;">
        <a href="{{action_url}}" class="btn">{{action_button_text}}</a>
      </div>
      
      <p style="margin-top: 24px;">Best regards,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>""",
    },
    {
        "event_key": "academic_event_scheduled",
        "name": "Academic Event & Milestone Scheduled Announcement",
        "category": "Academic Operations & Calendar",
        "description": "Sent to students when an academic event, workshop, conclave, guest lecture, or celebration is scheduled.",
        "subject": "Orion — Academic Event: {{event_title}} ({{event_date}})",
        "variables": [
            "full_name",
            "event_title",
            "event_category",
            "event_date",
            "event_time",
            "venue",
            "mode",
            "is_mandatory",
            "badge_bg",
            "badge_color",
            "badge_border",
            "speaker_guest_details",
            "description_html",
            "organizer_name",
            "poster_section",
            "registration_btn",
            "app_name",
            "support_email",
        ],
        "is_active": True,
        "is_system": True,
        "html_content": """<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{event_title}}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
  <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center">
        <div style="max-width: 600px; width: 100%; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1);">
          
          <!-- BRAND HEADER -->
          <div style="background: linear-gradient(135deg, #312e81 0%, #4338ca 40%, #6366f1 75%, #06b6d4 100%); padding: 32px 36px 28px;">
            <table width="100%" border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align: middle;">
                  <div style="display: inline-block; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); padding: 4px 12px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.35); margin-bottom: 10px;">
                    <span style="color: #ffffff; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
                      📢 ACADEMIC ANNOUNCEMENT
                    </span>
                  </div>
                  <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; line-height: 1.2;">
                    Campus Event Scheduled
                  </h1>
                  <p style="color: #e0e7ff; margin: 6px 0 0; font-size: 13px; font-weight: 500;">
                    Lexicon MILE — Academic Operations &amp; Student Life
                  </p>
                </td>
                <td style="vertical-align: middle; text-align: right; width: 130px;">
                  <div style="display: inline-block; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.3); border-radius: 12px; padding: 8px 14px; text-align: center;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; font-weight: 900; letter-spacing: 1.5px; color: #ffffff; display: block; line-height: 1;">
                      ✨ ORION
                    </span>
                    <span style="font-size: 8.5px; font-weight: 800; letter-spacing: 1.8px; color: rgba(255, 255, 255, 0.9); text-transform: uppercase; display: block; margin-top: 3px;">
                      LEXICON MILE
                    </span>
                  </div>
                </td>
              </tr>
            </table>
          </div>

          <!-- BODY CONTENT -->
          <div style="padding: 36px 36px 28px;">
            <p style="font-size: 15px; line-height: 1.6; color: #1e293b; margin: 0 0 20px;">
              Dear <strong>{{full_name}}</strong>,
            </p>
            <p style="font-size: 14.5px; line-height: 1.6; color: #475569; margin: 0 0 24px;">
              A new institutional event has been officially scheduled on the academic calendar. Please find the program schedule, venue, and participation details below:
            </p>

            <!-- EVENT HIGHLIGHT CARD -->
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 18px; padding: 24px; margin-bottom: 24px;">
              
              <!-- CATEGORY & MANDATORY TAGS -->
              <div style="margin-bottom: 14px;">
                <span style="display: inline-block; padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; margin-right: 8px;">
                  {{event_category}}
                </span>
                <span style="display: inline-block; padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background: {{badge_bg}}; color: {{badge_color}}; border: 1px solid {{badge_border}};">
                  {{is_mandatory}}
                </span>
              </div>

              <!-- EVENT TITLE -->
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 900; color: #0f172a; line-height: 1.35;">
                {{event_title}}
              </h2>

              <!-- DETAILS TABLE -->
              <table width="100%" border="0" cellpadding="0" cellspacing="0" style="font-size: 13.5px; border-collapse: separate; border-spacing: 0 8px;">
                <tr>
                  <td width="120" style="color: #64748b; font-weight: 700; vertical-align: top;">
                    📅 Date:
                  </td>
                  <td style="color: #0f172a; font-weight: 700; vertical-align: top;">
                    {{event_date}}
                  </td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 700; vertical-align: top;">
                    ⏰ Time:
                  </td>
                  <td style="color: #0f172a; font-weight: 700; vertical-align: top;">
                    {{event_time}}
                  </td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 700; vertical-align: top;">
                    📍 Venue:
                  </td>
                  <td style="color: #0f172a; font-weight: 700; vertical-align: top;">
                    {{venue}} <span style="display: inline-block; font-size: 11px; font-weight: 700; background: #e2e8f0; color: #334155; padding: 2px 7px; border-radius: 5px; margin-left: 6px; text-transform: uppercase;">{{mode}}</span>
                  </td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 700; vertical-align: top;">
                    🏛 Organizer:
                  </td>
                  <td style="color: #0f172a; font-weight: 600; vertical-align: top;">
                    {{organizer_name}}
                  </td>
                </tr>
                <tr>
                  <td style="color: #64748b; font-weight: 700; vertical-align: top;">
                    🎤 Guest / Speaker:
                  </td>
                  <td style="color: #4338ca; font-weight: 700; vertical-align: top;">
                    {{speaker_guest_details}}
                  </td>
                </tr>
              </table>

              <!-- DESCRIPTION CALLOUT -->
              <div style="margin-top: 18px; padding: 16px 18px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 13.5px; line-height: 1.7; color: #334155;">
                {{description_html}}
              </div>

            </div>

            <!-- PROMOTIONAL CREATIVE POSTER (IF ATTACHED) -->
            {{poster_section}}

            <!-- ACTION BUTTONS -->
            <div style="text-align: center; margin: 30px 0 10px;">
              <a href="https://orion.mile.education/sessions?view=calendar" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff !important; padding: 13px 32px; border-radius: 12px; font-weight: 800; text-decoration: none; font-size: 13.5px; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.35); margin: 6px 4px;">
                View in Orion Academic Calendar →
              </a>
              {{registration_btn}}
            </div>

            <!-- ADVISORY / GUIDELINES -->
            <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12.5px; line-height: 1.6; color: #64748b;">
              <p style="margin: 0 0 8px;">
                📌 <strong>Academic Notice:</strong> All students are requested to report punctually and follow campus dress code and discipline guidelines during institutional events.
              </p>
              <p style="margin: 0;">
                For queries or support, reach out to Academic Operations at <a href="mailto:{{support_email}}" style="color: #4f46e5; text-decoration: none; font-weight: 600;">{{support_email}}</a>.
              </p>
            </div>

            <!-- SIGN-OFF -->
            <div style="margin-top: 24px; font-size: 13.5px; line-height: 1.5; color: #1e293b;">
              Warm regards,<br />
              <strong>Academic Operations &amp; Student Welfare</strong><br />
              <span style="color: #64748b; font-size: 12.5px;">Lexicon Management Institute of Leadership &amp; Excellence (MILE)</span>
            </div>

          </div>

          <!-- FOOTER -->
          <div style="background: #f8fafc; padding: 22px 36px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
            <p style="margin: 0 0 4px; font-weight: 600; color: #64748b;">
              Lexicon MILE · Orion Academic Management Platform
            </p>
            <p style="margin: 0;">
              Gate No. 726, Pune-Nagar Road, Wagholi, Pune, Maharashtra 412207
            </p>
          </div>

        </div>
      </td>
    </tr>
  </table>
</body>
</html>""",
    },
]

def render_placeholders(template_str: str, context: Dict[str, Any]) -> str:
    """Replaces {{variable_name}} placeholders with string values from context."""
    if not template_str:
        return ""
    
    def replacer(match):
        var_name = match.group(1).strip()
        val = context.get(var_name)
        if val is None:
            return match.group(0)  # leave unreplaced if not in context
        return str(val)

    return re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", replacer, template_str)


async def seed_default_templates(db: AsyncSession) -> None:
    """Ensure all default system templates exist in database."""
    for item in DEFAULT_TEMPLATES:
        res = await db.execute(
            select(EmailTemplate).where(EmailTemplate.event_key == item["event_key"])
        )
        existing = res.scalar_one_or_none()
        if not existing:
            tmpl = EmailTemplate(
                event_key=item["event_key"],
                name=item["name"],
                category=item["category"],
                description=item["description"],
                subject=item["subject"],
                html_content=item["html_content"],
                variables=item["variables"],
                is_active=item["is_active"],
                is_system=item["is_system"],
            )
            db.add(tmpl)
        else:
            # Update description / variables / html_content if system default
            if existing.is_system:
                existing.name = item["name"]
                existing.category = item["category"]
                existing.description = item["description"]
                existing.subject = item["subject"]
                existing.html_content = item["html_content"]
                existing.variables = item["variables"]
    await db.commit()


async def list_templates(
    db: AsyncSession,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> List[EmailTemplate]:
    # Make sure defaults are synced
    await seed_default_templates(db)
    stmt = select(EmailTemplate).order_by(EmailTemplate.category, EmailTemplate.name)
    if category:
        stmt = stmt.where(EmailTemplate.category == category)
    if is_active is not None:
        stmt = stmt.where(EmailTemplate.is_active == is_active)
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def get_template(db: AsyncSession, template_id: UUID) -> Optional[EmailTemplate]:
    res = await db.execute(select(EmailTemplate).where(EmailTemplate.id == template_id))
    return res.scalar_one_or_none()


async def get_template_by_event(db: AsyncSession, event_key: str) -> Optional[EmailTemplate]:
    res = await db.execute(select(EmailTemplate).where(EmailTemplate.event_key == event_key))
    return res.scalar_one_or_none()


async def create_template(db: AsyncSession, data: EmailTemplateCreate) -> EmailTemplate:
    existing = await get_template_by_event(db, data.event_key)
    if existing:
        raise ValueError(f"A template with event key '{data.event_key}' already exists.")

    tmpl = EmailTemplate(
        event_key=data.event_key,
        name=data.name,
        category=data.category,
        description=data.description,
        subject=data.subject,
        html_content=data.html_content,
        plain_text_content=data.plain_text_content,
        variables=data.variables or [],
        is_active=data.is_active,
        is_system=False,
    )
    db.add(tmpl)
    await db.commit()
    await db.refresh(tmpl)
    return tmpl


async def update_template(
    db: AsyncSession, template_id: UUID, data: EmailTemplateUpdate
) -> EmailTemplate:
    tmpl = await get_template(db, template_id)
    if not tmpl:
        raise ValueError("Email template not found.")

    update_dict = data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(tmpl, field, value)

    await db.commit()
    await db.refresh(tmpl)
    return tmpl


async def delete_template(db: AsyncSession, template_id: UUID) -> None:
    tmpl = await get_template(db, template_id)
    if not tmpl:
        raise ValueError("Email template not found.")
    if tmpl.is_system:
        raise ValueError("Core system templates cannot be deleted. You can deactivate them instead.")

    await db.delete(tmpl)
    await db.commit()


async def reset_to_default(db: AsyncSession, template_id: UUID) -> EmailTemplate:
    tmpl = await get_template(db, template_id)
    if not tmpl:
        raise ValueError("Email template not found.")

    default_match = next((t for t in DEFAULT_TEMPLATES if t["event_key"] == tmpl.event_key), None)
    if not default_match:
        raise ValueError(f"No default template found for event '{tmpl.event_key}'.")

    tmpl.name = default_match["name"]
    tmpl.category = default_match["category"]
    tmpl.description = default_match["description"]
    tmpl.subject = default_match["subject"]
    tmpl.html_content = default_match["html_content"]
    tmpl.variables = default_match["variables"]
    tmpl.is_active = default_match["is_active"]

    await db.commit()
    await db.refresh(tmpl)
    return tmpl


async def render_email(
    db: AsyncSession,
    event_key: str,
    context: Dict[str, Any],
    fallback_subject: str,
    fallback_html: str,
) -> Tuple[str, str, bool]:
    """
    Renders email subject and HTML using database template if active.
    Returns (rendered_subject, rendered_html, is_active).
    """
    tmpl = await get_template_by_event(db, event_key)
    if tmpl:
        if not tmpl.is_active:
            logger.info(f"Email trigger '{event_key}' is deactivated. Skipping send.")
            return "", "", False
        rendered_subject = render_placeholders(tmpl.subject, context)
        rendered_html = render_placeholders(tmpl.html_content, context)
        return rendered_subject, rendered_html, True
    
    # Check DEFAULT_TEMPLATES in memory if template has not yet been seeded to DB
    for d in DEFAULT_TEMPLATES:
        if d["event_key"] == event_key:
            if not d.get("is_active", True):
                return "", "", False
            rendered_subject = render_placeholders(d["subject"], context)
            rendered_html = render_placeholders(d["html_content"], context)
            return rendered_subject, rendered_html, True

    # Fallback to defaults
    rendered_subject = render_placeholders(fallback_subject, context)
    rendered_html = render_placeholders(fallback_html, context)
    return rendered_subject, rendered_html, True


async def trigger_activity_email(
    db: AsyncSession,
    event_key: str,
    recipient_email: str,
    context: Dict[str, Any],
    fallback_subject: str = "Orion Notification",
    fallback_html: str = "<div>Orion Notification</div>",
) -> bool:
    """
    High-level trigger helper: renders active database template for `event_key`
    and dispatches via Hostinger Mail API.
    """
    try:
        # Guarantee app_name and default support email exist in context
        if "app_name" not in context:
            context["app_name"] = "Orion Portal"
        if "support_email" not in context:
            context["support_email"] = "deepak.gupta@mile.education"

        sub, html, active = await render_email(
            db, event_key, context, fallback_subject, fallback_html
        )
        if not active or not html:
            logger.info(f"Activity email '{event_key}' skipped because template is disabled.")
            return False

        logger.info(f"Dispatching activity email '{event_key}' to {recipient_email} (Subject: {sub})")
        import asyncio
        await asyncio.to_thread(send_custom_html_email, recipient_email, sub, html)
        return True
    except Exception as e:
        logger.error(f"Failed to dispatch activity email '{event_key}' to {recipient_email}: {e}")
        return False
