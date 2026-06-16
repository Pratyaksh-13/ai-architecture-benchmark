# app/models/project.py

from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from app.database.connection import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    requirement = Column(Text, nullable=False)  # e.g. "Build a URL shortener"
    status = Column(String(50), default="pending")  # pending | generating | done | failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())