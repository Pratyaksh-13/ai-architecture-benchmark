# app/api/projects.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User

from app.schemas.project import ProjectCreate, ProjectResponse, ProjectListResponse
from app.services.project_service import (
    create_project,
    get_all_projects,
    get_owned_project,
    delete_project,
)

from app.schemas.architecture import GenerateRequest, GenerateResponse
from app.services.architecture_service import (
    generate_architectures_for_project,
    get_architectures_for_project,
)

from app.schemas.benchmark import BenchmarkRequest, ProjectBenchmarksResponse
from app.services.benchmark_service import (
    simulate_benchmarks_for_project,
    get_benchmarks_for_project,
)

from app.schemas.recommendation import RecommendRequest, RecommendationResponse
from app.services.recommendation_service import (
    generate_recommendation,
    get_recommendation_for_project,
)
from app.services.deployment.orchestrator import run_real_benchmark_for_project, RealBenchmarkError

from app.services.scoring_service import calculate_scores
from app.schemas.benchmark import ProjectScoresResponse, ScoreBreakdown
from app.models.benchmark import Benchmark


from app.services.benchmark_service import get_benchmark_history
from app.schemas.benchmark import ProjectHistoryResponse

from app.models.resilience_result import ResilienceResult
from app.schemas.resilience import ProjectResilienceResponse, ResilienceResultResponse

from fastapi.responses import Response, PlainTextResponse
from app.services.report_service import generate_markdown_report, generate_pdf_report


from app.worker.tasks import run_real_benchmark_task
from app.worker.celery_app import celery_app
from celery.result import AsyncResult
from app.schemas.job import JobSubmittedResponse, JobStatusResponse

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_newproject(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new architecture benchmarking project."""
    return create_project(db, payload, user_id=current_user.id)


@router.get("/", response_model=ProjectListResponse)
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all projects belonging to the logged-in user, newest first."""
    projects = get_all_projects(db, current_user.id)
    return {"total": len(projects), "projects": projects}


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a single project by ID, only if owned by the logged-in user."""
    return get_owned_project(db, project_id, current_user.id)


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
def remove_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a project by ID, only if owned by the logged-in user."""
    return delete_project(db, project_id, current_user.id)


@router.post("/{project_id}/generate", response_model=GenerateResponse)
def generate_architectures(
    project_id: int,
    payload: GenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger LLM architecture generation for a project you own."""
    architectures = generate_architectures_for_project(db, project_id, current_user.id, payload.provider)
    return {"project_id": project_id, "architectures": architectures}


@router.get("/{project_id}/architectures", response_model=GenerateResponse)
def list_architectures(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return architectures for a project you own."""
    architectures = get_architectures_for_project(db, project_id, current_user.id)
    return {"project_id": project_id, "architectures": architectures}


@router.post("/{project_id}/benchmark", response_model=ProjectBenchmarksResponse)
def run_benchmark(
    project_id: int,
    payload: BenchmarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Simulate benchmark metrics for a project you own."""
    benchmarks = simulate_benchmarks_for_project(db, project_id, current_user.id, payload.load_profile)
    return {"project_id": project_id, "benchmarks": benchmarks}


@router.get("/{project_id}/benchmarks", response_model=ProjectBenchmarksResponse)
def get_benchmarks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return benchmarks for a project you own."""
    benchmarks = get_benchmarks_for_project(db, project_id, current_user.id)
    return {"project_id": project_id, "benchmarks": benchmarks}


@router.post("/{project_id}/recommend", response_model=RecommendationResponse)
def recommend_architecture(
    project_id: int,
    payload: RecommendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate an AI recommendation for a project you own."""
    return generate_recommendation(db, project_id, current_user.id, payload.provider)


@router.get("/{project_id}/recommendation", response_model=RecommendationResponse)
def get_recommendation(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch the stored recommendation for a project you own."""
    return get_recommendation_for_project(db, project_id, current_user.id)


@router.post("/{project_id}/benchmark/real", response_model=ProjectBenchmarksResponse)
def run_real_benchmark(
    project_id: int,
    payload: BenchmarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Runs REAL benchmarks: actually deploys, load-tests, and tears down
    each of the 3 reference architectures via Docker + k6. Takes several
    minutes — unlike /benchmark, which returns simulated results instantly.
    """
    try:
        benchmarks = run_real_benchmark_for_project(db, project_id, current_user.id, payload.load_profile)
    except RealBenchmarkError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"project_id": project_id, "benchmarks": benchmarks}



@router.get("/{project_id}/scores", response_model=ProjectScoresResponse)
def get_scores(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Computes relative architecture scores from the project's latest benchmarks."""
    get_owned_project(db, project_id, current_user.id)

    benchmarks = (
        db.query(Benchmark)
        .filter(Benchmark.project_id == project_id)
        .all()
    )
    if not benchmarks:
        raise HTTPException(status_code=404, detail="No benchmarks found — run a benchmark first")

    score_map = calculate_scores(benchmarks)
    scores = [
        ScoreBreakdown(architecture_id=arch_id, **breakdown)
        for arch_id, breakdown in score_map.items()
    ]
    return {"project_id": project_id, "scores": scores}



@router.get("/{project_id}/history", response_model=ProjectHistoryResponse)
def get_history(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns every past benchmark run for a project, newest first."""
    get_owned_project(db, project_id, current_user.id)
    runs = get_benchmark_history(db, project_id, current_user.id)
    return {"project_id": project_id, "runs": runs}



@router.get("/{project_id}/resilience", response_model=ProjectResilienceResponse)
def get_resilience(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns resilience test results for a project's latest real benchmark run."""
    get_owned_project(db, project_id, current_user.id)

    results = (
        db.query(ResilienceResult)
        .filter(ResilienceResult.project_id == project_id)
        .order_by(ResilienceResult.created_at.desc())
        .all()
    )

    return {"project_id": project_id, "results": results}




@router.get("/{project_id}/report/markdown")
def download_markdown_report(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a complete Markdown report for this project."""
    content = generate_markdown_report(db, project_id, current_user.id)
    return Response(
        content=content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=archbench-report-{project_id}.md"
        }
    )


@router.get("/{project_id}/report/pdf")
def download_pdf_report(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download a styled PDF report for this project."""
    pdf_bytes = generate_pdf_report(db, project_id, current_user.id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=archbench-report-{project_id}.pdf"
        }
    )



@router.post("/{project_id}/benchmark/real/async", response_model=JobSubmittedResponse)
def run_real_benchmark_async(
    project_id: int,
    payload: BenchmarkRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submits a real benchmark job to the queue and returns immediately
    with a job_id. Poll GET /jobs/{job_id} for status and results.
    Unlike /benchmark/real, this does not block for 5-10 minutes.
    """
    get_owned_project(db, project_id, current_user.id)

    task = run_real_benchmark_task.delay(
        project_id=project_id,
        user_id=current_user.id,
        load_profile=payload.load_profile,
    )

    return JobSubmittedResponse(
        job_id=task.id,
        status="queued",
        message=f"Benchmark job queued. Poll GET /api/v1/jobs/{task.id} for status.",
    )


@router.delete("/jobs/{job_id}", response_model=JobStatusResponse)
def cancel_job(job_id: str):
    """Cancel a queued or running benchmark job."""
    try:
        result = AsyncResult(job_id, app=celery_app)
        result.revoke(terminate=True, signal="SIGTERM")
        return JobStatusResponse(job_id=job_id, status="cancelled")
    except Exception as e:
        return JobStatusResponse(job_id=job_id, status="failed", error=str(e))

@router.get("/jobs/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    """Check the status of a queued benchmark job."""
    try:
        result = AsyncResult(job_id, app=celery_app)
        state = result.state
    except Exception:
        return JobStatusResponse(job_id=job_id, status="pending")

    try:
        if state == "PENDING":
            return JobStatusResponse(job_id=job_id, status="pending")
        elif state == "STARTED":
            return JobStatusResponse(job_id=job_id, status="running", meta=result.info)
        elif state == "SUCCESS":
            return JobStatusResponse(job_id=job_id, status="complete", result=result.result)
        elif state == "FAILURE":
            try:
                error_msg = str(result.result)
            except Exception:
                error_msg = "Job failed with unknown error"
            return JobStatusResponse(job_id=job_id, status="failed", error=error_msg)
        else:
            return JobStatusResponse(job_id=job_id, status=result.state.lower())
    except Exception as e:
        return JobStatusResponse(job_id=job_id, status="failed", error=str(e))