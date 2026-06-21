import os
import json
import time
import redis
from sqlalchemy import create_engine, Column, Integer, String, DateTime, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/urlshortener")
CLICK_QUEUE = "click_events"

Base = declarative_base()

class ShortUrl(Base):
    __tablename__ = "short_urls"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(10), unique=True, index=True, nullable=False)
    original_url = Column(String(2048), nullable=False)
    click_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

redis_client = redis.from_url(REDIS_URL, decode_responses=True)


def process_click(code: str):
    db = SessionLocal()
    try:
        entry = db.query(ShortUrl).filter(ShortUrl.code == code).first()
        if entry:
            entry.click_count += 1
            db.commit()
    finally:
        db.close()


def main():
    print("Worker started, waiting for click events...")
    while True:
        # BLPOP blocks until an item is available — no busy-waiting/polling
        result = redis_client.blpop(CLICK_QUEUE, timeout=5)
        if result is None:
            continue
        _, raw = result
        try:
            event = json.loads(raw)
            process_click(event["code"])
        except Exception as e:
            print(f"Failed to process event: {e}")


if __name__ == "__main__":
    # Brief startup delay so Postgres/Redis are ready before first connection attempt
    time.sleep(3)
    main()
