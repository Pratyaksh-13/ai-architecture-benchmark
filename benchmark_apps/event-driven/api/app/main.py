import secrets
import string
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi.responses import RedirectResponse

from app.database import Base, engine, get_db
from app.models import ShortUrl
from app.schemas import ShortenRequest, ShortenResponse, StatsResponse
from app.events import publish_click_event

Base.metadata.create_all(bind=engine)

from prometheus_fastapi_instrumentator import Instrumentator
app = FastAPI(title="URL Shortener — Event-Driven")
Instrumentator().instrument(app).expose(app)
from prometheus_fastapi_instrumentator import Instrumentator

Instrumentator().instrument(app).expose(app)

ALPHABET = string.ascii_letters + string.digits
CODE_LENGTH = 6
MAX_GENERATION_ATTEMPTS = 5


def generate_code() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))


@app.get("/health")
def health():
    return {"status": "ok", "architecture": "event-driven"}


@app.post("/shorten", response_model=ShortenResponse, status_code=201)
def shorten(payload: ShortenRequest, db: Session = Depends(get_db)):
    for _ in range(MAX_GENERATION_ATTEMPTS):
        code = generate_code()
        entry = ShortUrl(code=code, original_url=str(payload.url))
        db.add(entry)
        try:
            db.commit()
            db.refresh(entry)
            return ShortenResponse(code=entry.code, short_url=f"/{entry.code}", original_url=entry.original_url)
        except IntegrityError:
            db.rollback()
            continue

    raise HTTPException(status_code=503, detail="Could not generate a unique code, try again")


@app.get("/{code}")
def redirect(code: str, db: Session = Depends(get_db)):
    """
    Looks up the URL synchronously (the redirect itself can't be async —
    the browser is waiting), but click tracking is fire-and-forget via Redis.
    This is the actual latency advantage event-driven should show: the
    response doesn't wait on a database write for the click count.
    """
    entry = db.query(ShortUrl).filter(ShortUrl.code == code).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Short URL not found")

    publish_click_event(code)  # non-blocking, worker handles the DB write later

    return RedirectResponse(url=entry.original_url, status_code=307)


@app.get("/stats/{code}", response_model=StatsResponse)
def stats(code: str, db: Session = Depends(get_db)):
    entry = db.query(ShortUrl).filter(ShortUrl.code == code).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Short URL not found")
    return StatsResponse(code=entry.code, original_url=entry.original_url, click_count=entry.click_count)
