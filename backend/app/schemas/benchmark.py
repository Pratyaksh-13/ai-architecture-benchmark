# app/schemas/benchmark.py

from pydantic import BaseModel
from datetime import datetime

class BenchmarkResponse(BaseModel):
    id: int
    architecture_id: int
    project_id: int
    latency_p50_ms: float
    latency_p95_ms: float
    latency_p99_ms: float
    throughput_rps: float
    error_rate_pct: float
    cpu_usage_pct: float
    memory_usage_mb: float
    simulation_type: str
    created_at: datetime

    class Config:
        from_attributes = True

class ProjectBenchmarksResponse(BaseModel):
    project_id: int
    benchmarks: list[BenchmarkResponse]