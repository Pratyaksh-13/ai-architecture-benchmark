# app/worker/celery_app.py

from celery import Celery
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/1")
# Using DB 1 (not 0) to avoid collision with any other Redis usage

celery_app = Celery(
    "archbench",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["app.worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,         # tasks show STARTED state (not just PENDING)
    result_expires=3600,             # results kept for 1 hour
    worker_prefetch_multiplier=1,    # one task at a time per worker
    worker_concurrency=1,             # only one process — benchmarks use Docker ports
    task_acks_late=True,             # task only marked done after it actually completes
)