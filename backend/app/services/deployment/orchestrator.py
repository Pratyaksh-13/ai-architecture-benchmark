# app/services/deployment/orchestrator.py

from sqlalchemy.orm import Session

from app.models.benchmark import Benchmark
from app.models.benchmark_run import BenchmarkRun
from app.models.architecture import Architecture
from app.services.project_service import get_owned_project
from app.services.deployment.manager import deploy_architecture, teardown_architecture, DeploymentError
from app.services.deployment.k6_runner import run_k6_benchmark, K6RunError
from app.services.deployment.resilience_runner import run_resilience_test


class RealBenchmarkError(Exception):
    pass


def run_real_benchmark_for_project(
    db: Session,
    project_id: int,
    user_id: int,
    load_profile: str = "medium",
) -> list[Benchmark]:
    """
    Runs REAL benchmarks + resilience tests for all 3 architectures:
    1. Deploy architecture
    2. Run normal k6 benchmark (measures performance)
    3. Run resilience test (measures fault tolerance — kill a container mid-run)
    4. Tear down
    5. Repeat for next architecture
    """
    project = get_owned_project(db, project_id, user_id)

    architectures = (
        db.query(Architecture)
        .filter(Architecture.project_id == project_id)
        .all()
    )
    if not architectures:
        raise RealBenchmarkError("No architectures found — generate first")

    run = BenchmarkRun(project_id=project_id, load_profile=load_profile, simulation_type="real")
    db.add(run)
    db.commit()
    db.refresh(run)

    saved = []

    for arch in architectures:
        arch_type = arch.arch_type

        try:
            deployment = deploy_architecture(arch_type)
        except DeploymentError as e:
            raise RealBenchmarkError(f"Failed to deploy {arch_type}: {e}")

        try:
            metrics = run_k6_benchmark(deployment["base_url"], load_profile)
        except K6RunError as e:
            teardown_architecture(arch_type)
            raise RealBenchmarkError(f"k6 run failed for {arch_type}: {e}")

        # Resilience test runs while containers are still up from the normal benchmark
        try:
            run_resilience_test(
                db=db,
                arch_type=arch_type,
                architecture_id=arch.id,
                project_id=project_id,
                benchmark_run_id=run.id,
                base_url=deployment["base_url"],
            )
        except Exception as e:
            print(f"[resilience] WARNING: resilience test failed for {arch_type}, skipping: {e}")

        # Always tear down, even if resilience test failed
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