# app/services/deployment/target_resolver.py
import os


ARCH_URLS = {
    "monolithic":     os.getenv("MONOLITH_URL",      "http://monolith:8000"),
    "microservices":  os.getenv("MICROSERVICES_URL",  "http://microservices-gateway"),
    "event_driven":   os.getenv("EVENT_DRIVEN_URL",   "http://event-driven-api:8000"),
}

CHAOS_TOKEN = os.getenv("CHAOS_TOKEN", "dev-chaos-token")


def get_target_url(arch_type: str) -> str:
    url = ARCH_URLS.get(arch_type)
    if not url:
        raise ValueError(f"Unknown arch_type: {arch_type}")
    return url.rstrip("/")


def get_chaos_headers() -> dict:
    return {"Authorization": f"Bearer {CHAOS_TOKEN}"}
