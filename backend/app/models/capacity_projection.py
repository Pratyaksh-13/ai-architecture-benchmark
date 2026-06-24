from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database.connection import Base

class CapacityProjection(Base):
    __tablename__ = "capacity_projections"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    architecture_id = Column(Integer, ForeignKey("architectures.id"), nullable=False)
    current_users = Column(Integer, nullable=False)
    expected_users = Column(Integer, nullable=False)
    projected_latency_p95_ms = Column(Float, nullable=True)
    projected_throughput_rps = Column(Float, nullable=True)
    projected_cpu_pct = Column(Float, nullable=True)
    projected_memory_mb = Column(Float, nullable=True)
    scaling_recommendation = Column(Text, nullable=True)
    expected_bottlenecks = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
