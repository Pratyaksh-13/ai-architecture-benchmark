# app/models/recommendation.py
from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from app.database.connection import Base

class Recommendation(Base):
    __tablename__ = "recommendations"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    recommended_arch_type = Column(Text, nullable=True)
    benchmark_winner = Column(Text, nullable=True)
    benchmark_winner_score = Column(Float, nullable=True)
    production_recommendation = Column(Text, nullable=True)
    fitness_score = Column(Float, nullable=True)
    signals_detected = Column(JSONB, nullable=True)
    benchmark_agrees = Column(Boolean, default=True)
    reasoning = Column(Text, nullable=True)
    confidence_score = Column(Float, nullable=True)
    llm_provider = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
