# app/api/projects.py

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User

from app.schemas.project import ProjectCreate, ProjectResponse, ProjectListResponse
from app.services.project_service import (
    create_project,
    get_all_projects,
    get_project_by_id,
    delete_project,
)

from app.schemas.architecture import GenerateRequest, GenerateResponse
from app.services.architecture_service import (
    generate_architectures_for_project,
    get_architectures_for_project,
)

from app.schemas.benchmark import BenchmarkRequest, BenchmarkResponse, ProjectBenchmarksResponse

from app.services.benchmark_service import (
    simulate_benchmarks_for_project,
    get_benchmarks_for_project,
)

from app.schemas.recommendation import RecommendRequest, RecommendationResponse
from app.services.recommendation_service import (
    generate_recommendation,
    get_recommendation_for_project,
)

router = APIRouter(
    prefix="/projects",
    tags=["Projects"],
)


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_newproject(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new architecture benchmarking project. Requires login."""
    return create_project(db, payload, user_id=current_user.id)


@router.get("/", response_model=ProjectListResponse)
def list_projects(db: Session = Depends(get_db)):
    """Return all projects ordered by creation date (newest first)."""
    projects = get_all_projects(db)
    return {"total": len(projects), "projects": projects}


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Return a single project by ID."""
    return get_project_by_id(db, project_id)


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
def remove_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a project by ID."""
    return delete_project(db, project_id)


@router.post("/{project_id}/generate", response_model=GenerateResponse)
def generate_architectures(
    project_id: int,
    payload: GenerateRequest,
    db: Session = Depends(get_db)
):
    """
    Trigger LLM architecture generation for a project.
    Optionally specify 'provider': 'claude' or 'openai' in the request body.
    """
    architectures = generate_architectures_for_project(db, project_id, payload.provider)
    return {"project_id": project_id, "architectures": architectures}


@router.get("/{project_id}/architectures", response_model=GenerateResponse)
def list_architectures(project_id: int, db: Session = Depends(get_db)):
    """Return all previously generated architectures for a project."""
    architectures = get_architectures_for_project(db, project_id)
    return {"project_id": project_id, "architectures": architectures}



@router.post("/{project_id}/benchmark", response_model=ProjectBenchmarksResponse)
def run_benchmark(
    project_id: int,
    payload: BenchmarkRequest,
    db: Session = Depends(get_db)
):
    """
    Simulate benchmark metrics for all architectures in a project,
    scaled by the selected load profile (light/medium/heavy, default medium).
    Safe to call multiple times — regenerates fresh metrics each time.
    """
    benchmarks = simulate_benchmarks_for_project(db, project_id, payload.load_profile)
    return {"project_id": project_id, "benchmarks": benchmarks}


@router.get("/{project_id}/benchmarks", response_model=ProjectBenchmarksResponse)
def get_benchmarks(project_id: int, db: Session = Depends(get_db)):
    """Return stored benchmark metrics for a project."""
    benchmarks = get_benchmarks_for_project(db, project_id)
    return {"project_id": project_id, "benchmarks": benchmarks}


@router.post("/{project_id}/recommend", response_model=RecommendationResponse)
def recommend_architecture(
    project_id: int,
    payload: RecommendRequest,
    db: Session = Depends(get_db)
):
    """
    Generate an AI recommendation for the best architecture,
    based on the requirement and benchmark results.
    Requires architectures and benchmarks to already exist.
    """
    return generate_recommendation(db, project_id, payload.provider)


@router.get("/{project_id}/recommendation", response_model=RecommendationResponse)
def get_recommendation(project_id: int, db: Session = Depends(get_db)):
    """Fetch the stored recommendation for a project, if any."""
    return get_recommendation_for_project(db, project_id)