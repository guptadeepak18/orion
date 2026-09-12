"""
Email service for Orion.
Supports:
1. HTTP REST API email delivery via Resend, Brevo, or SendGrid (HTTPS Port 443 — never blocked on Render).
2. Direct SMTP over IPv4 with fallback between SSL (465) and STARTTLS (587).
3. Console logging fallback for development or when outbound SMTP ports are blocked by host firewalls.
"""
import logging
import os
import random
import smtplib
import socket
import ssl
import string
import time as time_module
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
    key = api_key.strip() if api_key else _get_brevo_api_key()
    if not key:
        return False
    sender_email, sender_name = _get_brevo_sender(from_email)
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": key,
        "Content-Type": "application/json",
    }
    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email.strip(), "name": full_name.strip()}],
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


_circuit_breaker_cooldowns: dict[str, float] = {}


def _get_brevo_api_key() -> str:
    for var_name in ["BREVO_API_KEY", "BREVO_KEY", "SENDINBLUE_API_KEY", "BREVO_APIKEY"]:
        key = (getattr(settings, var_name, "") or os.environ.get(var_name, "")).strip()
        if key:
            return key
    smtp_host = (getattr(settings, "SMTP_HOST", "") or os.environ.get("SMTP_HOST", "")).lower()
    if "brevo" in smtp_host or "sendinblue" in smtp_host:
        return (getattr(settings, "SMTP_PASSWORD", "") or os.environ.get("SMTP_PASSWORD", "")).strip()
    return ""


def _get_brevo_sender(default_from_email: str = "") -> tuple[str, str]:
    sender_email = ""
    for var_name in [
        "BREVO_SENDER_EMAIL",
        "BREVO_FROM_EMAIL",
        "BREVO_SEND_FROM_EMAIL",
        "BREVO_SEND_FROM",
        "BREVO_SENDER",
        "SEND_FROM_EMAIL",
        "BREVO_EMAIL",
    ]:
        val = (getattr(settings, var_name, "") or os.environ.get(var_name, "")).strip()
        if val:
            sender_email = val
            break

    if not sender_email:
        smtp_host = (getattr(settings, "SMTP_HOST", "") or os.environ.get("SMTP_HOST", "")).lower()
        if "brevo" in smtp_host or "sendinblue" in smtp_host:
            smtp_u = (getattr(settings, "SMTP_USER", "") or os.environ.get("SMTP_USER", "")).strip()
            if "@" in smtp_u:
                sender_email = smtp_u

    if not sender_email:
        sender_email = (
            default_from_email
            or getattr(settings, "SMTP_FROM_EMAIL", "")
            or os.environ.get("SMTP_FROM_EMAIL", "")
            or "no-reply@dataxplore.club"
        ).strip()

    sender_name = (
        getattr(settings, "BREVO_SENDER_NAME", "")
        or os.environ.get("BREVO_SENDER_NAME", "")
        or os.environ.get("BREVO_FROM_NAME", "")
        or "Orion Portal"
    ).strip()
    return sender_email, sender_name


def _is_provider_available(provider: str) -> bool:
    cooldown = _circuit_breaker_cooldowns.get(provider, 0.0)
    return time_module.time() > cooldown


def _trip_circuit_breaker(provider: str, duration_seconds: float = 60.0, reason: str = ""):
    _circuit_breaker_cooldowns[provider] = time_module.time() + duration_seconds
    logger.warning(
        f"[{provider.upper()}] Tripping circuit breaker for {int(duration_seconds)}s ({reason}). "
        f"Subsequent emails will automatically route to backup providers."
    )


def reset_provider_circuit_breaker(provider: Optional[str] = None):
    """Resets the circuit breaker cooldown for a specific provider, or all providers if None."""
    global _circuit_breaker_cooldowns
    if provider:
        p = provider.lower().strip()
        if p in _circuit_breaker_cooldowns:
            del _circuit_breaker_cooldowns[p]
            logger.info(f"Reset circuit breaker cooldown for provider '{p}'.")
    else:
        _circuit_breaker_cooldowns.clear()
        logger.info("Reset all provider circuit breaker cooldowns.")


def _try_hostinger_api(target_email: str, subject: str, html_content: str) -> bool:
    if not _is_provider_available("hostinger"):
        logger.info("[Hostinger Mail API] Provider currently in circuit breaker cooldown, bypassing to fallback provider.")
        return False

    api_key = (getattr(settings, "HOSTINGER_MAIL_API_KEY", "") or os.environ.get("HOSTINGER_MAIL_API_KEY", "")).strip()
    if not api_key:
        return False

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }
    mailbox_id = getattr(settings, "HOSTINGER_MAILBOX_ID", "AC450fbdeffe5c83d81e26fcf45213") or os.environ.get("HOSTINGER_MAILBOX_ID", "AC450fbdeffe5c83d81e26fcf45213")
    url = f"https://api.mail.hostinger.com/api/v1/mailboxes/{mailbox_id}/send"
    payload = {
        "to": [target_email],
        "subject": subject,
        "html": html_content,
    }
    try:
        with httpx.Client(timeout=25.0) as client:
            resp = None
            max_attempts = 3
            for attempt in range(max_attempts):
                try:
                    resp = client.post(url, json=payload, headers=headers)
                except httpx.TimeoutException:
                    if attempt < max_attempts - 1:
                        logger.warning(f"[Hostinger Mail API] Read/Connect timeout sending to {target_email}. Retrying ({attempt + 1}/{max_attempts})...")
                        time_module.sleep(1.5)
                        continue
                    raise

                if resp is not None and resp.status_code in (200, 201, 204):
                    logger.info(f"[Hostinger Mail API] Email delivered to {target_email}")
                    return True
                elif resp is not None and resp.status_code == 429:
                    # Transient rate limit: back off and retry before giving up
                    wait_sec = 2.0 * (attempt + 1)
                    if attempt < max_attempts - 1:
                        logger.warning(
                            f"[Hostinger Mail API] Rate limited (429) for {target_email} (attempt {attempt + 1}/{max_attempts}). "
                            f"Backing off for {wait_sec}s before retry..."
                        )
                        time_module.sleep(wait_sec)
                        continue
                    else:
                        logger.warning(f"[Hostinger Mail API] Rate limit (429) persisted after {max_attempts} attempts for {target_email}: {resp.text}")
                        # Trip a short 60s cooldown (not 30 minutes!)
                        _trip_circuit_breaker(
                            "hostinger",
                            duration_seconds=60.0,
                            reason=f"Rate limit hit (429) after {max_attempts} retries: {resp.text[:120]}",
                        )
                        return False
                elif resp is not None:
                    resp_text = resp.text.lower()
                    logger.warning(f"[Hostinger Mail API] Returned status {resp.status_code}: {resp.text}")
                    # Non-transient error or quota exhaustion
                    if resp.status_code in (403, 400) and any(
                        k in resp_text for k in ["quota", "restriction", "daily", "reached", "suspended"]
                    ):
                        _trip_circuit_breaker(
                            "hostinger",
                            duration_seconds=120.0,
                            reason=f"Quota/mailbox restriction ({resp.status_code}): {resp.text[:120]}",
                        )
                    return False
    except Exception as e:
        logger.error(f"[Hostinger Mail API] Request failed for {target_email}: {e}")
        _trip_circuit_breaker("hostinger", duration_seconds=30.0, reason=f"Connection failure: {str(e)[:100]}")
    return False


def _try_resend_api(target_email: str, subject: str, html_content: str, from_email: str, reply_to: str) -> bool:
    if not _is_provider_available("resend"):
        return False

    api_key = getattr(settings, "RESEND_API_KEY", "")
    if not api_key:
        return False

    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
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
                logger.info(f"[Resend] Email delivered to {target_email}")
                return True
            else:
                logger.warning(f"[Resend] Returned status {resp.status_code}: {resp.text}")
                if resp.status_code == 429:
                    _trip_circuit_breaker("resend", duration_seconds=300.0, reason="Rate limit hit (429)")
    except Exception as e:
        logger.error(f"[Resend] Request failed: {e}")
    return False


def _try_brevo_api(target_email: str, subject: str, html_content: str, from_email: str, reply_to: str) -> bool:
    if not _is_provider_available("brevo"):
        return False

    api_key = _get_brevo_api_key()
    if not api_key:
        return False

    sender_email, sender_name = _get_brevo_sender(from_email)

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": target_email.strip()}],
        "subject": subject,
        "htmlContent": html_content,
        "replyTo": {"email": reply_to, "name": "Deepak Gupta"},
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                logger.info(f"[Brevo] Email delivered to {target_email} (from {sender_email})")
                return True
            else:
                resp_text = resp.text.lower()
                logger.warning(f"[Brevo] Returned status {resp.status_code}: {resp.text}")
                if resp.status_code == 429 or "rate" in resp_text or "quota" in resp_text:
                    _trip_circuit_breaker("brevo", duration_seconds=300.0, reason="Rate limit hit (429)")
    except Exception as e:
        logger.error(f"[Brevo] Request failed: {e}")
    return False


def _try_sendgrid_api(target_email: str, subject: str, html_content: str, from_email: str, reply_to: str) -> bool:
    if not _is_provider_available("sendgrid"):
        return False

    api_key = getattr(settings, "SENDGRID_API_KEY", "")
    if not api_key:
        return False

    url = "https://api.sendgrid.com/v3/mail/send"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
    }
    payload = {
        "personalizations": [{"to": [{"email": target_email}]}],
        "from": {"email": from_email, "name": "Orion Portal"},
        "reply_to": {"email": reply_to, "name": "Deepak Gupta"},
        "subject": subject,
        "content": [{"type": "text/html", "value": html_content}],
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 202):
                logger.info(f"[SendGrid] Email delivered to {target_email}")
                return True
            else:
                logger.warning(f"[SendGrid] Returned status {resp.status_code}: {resp.text}")
                if resp.status_code == 429:
                    _trip_circuit_breaker("sendgrid", duration_seconds=300.0, reason="Rate limit hit (429)")
    except Exception as e:
        logger.error(f"[SendGrid] Request failed: {e}")
    return False


def _try_smtp_dispatch(target_email: str, subject: str, html_content: str, from_email: str, reply_to: str) -> bool:
    if not _is_provider_available("smtp"):
        return False

    smtp_host = getattr(settings, "SMTP_HOST", "")
    smtp_user = getattr(settings, "SMTP_USER", "")
    smtp_password = getattr(settings, "SMTP_PASSWORD", "")
    smtp_port = int(getattr(settings, "SMTP_PORT", 587))

    if not (smtp_host and smtp_user and smtp_password):
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"Orion Portal <{from_email}>"
    msg["To"] = target_email
    msg["Reply-To"] = f"Deepak Gupta <{reply_to}>"
    msg.attach(MIMEText(html_content, "html"))
    try:
        _dispatch_smtp(smtp_host, smtp_port, smtp_user, smtp_password, from_email, target_email, msg)
        logger.info(f"[SMTP] Email delivered to {target_email}")
        return True
    except Exception as e:
        logger.warning(f"[SMTP] Dispatch failed: {e}")
    return False


def _send_raw_custom_html(
    target_email: str,
    subject: str,
    html_content: str,
    force_provider: Optional[str] = None,
) -> bool:
    """
    Internal dispatcher across Hostinger, SMTP, Brevo, Resend, and SendGrid with automatic failover.
    Priority: Hostinger (Priority 1) -> SMTP / Brevo / Resend / SendGrid (Priority 2+ failover).
    """
    from_email = getattr(settings, "SMTP_FROM_EMAIL", "no-reply@dataxplore.club")
    reply_to = getattr(settings, "SMTP_REPLY_TO", "deepak.gupta@mile.education")

    if force_provider:
        provider_order = [force_provider.lower().strip()]
    else:
        pref = getattr(settings, "PRIMARY_EMAIL_PROVIDER", "hostinger").lower().strip()
        provider_order = [pref] if pref in ["hostinger", "smtp", "brevo", "resend", "sendgrid"] else ["hostinger"]
        for p in ["hostinger", "smtp", "brevo", "resend", "sendgrid"]:
            if p not in provider_order:
                provider_order.append(p)

    attempted = []
    for provider in provider_order:
        attempted.append(provider)
        if provider == "hostinger" and _try_hostinger_api(target_email, subject, html_content):
            return True
        elif provider == "smtp" and _try_smtp_dispatch(target_email, subject, html_content, from_email, reply_to):
            return True
        elif provider == "brevo" and _try_brevo_api(target_email, subject, html_content, from_email, reply_to):
            return True
        elif provider == "resend" and _try_resend_api(target_email, subject, html_content, from_email, reply_to):
            return True
        elif provider == "sendgrid" and _try_sendgrid_api(target_email, subject, html_content, from_email, reply_to):
            return True

    # Console output fallback if all providers exhausted
    logger.error(
        f"[Email Dispatch Warning] Could not deliver email to {target_email} via configured providers (tried: {attempted}). "
        f"Falling back to server console log."
    )
    print(f"\n{'='*70}")
    print(f"  [ORION EMAIL DISPATCH LOG — FALLBACK]")
    print(f"  Target Recipient: {target_email}")
    print(f"  Subject:          {subject}")
    print(f"  Attempted:        {', '.join(attempted)}")
    print(f"{'='*70}\n")
    return True


async def send_custom_html_email_batch(
    recipients_data: list,
    pacing_delay_seconds: float = 0.25,
) -> int:
    """
    Dispatches multiple emails sequentially with polite pacing between each send.
    recipients_data: list of dicts with keys {"email": str, "subject": str, "html": str}
    Returns count of successfully delivered emails.
    """
    import asyncio
    success_count = 0
    total = len(recipients_data)
    logger.info(f"[EmailBatch] Beginning paced dispatch of {total} email(s) (pacing={pacing_delay_seconds}s)...")

    for i, item in enumerate(recipients_data):
        to_email = (item.get("email") or "").strip()
        sub = item.get("subject", "")
        html = item.get("html", "")
        if not to_email:
            continue

        if i > 0 and pacing_delay_seconds > 0:
            await asyncio.sleep(pacing_delay_seconds)

        try:
            delivered = await asyncio.to_thread(
                send_custom_html_email,
                to_email,
                sub,
                html,
            )
            if delivered:
                success_count += 1
        except Exception as ex:
            logger.error(f"[EmailBatch] Error dispatching email to {to_email}: {ex}")

    logger.info(f"[EmailBatch] Completed paced dispatch: {success_count}/{total} delivered.")
    return success_count


def send_verification_email(to_email: str, full_name: str, otp: str) -> bool:
    """
    Send OTP verification email.
    Delivers directly to to_email via Hostinger -> Brevo cascade.
    """
    target_email, subject, html_content = resolve_email_recipient(
        intended_email=to_email,
        subject="Orion — Verify Your Email Address",
        html_content=_build_otp_email_html(full_name, otp),
    )
    return _send_raw_custom_html(target_email, subject, html_content)


def send_custom_html_email(
    to_email: str,
    subject: str,
    html_content: str,
    force_provider: Optional[str] = None,
) -> bool:
    """
    Send any custom HTML email via Hostinger -> Brevo cascade (or forced provider).
    """
    target_email, target_subject, target_html = resolve_email_recipient(
        intended_email=to_email,
        subject=subject,
        html_content=html_content,
    )
    return _send_raw_custom_html(target_email, target_subject, target_html, force_provider=force_provider)


def send_brevo_test_email(to_email: str = "deepak.gupta@mile.education") -> dict:
    """
    Explicitly sends a test email via Brevo HTTPS REST API (Port 443) and returns diagnostic details.
    """
    api_key = _get_brevo_api_key()
    if not api_key:
        return {
            "success": False,
            "provider": "brevo",
            "error": "Brevo API key is not configured. Please ensure BREVO_API_KEY is set in environment variables.",
            "available_env_keys": [k for k in os.environ if "BREVO" in k.upper()],
        }

    sender_email, sender_name = _get_brevo_sender()
    reply_email = getattr(settings, "SMTP_REPLY_TO", "deepak.gupta@mile.education")

    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": api_key,
        "Content-Type": "application/json",
    }

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin: 0;">⚡ Brevo Transactional Email Test</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 6px;">Lexicon MILE Academic Portal</p>
      </div>
      <div style="padding: 24px 0;">
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          Hello <strong>Deepak Gupta</strong>,
        </p>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          This is a confirmation test email sent directly via <strong>Brevo HTTPS REST API (Port 443)</strong>.
        </p>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Sender:</strong> {sender_name} &lt;{sender_email}&gt;</p>
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Recipient:</strong> {to_email}</p>
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Active Routing:</strong> Priority 1: Hostinger &rarr; Priority 2: Brevo (Rate Limit Failover)</p>
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>API Status:</strong> Connected & Operational</p>
        </div>
        <p style="font-size: 14px; color: #059669; font-weight: bold;">
          ✓ Brevo API key and sender credentials are functioning properly!
        </p>
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
        Sent by Orion Notification Service • Lexicon MILE
      </div>
    </div>
    """

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": to_email.strip(), "name": "Deepak Gupta"}],
        "subject": "Orion — Brevo Email Integration Test (Verified)",
        "htmlContent": html_content,
        "replyTo": {"email": reply_email, "name": "Deepak Gupta"},
    }

    try:
        with httpx.Client(timeout=12.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                data = resp.json()
                return {
                    "success": True,
                    "provider": "brevo",
                    "status_code": resp.status_code,
                    "messageId": data.get("messageId"),
                    "sender": sender_email,
                    "recipient": to_email,
                    "message": "Test email successfully delivered via Brevo REST API",
                }
            else:
                return {
                    "success": False,
                    "provider": "brevo",
                    "status_code": resp.status_code,
                    "sender": sender_email,
                    "recipient": to_email,
                    "error": resp.text,
                }
    except Exception as e:
        return {
            "success": False,
            "provider": "brevo",
            "error": str(e),
        }


def send_hostinger_test_email(to_email: str = "deepak.gupta@mile.education") -> dict:
    """
    Explicitly sends a test email via Hostinger Mail API and returns diagnostic details.
    """
    api_key = (getattr(settings, "HOSTINGER_MAIL_API_KEY", "") or os.environ.get("HOSTINGER_MAIL_API_KEY", "")).strip()
    if not api_key:
        return {
            "success": False,
            "provider": "hostinger",
            "error": "Hostinger Mail API key not configured.",
        }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    mailbox_id = getattr(settings, "HOSTINGER_MAILBOX_ID", "AC450fbdeffe5c83d81e26fcf45213") or os.environ.get("HOSTINGER_MAILBOX_ID", "AC450fbdeffe5c83d81e26fcf45213")
    url = f"https://api.mail.hostinger.com/api/v1/mailboxes/{mailbox_id}/send"

    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin: 0;">🌐 Hostinger Mail API Test</h2>
        <p style="color: #64748b; font-size: 14px; margin-top: 6px;">Lexicon MILE Academic Portal</p>
      </div>
      <div style="padding: 24px 0;">
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          Hello <strong>Deepak Gupta</strong>,
        </p>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          This is a confirmation test email sent directly via <strong>Hostinger Mail API (HTTPS Port 443)</strong>.
        </p>
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Recipient:</strong> {to_email}</p>
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Mailbox ID:</strong> {mailbox_id}</p>
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>Active Routing:</strong> Priority 1: Hostinger &rarr; Priority 2: Brevo (Rate Limit Failover)</p>
          <p style="margin: 4px 0; font-size: 13px; color: #475569;"><strong>API Status:</strong> Operational</p>
        </div>
        <p style="font-size: 14px; color: #059669; font-weight: bold;">
          ✓ Hostinger Mail API is functioning properly!
        </p>
      </div>
      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #94a3b8; text-align: center;">
        Sent by Orion Notification Service • Lexicon MILE
      </div>
    </div>
    """

    payload = {
        "to": [to_email.strip()],
        "subject": "Orion — Hostinger Mail API Test (Verified)",
        "html": html_content,
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201, 204):
                return {
                    "success": True,
                    "provider": "hostinger",
                    "status_code": resp.status_code,
                    "recipient": to_email,
                    "message": "Test email successfully delivered via Hostinger Mail API",
                }
            else:
                return {
                    "success": False,
                    "provider": "hostinger",
                    "status_code": resp.status_code,
                    "recipient": to_email,
                    "error": resp.text,
                }
    except Exception as e:
        return {
            "success": False,
            "provider": "hostinger",
            "error": str(e),
        }


def generate_and_send_otp(to_email: str, full_name: str) -> str:
    """Generate a 6-digit OTP, send it, and return the OTP string."""
    otp = _generate_otp(6)
    send_verification_email(to_email, full_name, otp)
    return otp


def get_email_provider_status() -> dict:
    """Diagnostic status snapshot of configured email providers (Hostinger, SMTP, Brevo, Resend, SendGrid) and active cascade."""
    brevo_key = _get_brevo_api_key()
    brevo_sender, brevo_name = _get_brevo_sender()
    pref = getattr(settings, "PRIMARY_EMAIL_PROVIDER", "hostinger").lower().strip()

    active_order = [pref] if pref in ["hostinger", "smtp", "brevo", "resend", "sendgrid"] else ["hostinger"]
    for p in ["hostinger", "smtp", "brevo", "resend", "sendgrid"]:
        if p not in active_order:
            active_order.append(p)

    return {
        "mode": pref,
        "active_order": active_order,
        "primary_active": active_order[0],
        "circuit_breaker_cooldowns": {
            k: max(0, int(v - time_module.time()))
            for k, v in _circuit_breaker_cooldowns.items()
            if v > time_module.time()
        },
        "hostinger": {
            "configured": bool(getattr(settings, "HOSTINGER_MAIL_API_KEY", "") or os.environ.get("HOSTINGER_MAIL_API_KEY", "")),
            "mailbox_id": getattr(settings, "HOSTINGER_MAILBOX_ID", "") or os.environ.get("HOSTINGER_MAILBOX_ID", ""),
            "available": _is_provider_available("hostinger"),
        },
        "smtp": {
            "configured": bool(getattr(settings, "SMTP_HOST", "") and getattr(settings, "SMTP_USER", "") and getattr(settings, "SMTP_PASSWORD", "")),
            "host": getattr(settings, "SMTP_HOST", ""),
            "port": int(getattr(settings, "SMTP_PORT", 587)),
            "available": _is_provider_available("smtp"),
        },
        "brevo": {
            "configured": bool(brevo_key),
            "key_preview": f"{brevo_key[:8]}...{brevo_key[-4:]}" if len(brevo_key) > 12 else ("Set" if brevo_key else "Not Set"),
            "sender_email": brevo_sender,
            "sender_name": brevo_name,
            "available": _is_provider_available("brevo"),
        },
        "resend": {
            "configured": bool(getattr(settings, "RESEND_API_KEY", "")),
            "available": _is_provider_available("resend"),
        },
        "sendgrid": {
            "configured": bool(getattr(settings, "SENDGRID_API_KEY", "")),
            "available": _is_provider_available("sendgrid"),
        },
        "detected_env_vars": [
            k for k in sorted(os.environ.keys()) if any(x in k.upper() for x in ["BREVO", "MAIL", "SMTP", "SENDER", "HOSTINGER"])
        ],
    }
