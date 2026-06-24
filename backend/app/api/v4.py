# app/api/v4.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

from app.database.connection import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.models.benchmark import Benchmark
from app.models.benchmark_run import BenchmarkRun
from app.models.architecture import Architecture
from app.models.bottleneck_finding import BottleneckFinding
from app.models.capacity_projection import CapacityProjection
from app.models.cost_estimate import CostEstimate
from app.models.optimization_recommendation import OptimizationRecommendation
from app.models.architecture_evolution import ArchitectureEvolution
from app.services.project_service import get_owned_project
from app.services.v4.analysis_pipeline import run_full_analysis
from app.services.v4.capacity_service import project_capacity, save_projection
from pydantic import model_validator

router = APIRouter(prefix="/projects", tags=["V4 Analysis"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class AnalysisResponse(BaseModel):
    project_id: int
    benchmark_run_id: int
    bottleneck_count: int
    optimization_count: int
    cost_estimate_count: int
    architectures_analyzed: int
    status: str


class BottleneckResponse(BaseModel):
    id: int
    architecture_id: int
    bottleneck_type: str
    severity: str
    evidence: list[str]
    recommendation: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class BottleneckListResponse(BaseModel):
    project_id: int
    findings: list[BottleneckResponse]


class CapacityRequest(BaseModel):
    current_users: int
    expected_users: int


class CapacityProjectionResponse(BaseModel):
    id: int
    architecture_id: int
    current_users: int
    expected_users: int
    growth_ratio: Optional[float] = None
    projected_latency_p95_ms: Optional[float]
    projected_throughput_rps: Optional[float]
    projected_cpu_pct: Optional[float]
    projected_memory_mb: Optional[float]
    scaling_recommendation: Optional[str]
    expected_bottlenecks: Optional[Any]
    created_at: datetime

    @model_validator(mode='after')
    def compute_growth_ratio(self):
        if self.current_users and self.current_users > 0:
            self.growth_ratio = round(self.expected_users / self.current_users, 2)
        return self

    class Config:
        from_attributes = True


class CapacityListResponse(BaseModel):
    project_id: int
    projections: list[CapacityProjectionResponse]


class CostBreakdown(BaseModel):
    compute_usd: float
    memory_usd: float
    storage_usd: float
    redis_usd: float
    postgres_usd: float


class CostEstimateResponse(BaseModel):
    id: int
    architecture_id: int
    provider: str
    cpu_units: Optional[float]
    memory_gb: Optional[float]
    estimated_monthly_usd: Optional[float]
    instance_recommendation: Optional[str]
    cost_breakdown: Optional[Any]
    created_at: datetime

    class Config:
        from_attributes = True


class CostListResponse(BaseModel):
    project_id: int
    estimates: list[CostEstimateResponse]


class OptimizationResponse(BaseModel):
    id: int
    recommendation_type: str
    priority: str
    title: str
    description: str
    expected_improvement: Optional[str]
    evidence_metrics: Optional[Any]
    created_at: datetime

    class Config:
        from_attributes = True


class OptimizationListResponse(BaseModel):
    project_id: int
    recommendations: list[OptimizationResponse]


class EvolutionStepResponse(BaseModel):
    id: int
    from_arch_type: Optional[str]
    to_arch_type: str
    trigger: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class EvolutionResponse(BaseModel):
    project_id: int
    timeline: list[EvolutionStepResponse]


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/{project_id}/analyze", response_model=AnalysisResponse)
def run_analysis(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Runs the full V4 analysis pipeline:
    bottleneck detection, optimization recommendations,
    cost estimation, and evolution timeline update.
    Requires benchmarks to exist first.
    """
    try:
        result = run_full_analysis(db, project_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result


@router.get("/{project_id}/bottlenecks", response_model=BottleneckListResponse)
def get_bottlenecks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns bottleneck findings for the project's latest analysis."""
    get_owned_project(db, project_id, current_user.id)
    findings = (
        db.query(BottleneckFinding)
        .filter(BottleneckFinding.project_id == project_id)
        .order_by(BottleneckFinding.created_at.desc())
        .all()
    )
    return {"project_id": project_id, "findings": findings}


@router.post("/{project_id}/capacity", response_model=CapacityListResponse)
def run_capacity_projection(
    project_id: int,
    payload: CapacityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Projects future resource requirements and bottlenecks
    given expected user growth. Requires benchmarks to exist.
    """
    get_owned_project(db, project_id, current_user.id)

    latest_run = (
        db.query(BenchmarkRun)
        .filter(BenchmarkRun.project_id == project_id)
        .order_by(BenchmarkRun.created_at.desc())
        .first()
    )
    if not latest_run:
        raise HTTPException(status_code=400, detail="No benchmarks found — run a benchmark first")

    benchmarks = db.query(Benchmark).filter(Benchmark.run_id == latest_run.id).all()
    architectures = db.query(Architecture).filter(Architecture.project_id == project_id).all()
    bm_lookup = {b.architecture_id: b for b in benchmarks}

    projections = []
    for arch in architectures:
        bm = bm_lookup.get(arch.id)
        if not bm:
            continue
        try:
            projection = project_capacity(bm, payload.current_users, payload.expected_users, arch.arch_type)
            saved = save_projection(db, project_id, arch.id, payload.current_users, payload.expected_users, projection)
            projections.append(saved)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    return {"project_id": project_id, "projections": projections}


@router.get("/{project_id}/capacity", response_model=CapacityListResponse)
def get_capacity_projections(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns stored capacity projections for the project."""
    get_owned_project(db, project_id, current_user.id)
    projections = (
        db.query(CapacityProjection)
        .filter(CapacityProjection.project_id == project_id)
        .order_by(CapacityProjection.created_at.desc())
        .all()
    )
    return {"project_id": project_id, "projections": projections}


@router.get("/{project_id}/costs", response_model=CostListResponse)
def get_cost_estimates(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns cost estimates for all providers and architectures."""
    get_owned_project(db, project_id, current_user.id)
    estimates = (
        db.query(CostEstimate)
        .filter(CostEstimate.project_id == project_id)
        .order_by(CostEstimate.created_at.desc())
        .all()
    )
    return {"project_id": project_id, "estimates": estimates}


@router.get("/{project_id}/optimizations", response_model=OptimizationListResponse)
def get_optimizations(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns optimization recommendations ordered by priority."""
    get_owned_project(db, project_id, current_user.id)
    recs = (
        db.query(OptimizationRecommendation)
        .filter(OptimizationRecommendation.project_id == project_id)
        .order_by(OptimizationRecommendation.created_at.desc())
        .all()
    )
    return {"project_id": project_id, "recommendations": recs}


@router.get("/{project_id}/evolution", response_model=EvolutionResponse)
def get_evolution(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the architecture evolution timeline for a project."""
    get_owned_project(db, project_id, current_user.id)
    timeline = (
        db.query(ArchitectureEvolution)
        .filter(ArchitectureEvolution.project_id == project_id)
        .order_by(ArchitectureEvolution.created_at.asc())
        .all()
    )
    return {"project_id": project_id, "timeline": timeline}
