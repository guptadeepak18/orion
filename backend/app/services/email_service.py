"""
Email service for Orion.
Supports:
1. HTTP REST API email delivery via Resend, Brevo, or SendGrid (HTTPS Port 443 — never blocked on Render).
2. Direct SMTP over IPv4 with fallback between SSL (465) and STARTTLS (587).
3. Console logging fallback for development or when outbound SMTP ports are blocked by host firewalls.
"""
import logging
import random
import smtplib
import socket
import ssl
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _connect_ipv4(host: str, port: int, timeout: float = 4.0) -> socket.socket:
    """Connect strictly over IPv4 to avoid [Errno 101] Network is unreachable on IPv6-disabled cloud hosts like Render."""
    last_err = None
    for res in socket.getaddrinfo(host, port, socket.AF_INET, socket.SOCK_STREAM):
        af, socktype, proto, canonname, sa = res
        sock = None
        try:
            sock = socket.socket(af, socktype, proto)
            sock.settimeout(timeout)
            sock.connect(sa)
            return sock
        except Exception as err:
            last_err = err
            if sock is not None:
                try:
                    sock.close()
                except Exception:
                    pass
    raise OSError(f"Could not connect to {host}:{port} over IPv4: {last_err}")


class IPv4SMTP_SSL(smtplib.SMTP_SSL):
    """SMTP_SSL subclass that forces IPv4 routing."""
    def _get_socket(self, host, port, timeout):
        raw_sock = _connect_ipv4(host, port, timeout)
        if self.context is None:
            self.context = ssl.create_default_context()
        return self.context.wrap_socket(raw_sock, server_hostname=host)


class IPv4SMTP(smtplib.SMTP):
    """SMTP subclass that forces IPv4 routing."""
    def _get_socket(self, host, port, timeout):
        return _connect_ipv4(host, port, timeout)


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _build_otp_email_html(full_name: str, otp: str, app_name: str = "Orion") -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f0f4f8; margin: 0; padding: 0; }}
    .container {{ max-width: 520px; margin: 40px auto; background: #fff; border-radius: 16px;
                  box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }}
    .header {{ background: linear-gradient(135deg, #0e7490 0%, #0891b2 100%); padding: 28px 32px; }}
    .header h1 {{ color: #fff; margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.5px; }}
    .header p {{ color: #a5f3fc; margin: 4px 0 0; font-size: 13px; }}
    .body {{ padding: 36px 40px; }}
    .body p {{ color: #374151; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }}
    .otp-box {{ background: #f0fdff; border: 2px dashed #06b6d4; border-radius: 12px;
               padding: 24px; text-align: center; margin: 24px 0; }}
    .otp-box .otp {{ font-size: 42px; font-weight: 800; letter-spacing: 12px;
                     color: #0e7490; font-family: 'Courier New', monospace; }}
    .otp-box .expiry {{ font-size: 13px; color: #6b7280; margin-top: 8px; }}
    .footer {{ background: #f9fafb; padding: 20px 40px; border-top: 1px solid #e5e7eb;
               font-size: 12px; color: #9ca3af; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <tr>
          <td style="vertical-align: middle; text-align: left;">
            <h1>{app_name}</h1>
            <p>Student Registration Portal</p>
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
    <div class="body">
      <p>Hello <strong>{full_name}</strong>,</p>
      <p>Thank you for registering on <strong>{app_name}</strong>. Please use the verification code below to confirm your email address:</p>
      <div class="otp-box">
        <div class="otp">{otp}</div>
        <div class="expiry">This code expires in <strong>10 minutes</strong></div>
      </div>
      <p>If you did not register on {app_name}, please ignore this email.</p>
      <p style="margin-top: 24px;">Warm regards,<br /><strong>Academic Operations</strong><br />Lexicon MILE</p>
    </div>
    <div class="footer">
      © 2026 Lexicon MILE · Orion Academic Portal
    </div>
  </div>
</body>
</html>
"""


def _send_via_resend(api_key: str, from_email: str, to_email: str, full_name: str, otp: str) -> bool:
    """Send transactional email via Resend HTTPS REST API (Port 443)."""
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }
    payload = {
        "from": f"Orion Portal <{from_email}>",
        "to": [to_email],
        "subject": "Orion — Verify Your Email Address",
        "html": _build_otp_email_html(full_name, otp),
        "reply_to": settings.SMTP_REPLY_TO or "deepak.gupta@mile.education",
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                logger.info(f"[Resend] Verification email sent to {to_email}")
                return True
            else:
                logger.warning(f"[Resend] API returned status {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"[Resend] Failed to send email via Resend API: {e}")
    return False


def _send_via_brevo(api_key: str, from_email: str, to_email: str, full_name: str, otp: str) -> bool:
    """Send transactional email via Brevo / Sendinblue HTTPS REST API (Port 443)."""
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": api_key.strip(),
        "Content-Type": "application/json",
    }
    payload = {
        "sender": {"name": "Orion Portal", "email": from_email},
        "to": [{"email": to_email, "name": full_name}],
        "subject": "Orion — Verify Your Email Address",
        "htmlContent": _build_otp_email_html(full_name, otp),
        "replyTo": {"email": settings.SMTP_REPLY_TO or "deepak.gupta@mile.education", "name": "Deepak Gupta"},
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                logger.info(f"[Brevo] Verification email sent to {to_email}")
                return True
            else:
                logger.warning(f"[Brevo] API returned status {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"[Brevo] Failed to send email via Brevo API: {e}")
    return False


def _send_via_sendgrid(api_key: str, from_email: str, to_email: str, full_name: str, otp: str) -> bool:
    """Send transactional email via SendGrid HTTPS REST API (Port 443)."""
    url = "https://api.sendgrid.com/v3/mail/send"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }
    payload = {
        "personalizations": [{"to": [{"email": to_email, "name": full_name}]}],
        "from": {"email": from_email, "name": "Orion Portal"},
        "reply_to": {"email": settings.SMTP_REPLY_TO or "deepak.gupta@mile.education", "name": "Deepak Gupta"},
        "subject": "Orion — Verify Your Email Address",
        "content": [{"type": "text/html", "value": _build_otp_email_html(full_name, otp)}],
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 202):
                logger.info(f"[SendGrid] Verification email sent to {to_email}")
                return True
            else:
                logger.warning(f"[SendGrid] API returned status {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"[SendGrid] Failed to send email via SendGrid API: {e}")
    return False


def _dispatch_smtp(smtp_host: str, smtp_port: int, smtp_user: str, smtp_password: str, from_email: str, to_email: str, msg: MIMEMultipart) -> None:
    """Attempt SMTP dispatch with automatic SSL / STARTTLS detection."""
    if smtp_port == 465:
        with IPv4SMTP_SSL(smtp_host, smtp_port, timeout=4) as server:
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, to_email, msg.as_string())
    else:
        with IPv4SMTP(smtp_host, smtp_port, timeout=4) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, to_email, msg.as_string())


def _send_via_hostinger_mail_api(api_key: str, to_email: str, full_name: str, otp: str) -> bool:
    """
    Send transactional verification email via Hostinger Mail API (HTTPS Port 443).
    Bypasses cloud host SMTP port blocks on Render/AWS/GCP.
    """
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }
    mailbox_id = getattr(settings, "HOSTINGER_MAILBOX_ID", "")
    if not mailbox_id:
        try:
            with httpx.Client(timeout=6.0) as client:
                me_res = client.get("https://api.mail.hostinger.com/api/v1/me", headers=headers)
                if me_res.status_code == 200:
                    mailboxes = me_res.json().get("data", {}).get("mailboxes", [])
                    if mailboxes:
                        mailbox_id = mailboxes[0].get("resourceId", "")
        except Exception as e:
            logger.warning(f"[Hostinger Mail API] Could not fetch mailbox info: {e}")

    if not mailbox_id:
        mailbox_id = "AC450fbdeffe5c83d81e26fcf45213"

    url = f"https://api.mail.hostinger.com/api/v1/mailboxes/{mailbox_id}/send"
    payload = {
        "to": [to_email],
        "subject": "Orion — Verify Your Email Address",
        "html": _build_otp_email_html(full_name, otp),
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201, 204):
                logger.info(f"[Hostinger Mail API] Verification email successfully sent to {to_email}")
                return True
            else:
                logger.warning(f"[Hostinger Mail API] Returned status {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"[Hostinger Mail API] Request failed: {e}")
    return False


def resolve_email_recipient(intended_email: str, subject: str, html_content: str) -> tuple[str, str, str]:
    """
    Direct recipient delivery:
    Delivers all email notifications directly to the user's registered profile email address.
    """
    recipient = (intended_email or "").strip()
    return recipient, subject, html_content


def _send_raw_custom_html(target_email: str, subject: str, html_content: str) -> bool:
    """Internal dispatcher across Hostinger API, Resend, and SMTP."""
    from_email = getattr(settings, "SMTP_FROM_EMAIL", "no-reply@dataxplore.club")
    reply_to = getattr(settings, "SMTP_REPLY_TO", "deepak.gupta@mile.education")

    # 1. Try Hostinger Direct Mail API
    hostinger_api_key = getattr(settings, "HOSTINGER_MAIL_API_KEY", "")
    if hostinger_api_key:
        headers = {
            "Authorization": f"Bearer {hostinger_api_key.strip()}",
            "Content-Type": "application/json",
        }
        mailbox_id = getattr(settings, "HOSTINGER_MAILBOX_ID", "AC450fbdeffe5c83d81e26fcf45213")
        url = f"https://api.mail.hostinger.com/api/v1/mailboxes/{mailbox_id}/send"
        payload = {
            "to": [target_email],
            "subject": subject,
            "html": html_content,
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201, 204):
                    logger.info(f"[Hostinger Mail API] Email successfully delivered to {target_email}")
                    return True
                else:
                    logger.warning(f"[Hostinger Mail API] Returned status {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.error(f"[Hostinger Mail API] Request failed: {e}")

    # 2. Try Resend HTTP API
    resend_key = getattr(settings, "RESEND_API_KEY", "")
    if resend_key:
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {resend_key.strip()}",
            "Content-Type": "application/json",
        }
        payload = {
            "from": f"Orion Portal <{from_email}>",
            "to": [target_email],
            "subject": subject,
            "html": html_content,
            "reply_to": reply_to,
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    logger.info(f"[Resend] Email successfully delivered to {target_email}")
                    return True
        except Exception as e:
            logger.error(f"[Resend] Request failed: {e}")

    # 3. Try Brevo HTTP API
    brevo_key = getattr(settings, "BREVO_API_KEY", "")
    if brevo_key:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": brevo_key.strip(),
            "Content-Type": "application/json",
        }
        payload = {
            "sender": {"name": "Orion Portal", "email": from_email},
            "to": [{"email": target_email}],
            "subject": subject,
            "htmlContent": html_content,
            "replyTo": {"email": reply_to, "name": "Deepak Gupta"},
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    logger.info(f"[Brevo] Email successfully delivered to {target_email}")
                    return True
        except Exception as e:
            logger.error(f"[Brevo] Request failed: {e}")

    # 4. Try SMTP fallback
    smtp_host = getattr(settings, "SMTP_HOST", "")
    smtp_user = getattr(settings, "SMTP_USER", "")
    smtp_password = getattr(settings, "SMTP_PASSWORD", "")
    smtp_port = int(getattr(settings, "SMTP_PORT", 587))

    if smtp_host and smtp_user and smtp_password:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"Orion Portal <{from_email}>"
        msg["To"] = target_email
        msg["Reply-To"] = f"Deepak Gupta <{reply_to}>"
        msg.attach(MIMEText(html_content, "html"))
        try:
            _dispatch_smtp(smtp_host, smtp_port, smtp_user, smtp_password, from_email, target_email, msg)
            logger.info(f"Email successfully sent to {target_email} via SMTP")
            return True
        except Exception as e:
            logger.warning(f"SMTP dispatch failed: {e}")

    # 5. Console output fallback
    print(f"\n{'='*70}")
    print(f"  [ORION EMAIL DISPATCH LOG]")
    print(f"  Target Recipient: {target_email}")
    print(f"  Subject:          {subject}")
    print(f"{'='*70}\n")
    return True


def send_verification_email(to_email: str, full_name: str, otp: str) -> bool:
    """
    Send OTP verification email.
    Environment-aware:
    - On local server: redirects to deepak.gupta@mile.education with [LOCAL TEST -> student] subject.
    - On production: delivers directly to to_email.
    """
    target_email, subject, html_content = resolve_email_recipient(
        intended_email=to_email,
        subject="Orion — Verify Your Email Address",
        html_content=_build_otp_email_html(full_name, otp),
    )
    return _send_raw_custom_html(target_email, subject, html_content)


def send_custom_html_email(to_email: str, subject: str, html_content: str) -> bool:
    """
    Send any custom HTML email.
    Environment-aware:
    - On local server: redirects to deepak.gupta@mile.education with [LOCAL TEST -> recipient] subject.
    - On production: delivers directly to to_email.
    """
    target_email, target_subject, target_html = resolve_email_recipient(
        intended_email=to_email,
        subject=subject,
        html_content=html_content,
    )
    return _send_raw_custom_html(target_email, target_subject, target_html)


def generate_and_send_otp(to_email: str, full_name: str) -> str:
    """Generate a 6-digit OTP, send it, and return the OTP string."""
    otp = _generate_otp(6)
    send_verification_email(to_email, full_name, otp)
    return otp
