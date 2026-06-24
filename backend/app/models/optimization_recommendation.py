from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database.connection import Base

class OptimizationRecommendation(Base):
    __tablename__ = "optimization_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    benchmark_run_id = Column(Integer, ForeignKey("benchmark_runs.id"), nullable=True)
    recommendation_type = Column(String(50), nullable=False)
    priority = Column(String(20), nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    expected_improvement = Column(Text, nullable=True)
    evidence_metrics = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
