import os
import json
import redis

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
CLICK_QUEUE = "click_events"

_client = redis.from_url(REDIS_URL, decode_responses=True)


def publish_click_event(code: str):
    """Fire-and-forget: push the event and return immediately, don't wait on the worker."""
    _client.rpush(CLICK_QUEUE, json.dumps({"code": code}))
