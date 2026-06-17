# app/schemas/architecture.py

from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ArchitectureResponse(BaseModel):
    id: int
    project_id: int
    arch_type: str
    explanation: str
    mermaid_diagram: str
    docker_compose: Optional[str] = None
    tradeoffs: Optional[dict] = None
    llm_provider: str
    created_at: datetime

    class Config:
        from_attributes = True

class GenerateRequest(BaseModel):
    provider: Optional[str] = None  # "claude" | "openai" — overrides .env default if set

class GenerateResponse(BaseModel):
    project_id: int
    architectures: list[ArchitectureResponse]