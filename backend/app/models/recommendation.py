# app/models/recommendation.py

from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from app.database.connection import Base

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    recommended_arch_type = Column(String(50), nullable=False)  # monolithic | microservices | event_driven
    reasoning = Column(Text, nullable=False)
    confidence_score = Column(Float, nullable=False)  # 0.0 to 1.0

    llm_provider = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())