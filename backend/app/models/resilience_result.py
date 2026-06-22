# app/models/resilience_result.py

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, func
from app.database.connection import Base

class ResilienceResult(Base):
    __tablename__ = "resilience_results"

    id = Column(Integer, primary_key=True, index=True)
    benchmark_run_id = Column(Integer, ForeignKey("benchmark_runs.id"), nullable=False)
    architecture_id = Column(Integer, ForeignKey("architectures.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    pre_latency_p50_ms = Column(Float, nullable=True)
    pre_latency_p95_ms = Column(Float, nullable=True)
    pre_latency_p99_ms = Column(Float, nullable=True)
    pre_throughput_rps = Column(Float, nullable=True)
    pre_error_rate_pct = Column(Float, nullable=True)

    failure_latency_p95_ms = Column(Float, nullable=True)
    failure_error_rate_pct = Column(Float, nullable=True)
    failure_throughput_rps = Column(Float, nullable=True)

    recovery_time_ms = Column(Float, nullable=True)
    availability_pct = Column(Float, nullable=True)
    resilience_score = Column(Float, nullable=True)

    failure_type = Column(String(50), nullable=False)
    container_killed = Column(String(100), nullable=True)
    recovered = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())