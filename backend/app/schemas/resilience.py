# app/schemas/resilience.py  ← NEW FILE

from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ResilienceResultResponse(BaseModel):
    id: int
    architecture_id: int
    project_id: int
    pre_latency_p50_ms: Optional[float]
    pre_latency_p95_ms: Optional[float]
    pre_latency_p99_ms: Optional[float]
    pre_throughput_rps: Optional[float]
    pre_error_rate_pct: Optional[float]
    failure_latency_p95_ms: Optional[float]
    failure_error_rate_pct: Optional[float]
    failure_throughput_rps: Optional[float]
    recovery_time_ms: Optional[float]
    availability_pct: Optional[float]
    resilience_score: Optional[float]
    failure_type: str
    container_killed: Optional[str]
    recovered: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectResilienceResponse(BaseModel):
    project_id: int
    results: list[ResilienceResultResponse]