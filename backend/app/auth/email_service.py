# app/auth/email_service.py

import smtplib
import secrets
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone, timedelta
from app.core.config import settings

TOKEN_EXPIRY_HOURS = 24
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def generate_verification_token() -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    return token, expires


def send_verification_email(to_email: str, token: str):
    verify_link = f"{settings.frontend_url}/verify-email?token={token}"

    html_body = f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Welcome to ArchBench</h2>
            <p>Click the link below to verify your email address. This link expires in {TOKEN_EXPIRY_HOURS} hours.</p>
            <a href="{verify_link}" style="display:inline-block; background:#2952A3; color:white; padding:10px 20px; border-radius:4px; text-decoration:none; margin-top:12px;">
                Verify Email
            </a>
            <p style="color:#888; font-size:12px; margin-top:24px;">If you didn't sign up for ArchBench, you can ignore this email.</p>
        </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Verify your ArchBench account"
    msg["From"] = settings.gmail_address
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(settings.gmail_address, settings.gmail_app_password)
        server.sendmail(settings.gmail_address, to_email, msg.as_string())