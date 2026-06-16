# app/schemas/project.py

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

# --- Input schemas (what we accept FROM the user) ---

class ProjectCreate(BaseModel):
    requirement: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Natural language requirement, e.g. 'Build a scalable URL shortener'"
    )

# --- Output schemas (what we RETURN to the user) ---

class ProjectResponse(BaseModel):
    id: int
    requirement: str
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # Allows converting SQLAlchemy objects directly

class ProjectListResponse(BaseModel):
    total: int
    projects: list[ProjectResponse]