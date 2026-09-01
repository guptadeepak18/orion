"""
Email service for Orion.
Uses SMTP configured via environment variables.
Falls back to console logging if SMTP is not configured (dev mode).
Enforces IPv4 socket connection to avoid [Errno 101] Network is unreachable on Render/cloud hosts.
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

from app.core.config import settings

logger = logging.getLogger(__name__)


def _connect_ipv4(host: str, port: int, timeout: float = 15.0) -> socket.socket:
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


def _dispatch_smtp(smtp_host: str, smtp_port: int, smtp_user: str, smtp_password: str, from_email: str, to_email: str, msg: MIMEMultipart) -> None:
    """Attempt SMTP dispatch with automatic SSL / STARTTLS detection."""
    if smtp_port == 465:
        with IPv4SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, to_email, msg.as_string())
    else:
        with IPv4SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, to_email, msg.as_string())


def send_verification_email(to_email: str, full_name: str, otp: str) -> bool:
    """
    Send OTP verification email. Returns True on success.
    Falls back to console log if SMTP is not configured.
    """
    smtp_host = getattr(settings, "SMTP_HOST", None)
    smtp_user = getattr(settings, "SMTP_USER", None)
    smtp_password = getattr(settings, "SMTP_PASSWORD", None)
    smtp_port = int(getattr(settings, "SMTP_PORT", 587))
    from_email = getattr(settings, "SMTP_FROM_EMAIL", smtp_user or "no-reply@dataxplore.club")
    reply_to = getattr(settings, "SMTP_REPLY_TO", "deepak.gupta@mile.education")

    if not smtp_host or not smtp_user:
        # Dev mode fallback — log prominently to console
        logger.warning(
            f"[EMAIL - DEV MODE] To: {to_email} | OTP: {otp} | "
            "Configure SMTP_HOST, SMTP_USER, SMTP_PASSWORD in .env or Render Environment Variables to send real emails."
        )
        print(f"\n{'='*60}")
        print(f"  EMAIL VERIFICATION OTP (dev mode — SMTP not configured)")
        print(f"  To:       {to_email}")
        print(f"  Name:     {full_name}")
        print(f"  OTP:      {otp}")
        print(f"  From:     {from_email}")
        print(f"  Reply-To: {reply_to}")
        print(f"{'='*60}\n")
        return True

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Orion — Verify Your Email Address"
    msg["From"] = f"Orion Portal <{from_email}>"
    msg["To"] = to_email
    msg["Reply-To"] = f"Deepak Gupta <{reply_to}>"

    html_content = _build_otp_email_html(full_name, otp)
    msg.attach(MIMEText(html_content, "html"))

    try:
        _dispatch_smtp(smtp_host, smtp_port, smtp_user, smtp_password, from_email, to_email, msg)
        logger.info(f"Verification email successfully sent to {to_email} via port {smtp_port}")
        return True
    except Exception as primary_err:
        logger.warning(f"Primary SMTP dispatch on port {smtp_port} failed: {primary_err}. Attempting fallback port...")
        # Fallback between 465 and 587
        fallback_port = 465 if smtp_port != 465 else 587
        try:
            _dispatch_smtp(smtp_host, fallback_port, smtp_user, smtp_password, from_email, to_email, msg)
            logger.info(f"Verification email successfully sent to {to_email} via fallback port {fallback_port}")
            return True
        except Exception as fallback_err:
            logger.error(f"Failed to send verification email to {to_email} (Primary: {primary_err} | Fallback: {fallback_err})")
            # Always log the OTP code to server console so registration flow is never blocked
            print(f"\n{'='*60}")
            print(f"  EMAIL SEND FAILED — FALLBACK OTP:")
            print(f"  To:  {to_email}")
            print(f"  OTP: {otp}")
            print(f"{'='*60}\n")
            return False


def generate_and_send_otp(to_email: str, full_name: str) -> str:
    """Generate a 6-digit OTP, send it, and return the OTP string."""
    otp = _generate_otp(6)
    send_verification_email(to_email, full_name, otp)
    return otp
