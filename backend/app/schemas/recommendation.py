# app/schemas/recommendation.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class RecommendRequest(BaseModel):
    provider: Optional[str] = None

class RecommendationResponse(BaseModel):
    id: int
    project_id: int
    recommended_arch_type: str
    reasoning: str
    confidence_score: float
    llm_provider: str
    benchmark_winner: Optional[str] = None
    benchmark_winner_score: Optional[float] = None
    production_recommendation: Optional[str] = None
    fitness_score: Optional[float] = None
    signals_detected: Optional[list] = None
    benchmark_agrees: Optional[bool] = None
    created_at: datetime

    class Config:
        from_attributes = True