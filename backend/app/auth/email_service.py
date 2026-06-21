# app/auth/email_service.py

import resend
import secrets
from datetime import datetime, timezone, timedelta
from app.core.config import settings

resend.api_key = settings.resend_api_key

TOKEN_EXPIRY_HOURS = 24


def generate_verification_token() -> tuple[str, datetime]:
    """Returns (token, expiry_datetime)."""
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRY_HOURS)
    return token, expires


def send_verification_email(to_email: str, token: str):
    verify_link = f"{settings.frontend_url}/verify-email?token={token}"

    resend.Emails.send({
        "from": "ArchBench <onboarding@resend.dev>",  # Resend's default sandbox sender
        "to": [to_email],
        "subject": "Verify your ArchBench account",
        "html": f"""
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Welcome to ArchBench</h2>
                <p>Click the link below to verify your email address. This link expires in {TOKEN_EXPIRY_HOURS} hours.</p>
                <a href="{verify_link}" style="display:inline-block; background:#7c3aed; color:white; padding:10px 20px; border-radius:8px; text-decoration:none; margin-top:12px;">
                    Verify Email
                </a>
                <p style="color:#888; font-size:12px; margin-top:24px;">If you didn't sign up for ArchBench, you can ignore this email.</p>
            </div>
        """,
    })