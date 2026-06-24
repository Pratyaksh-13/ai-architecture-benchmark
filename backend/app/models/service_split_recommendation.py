from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database.connection import Base

class ServiceSplitRecommendation(Base):
    __tablename__ = "service_split_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    architecture_id = Column(Integer, ForeignKey("architectures.id"), nullable=False)
    current_service = Column(String(100), nullable=False)
    recommended_splits = Column(JSONB, nullable=False)
    reasoning = Column(Text, nullable=True)
    expected_latency_improvement_pct = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
