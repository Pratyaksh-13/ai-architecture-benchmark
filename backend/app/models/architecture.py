# app/models/architecture.py

from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database.connection import Base

class Architecture(Base):
    __tablename__ = "architectures"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)

    arch_type = Column(String(50), nullable=False)
    explanation = Column(Text, nullable=False)
    mermaid_diagram = Column(Text, nullable=False)
    docker_compose = Column(Text, nullable=True)
    tradeoffs = Column(JSON, nullable=True)

    llm_provider = Column(String(20), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    benchmarks = relationship("Benchmark", backref="architecture", cascade="all, delete-orphan")
    resilience_results = relationship("ResilienceResult", backref="architecture", cascade="all, delete-orphan")
    bottleneck_findings = relationship("BottleneckFinding", backref="architecture", cascade="all, delete-orphan")
    capacity_projections = relationship("CapacityProjection", backref="architecture", cascade="all, delete-orphan")  
    cost_estimates = relationship("CostEstimate", backref="architecture", cascade="all, delete-orphan")             
    service_split_recommendations = relationship("ServiceSplitRecommendation", backref="architecture", cascade="all, delete-orphan")  