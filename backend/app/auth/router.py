# app/auth/router.py

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserOut, Token, ResendVerificationRequest
from app.auth.security import hash_password, verify_password, create_access_token
from app.auth.dependencies import get_current_user
from app.auth.email_service import generate_verification_token, send_verification_email

from datetime import datetime, timezone

router = APIRouter(prefix="/auth", tags=["auth"])

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = 7 * 24 * 60 * 60


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    from app.core.config import settings

    # If no Gmail credentials are configured, auto-verify so users aren't locked out.
    email_enabled = bool(settings.gmail_address and settings.gmail_app_password)

    token, expires = generate_verification_token()

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        is_verified=not email_enabled,   # auto-verify when email is disabled
        verification_token=token if email_enabled else None,
        verification_token_expires=expires if email_enabled else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if email_enabled:
        try:
            send_verification_email(user.email, token)
        except Exception as e:
            # User is created either way — log the email failure but don't crash the request.
            # In production this should trigger an alert; for now, surface a clear message.
            print(f"WARNING: failed to send verification email to {user.email}: {e}")

    return user



@router.get("/verify")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.verification_token == token).first()

    if not user:
        # Check if maybe this email was already verified (token already cleared)
        # We can't look up by token anymore, so just give a softer message
        raise HTTPException(status_code=400, detail="This verification link is invalid or has already been used")

    if user.verification_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification link has expired")

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires = None
    db.commit()

    return {"message": "Email verified successfully"}   


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest, db: Session = Depends(get_db)):
    # reuses UserLogin schema just for the email field — password ignored here
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account with that email")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    token, expires = generate_verification_token()
    user.verification_token = token
    user.verification_token_expires = expires
    db.commit()

    send_verification_email(user.email, token)
    return {"message": "Verification email resent"}


@router.post("/login")
def login(payload: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before logging in")

    access_token = create_access_token(data={"sub": str(user.id)})

    response.set_cookie(
    key=COOKIE_NAME,
    value=access_token,
    max_age=COOKIE_MAX_AGE,
    httponly=True,
    secure=True,           # changed from False — required for SameSite=None
    samesite="none",       # changed from "lax" — required for cross-site (Lovable -> your backend)
    )

    return {"message": "logged in", "user": {"id": user.id, "email": user.email}}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME)
    return {"message": "logged out"}


@router.get("/me", response_model=UserOut)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user