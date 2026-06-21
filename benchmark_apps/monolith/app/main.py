import secrets
import string
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import Base, engine, get_db
from app.models import ShortUrl
from app.schemas import ShortenRequest, ShortenResponse, StatsResponse

Base.metadata.create_all(bind=engine)

app = FastAPI(title="URL Shortener — Monolith Architecture")

ALPHABET = string.ascii_letters + string.digits
CODE_LENGTH = 6
MAX_GENERATION_ATTEMPTS = 5


def generate_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))


@app.get("/health")
def health():
    return {"status": "ok", "architecture": "monolith"}


@app.post("/shorten", response_model=ShortenResponse, status_code=201)
def shorten(payload: ShortenRequest, db: Session = Depends(get_db)):
    """
    Generates a unique short code with collision-resistant retry logic.
    Relies on the DB's unique constraint as the source of truth — avoids
    a read-then-write race condition between concurrent requests.
    """
    for _ in range(MAX_GENERATION_ATTEMPTS):
        code = generate_code()
        entry = ShortUrl(code=code, original_url=str(payload.url))
        db.add(entry)
        try:
            db.commit()
            db.refresh(entry)
            return ShortenResponse(
                code=entry.code,
                short_url=f"/{entry.code}",
                original_url=entry.original_url,
            )
        except IntegrityError:
            db.rollback()
            continue  # collision — try a new code

    raise HTTPException(status_code=503, detail="Could not generate a unique code, try again")


@app.get("/{code}")
def redirect(code: str, db: Session = Depends(get_db)):
    entry = db.query(ShortUrl).filter(ShortUrl.code == code).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Short URL not found")

    entry.click_count += 1
    db.commit()

    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=entry.original_url, status_code=307)


@app.get("/stats/{code}", response_model=StatsResponse)
def stats(code: str, db: Session = Depends(get_db)):
    entry = db.query(ShortUrl).filter(ShortUrl.code == code).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Short URL not found")
    return StatsResponse(code=entry.code, original_url=entry.original_url, click_count=entry.click_count)