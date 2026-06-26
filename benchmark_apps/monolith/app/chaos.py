# app/chaos.py — chaos engineering endpoints for resilience testing
import os
import asyncio
import threading
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/internal/chaos", tags=["chaos"])

CHAOS_TOKEN = os.getenv("CHAOS_TOKEN", "dev-chaos-token")

# Shared state
_chaos_active = False
_chaos_delay_ms = 0
_chaos_error_rate = 0.0


def _verify_token(authorization: str = Header(...)):
    expected = f"Bearer {CHAOS_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


class ChaosRequest(BaseModel):
    duration_s: int = 30
    delay_ms: int = 500
    error_rate: float = 0.8


@router.post("/kill-worker")
def kill_worker(req: ChaosRequest, authorization: str = Header(...)):
    _verify_token(authorization)
    global _chaos_active, _chaos_delay_ms, _chaos_error_rate
    _chaos_active = True
    _chaos_delay_ms = req.delay_ms
    _chaos_error_rate = req.error_rate

    def auto_recover():
        import time
        time.sleep(req.duration_s)
        global _chaos_active
        _chaos_active = False

    threading.Thread(target=auto_recover, daemon=True).start()
    return {"status": "chaos_injected", "duration_s": req.duration_s}


@router.post("/network-delay")
def network_delay(req: ChaosRequest, authorization: str = Header(...)):
    _verify_token(authorization)
    global _chaos_active, _chaos_delay_ms
    _chaos_active = True
    _chaos_delay_ms = req.delay_ms

    def auto_recover():
        import time
        time.sleep(req.duration_s)
        global _chaos_active
        _chaos_active = False

    threading.Thread(target=auto_recover, daemon=True).start()
    return {"status": "delay_injected", "delay_ms": req.delay_ms}


@router.post("/recover")
def recover(authorization: str = Header(...)):
    _verify_token(authorization)
    global _chaos_active, _chaos_delay_ms, _chaos_error_rate
    _chaos_active = False
    _chaos_delay_ms = 0
    _chaos_error_rate = 0.0
    return {"status": "recovered"}


def get_chaos_state():
    return {
        "active": _chaos_active,
        "delay_ms": _chaos_delay_ms,
        "error_rate": _chaos_error_rate,
    }
