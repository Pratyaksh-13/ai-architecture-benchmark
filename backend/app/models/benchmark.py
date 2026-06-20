# app/models/benchmark.py

from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime, String
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.connection import Base

class Benchmark(Base):
    __tablename__ = "benchmarks"

    id = Column(Integer, primary_key=True, index=True)
    architecture_id = Column(Integer, ForeignKey("architectures.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    # Core metrics
    latency_p50_ms = Column(Float, nullable=False)   # median latency
    latency_p95_ms = Column(Float, nullable=False)   # 95th percentile
    latency_p99_ms = Column(Float, nullable=False)   # 99th percentile (worst tail)
    throughput_rps = Column(Float, nullable=False)   # requests per second
    error_rate_pct = Column(Float, nullable=False)   # percentage of failed requests
    cpu_usage_pct = Column(Float, nullable=False)    # average CPU across nodes
    memory_usage_mb = Column(Float, nullable=False)  # average memory per node

    simulation_type = Column(String(20), default="simulated")  # "simulated" | "real"
    load_profile = Column(String(20), default="medium", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    

    architecture = relationship("Architecture", backref="benchmark")