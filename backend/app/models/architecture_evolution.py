from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.database.connection import Base

class ArchitectureEvolution(Base):
    __tablename__ = "architecture_evolution"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    from_arch_type = Column(String(50), nullable=True)
    to_arch_type = Column(String(50), nullable=False)
    trigger = Column(String(100), nullable=True)
    benchmark_run_id = Column(Integer, ForeignKey("benchmark_runs.id"), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
