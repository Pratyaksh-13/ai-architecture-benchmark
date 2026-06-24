from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database.connection import Base

class CostEstimate(Base):
    __tablename__ = "cost_estimates"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    architecture_id = Column(Integer, ForeignKey("architectures.id"), nullable=False)
    benchmark_run_id = Column(Integer, ForeignKey("benchmark_runs.id"), nullable=True)
    provider = Column(String(20), nullable=False)
    cpu_units = Column(Float, nullable=True)
    memory_gb = Column(Float, nullable=True)
    estimated_monthly_usd = Column(Float, nullable=True)
    instance_recommendation = Column(String(100), nullable=True)
    cost_breakdown = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
