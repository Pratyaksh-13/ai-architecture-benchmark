# app/models/architecture.py

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.connection import Base

class Architecture(Base):
    __tablename__ = "architectures"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    arch_type = Column(String(50), nullable=False)       # monolithic | microservices | event_driven
    explanation = Column(Text, nullable=False)
    mermaid_diagram = Column(Text, nullable=False)
    docker_compose = Column(Text, nullable=True)
    tradeoffs = Column(JSON, nullable=True)               # {"pros": [...], "cons": [...]}

    llm_provider = Column(String(20), nullable=False)     # "claude" | "openai"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    project = relationship("Project", backref="architectures")