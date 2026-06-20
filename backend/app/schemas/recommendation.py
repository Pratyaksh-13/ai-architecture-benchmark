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
    created_at: datetime

    class Config:
        from_attributes = True