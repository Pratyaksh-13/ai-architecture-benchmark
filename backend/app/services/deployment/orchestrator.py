# app/services/deployment/orchestrator.py

from sqlalchemy.orm import Session

from app.models.benchmark import Benchmark
from app.models.benchmark_run import BenchmarkRun
from app.models.architecture import Architecture
from app.services.project_service import get_owned_project
from app.services.deployment.manager import deploy_architecture, teardown_architecture, DeploymentError
from app.services.deployment.k6_runner import run_k6_benchmark, K6RunError


class RealBenchmarkError(Exception):
    pass


def run_real_benchmark_for_project(
    db: Session,
    project_id: int,
    user_id: int,
    load_profile: str = "medium",
) -> list[Benchmark]:
    """
    Runs REAL benchmarks: deploys each of the 3 reference architectures
    (monolith/microservices/event_driven) one at a time, hits it with
    real k6 traffic, saves results under a new BenchmarkRun, tears down
    before moving to the next.

    Unlike simulate_benchmarks_for_project(), this doesn't care about the
    project's own generated architectures' docker_compose content (those
    reference nonexistent images) — it always benchmarks the same fixed
    benchmark_apps/ reference implementations, since that's what's
    actually deployable and real.
    """
    project = get_owned_project(db, project_id, user_id)

    architectures = (
        db.query(Architecture)
        .filter(Architecture.project_id == project_id)
        .all()
    )
    if not architectures:
        raise RealBenchmarkError("No architectures found for this project — generate them first")

    run = BenchmarkRun(project_id=project_id, load_profile=load_profile, simulation_type="real")
    db.add(run)
    db.commit()
    db.refresh(run)

    saved = []

    for arch in architectures:
        arch_type = arch.arch_type  # "monolithic" | "microservices" | "event_driven"

        try:
            deployment = deploy_architecture(arch_type)
        except DeploymentError as e:
            raise RealBenchmarkError(f"Failed to deploy {arch_type}: {e}")

        try:
            metrics = run_k6_benchmark(deployment["base_url"], load_profile)
        except K6RunError as e:
            teardown_architecture(arch_type)
            raise RealBenchmarkError(f"k6 run failed for {arch_type}: {e}")

        teardown_architecture(arch_type)

        benchmark = Benchmark(
            architecture_id=arch.id,
            project_id=project_id,
            run_id=run.id,
            latency_p50_ms=metrics["latency_p50_ms"],
            latency_p95_ms=metrics["latency_p95_ms"],
            latency_p99_ms=metrics["latency_p99_ms"],
            throughput_rps=metrics["throughput_rps"],
            error_rate_pct=metrics["error_rate_pct"],
            cpu_usage_pct=metrics["cpu_usage_pct"],
            memory_usage_mb=metrics["memory_usage_mb"],
            simulation_type="real",
            load_profile=load_profile,
        )
        db.add(benchmark)
        saved.append(benchmark)

    db.commit()
    for b in saved:
        db.refresh(b)

    return saved