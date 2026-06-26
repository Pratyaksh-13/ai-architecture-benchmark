# app/services/deployment/orchestrator.py

from sqlalchemy.orm import Session

from app.models.benchmark import Benchmark
from app.models.benchmark_run import BenchmarkRun
from app.models.architecture import Architecture
from app.services.project_service import get_owned_project
from app.services.deployment.manager import deploy_architecture, DeploymentError
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
    Runs REAL benchmarks + resilience tests for all architectures.
    Services are always-on — no deployment or teardown needed.
    """
    get_owned_project(db, project_id, user_id)

    architectures = (
        db.query(Architecture)
        .filter(Architecture.project_id == project_id)
        .all()
    )
    if not architectures:
        raise RealBenchmarkError("No architectures found — generate first")

    run = BenchmarkRun(
        project_id=project_id,
        load_profile=load_profile,
        simulation_type="real",
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    saved = []

    for arch in architectures:
        arch_type = arch.arch_type

        try:
            deployment = deploy_architecture(arch_type)
        except DeploymentError as e:
            raise RealBenchmarkError(f"Failed to reach {arch_type}: {e}")

        base_url = deployment["base_url"]

        try:
            metrics = run_k6_benchmark(base_url, load_profile)
        except K6RunError as e:
            raise RealBenchmarkError(f"k6 run failed for {arch_type}: {e}")

        try:
            run_resilience_test(
                db=db,
                arch_type=arch_type,
                architecture_id=arch.id,
                project_id=project_id,
                benchmark_run_id=run.id,
                base_url=base_url,
            )
        except Exception as e:
            print(f"[resilience] WARNING: resilience test failed for {arch_type}, skipping: {e}")

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
