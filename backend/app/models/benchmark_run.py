# app/models/benchmark_run.py

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database.connection import Base

class BenchmarkRun(Base):
    __tablename__ = "benchmark_runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    load_profile = Column(String(20), nullable=False)
    simulation_type = Column(String(20), nullable=False)  # "simulated" | "real"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    benchmarks = relationship("Benchmark", back_populates="run")