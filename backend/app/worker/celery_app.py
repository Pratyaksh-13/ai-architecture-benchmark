# app/worker/celery_app.py

from celery import Celery
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/1")
RESULT_BACKEND_URL = os.getenv("RESULT_BACKEND_URL", "redis://localhost:6379/2")
# Using DB 1 (not 0) to avoid collision with any other Redis usage

celery_app = Celery(
    "archbench",
    broker=REDIS_URL,
    backend=RESULT_BACKEND_URL,
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

from celery.signals import worker_ready

@worker_ready.connect
def flush_stale_results(sender, **kwargs):
    """Flush corrupt/stale Celery result keys on worker start."""
    try:
        import redis
        r = redis.from_url(REDIS_URL)
        keys = r.keys("celery-task-meta-*")
        if keys:
            # Delete any keys that can't be decoded (corrupt)
            for key in keys:
                try:
                    import json
                    val = r.get(key)
                    if val:
                        data = json.loads(val)
                        if isinstance(data, dict) and "result" in data:
                            result = data["result"]
                            if isinstance(result, dict) and "exc_type" not in result and "exc_message" not in result and data.get("status") == "FAILURE":
                                r.delete(key)
                except Exception:
                    r.delete(key)
    except Exception:
        pass


# Monkey-patch to fix corrupt result backend reads
from celery.backends.base import BaseBackend

_original_store_result = BaseBackend.store_result

def _safe_store_result(self, task_id, result, state, traceback=None, request=None, **kwargs):
    try:
        return _original_store_result(self, task_id, result, state, traceback=traceback, request=request, **kwargs)
    except (ValueError, KeyError):
        # Delete corrupt key and retry once
        try:
            self.delete(task_id)
        except Exception:
            pass
        try:
            return _original_store_result(self, task_id, result, state, traceback=traceback, request=request, **kwargs)
        except Exception:
            pass

BaseBackend.store_result = _safe_store_result
