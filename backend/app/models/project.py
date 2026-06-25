from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database.connection import Base


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    requirement = Column(Text, nullable=False)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    owner = relationship("User", back_populates="projects")

    # In your Project model
    architectures = relationship("Architecture", backref="project", cascade="all, delete-orphan")
    benchmark_runs = relationship("BenchmarkRun", backref="project", cascade="all, delete-orphan")
    resilience_results = relationship("ResilienceResult", backref="project", cascade="all, delete-orphan")
    bottleneck_findings = relationship("BottleneckFinding", backref="project", cascade="all, delete-orphan")
    capacity_projections = relationship("CapacityProjection", backref="project", cascade="all, delete-orphan")
    cost_estimates = relationship("CostEstimate", backref="project", cascade="all, delete-orphan")
    service_split_recommendations = relationship("ServiceSplitRecommendation", backref="project", cascade="all, delete-orphan")
    architecture_evolution = relationship("ArchitectureEvolution", backref="project", cascade="all, delete-orphan")
    optimization_recommendations = relationship("OptimizationRecommendation", backref="project", cascade="all, delete-orphan")