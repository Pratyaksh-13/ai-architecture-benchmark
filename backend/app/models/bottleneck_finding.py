from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database.connection import Base

class BottleneckFinding(Base):
    __tablename__ = "bottleneck_findings"

    id = Column(Integer, primary_key=True, index=True)
    benchmark_run_id = Column(Integer, ForeignKey("benchmark_runs.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    architecture_id = Column(Integer, ForeignKey("architectures.id"), nullable=False)
    bottleneck_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)
    evidence = Column(JSONB, nullable=False)
    recommendation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
