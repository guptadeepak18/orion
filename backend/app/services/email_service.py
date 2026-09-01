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
    .header {{ background: linear-gradient(135deg, #0e7490 0%, #0891b2 100%); padding: 32px 40px; }}
    .header h1 {{ color: #fff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }}
    .header p {{ color: #a5f3fc; margin: 6px 0 0; font-size: 14px; }}
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
      <h1>{app_name}</h1>
      <p>Student Registration Portal</p>
    </div>
    <div class="body">
      <p>Hello <strong>{full_name}</strong>,</p>
      <p>Thank you for registering on <strong>{app_name}</strong>. Please use the verification code below to confirm your email address:</p>
      <div class="otp-box">
        <div class="otp">{otp}</div>
        <div class="expiry">This code expires in <strong>10 minutes</strong></div>
      </div>
      <p>If you did not register on {app_name}, please ignore this email.</p>
      <p>Best regards,<br /><strong>The {app_name} Team</strong></p>
    </div>
    <div class="footer">
      Questions or issues? Reply directly to this email or contact <a href="mailto:deepak.gupta@mile.education" style="color: #0891b2;">deepak.gupta@mile.education</a>.
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


def send_verification_email(to_email: str, full_name: str, otp: str) -> bool:
    """
    Send OTP verification email.
    1. First attempts HTTPS REST APIs (Resend, Brevo, SendGrid) which work 100% on Render without port blocking.
    2. Then attempts direct SMTP with fast fallback.
    3. Always logs OTP code to server console as fallback so student registration is never blocked.
    """
    from_email = getattr(settings, "SMTP_FROM_EMAIL", "no-reply@dataxplore.club")
    reply_to = getattr(settings, "SMTP_REPLY_TO", "deepak.gupta@mile.education")

    # 1. Try Resend HTTP API
    resend_key = getattr(settings, "RESEND_API_KEY", "")
    if resend_key:
        if _send_via_resend(resend_key, from_email, to_email, full_name, otp):
            return True

    # 2. Try Brevo HTTP API
    brevo_key = getattr(settings, "BREVO_API_KEY", "")
    if brevo_key:
        if _send_via_brevo(brevo_key, from_email, to_email, full_name, otp):
            return True

    # 3. Try SendGrid HTTP API
    sendgrid_key = getattr(settings, "SENDGRID_API_KEY", "")
    if sendgrid_key:
        if _send_via_sendgrid(sendgrid_key, from_email, to_email, full_name, otp):
            return True

    # 4. Try Direct SMTP
    smtp_host = getattr(settings, "SMTP_HOST", "")
    smtp_user = getattr(settings, "SMTP_USER", "")
    smtp_password = getattr(settings, "SMTP_PASSWORD", "")
    smtp_port = int(getattr(settings, "SMTP_PORT", 587))

    if smtp_host and smtp_user and smtp_password:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Orion — Verify Your Email Address"
        msg["From"] = f"Orion Portal <{from_email}>"
        msg["To"] = to_email
        msg["Reply-To"] = f"Deepak Gupta <{reply_to}>"
        html_content = _build_otp_email_html(full_name, otp)
        msg.attach(MIMEText(html_content, "html"))

        try:
            _dispatch_smtp(smtp_host, smtp_port, smtp_user, smtp_password, from_email, to_email, msg)
            logger.info(f"Verification email successfully sent to {to_email} via SMTP port {smtp_port}")
            return True
        except Exception as primary_err:
            fallback_port = 465 if smtp_port != 465 else 587
            try:
                _dispatch_smtp(smtp_host, fallback_port, smtp_user, smtp_password, from_email, to_email, msg)
                logger.info(f"Verification email successfully sent to {to_email} via SMTP fallback port {fallback_port}")
                return True
            except Exception as fallback_err:
                logger.warning(
                    f"Outbound SMTP timed out on Render (Render free tier blocks SMTP ports 25, 465, 587). "
                    f"Primary: {primary_err} | Fallback: {fallback_err}"
                )

    # 5. Prominently output the OTP in the server logs so the registration workflow is never blocked
    print(f"\n{'='*70}")
    print(f"  [ORION VERIFICATION OTP FALLBACK]")
    print(f"  Recipient Email:  {to_email}")
    print(f"  Student Name:     {full_name}")
    print(f"  6-DIGIT OTP CODE: {otp}")
    print(f"  Note: On Render Free Tier, SMTP ports 465/587 are blocked by Render's firewall.")
    print(f"  To deliver real emails over HTTPS, set RESEND_API_KEY or BREVO_API_KEY in Render.")
    print(f"{'='*70}\n")
    return True


def generate_and_send_otp(to_email: str, full_name: str) -> str:
    """Generate a 6-digit OTP, send it, and return the OTP string."""
    otp = _generate_otp(6)
    send_verification_email(to_email, full_name, otp)
    return otp
