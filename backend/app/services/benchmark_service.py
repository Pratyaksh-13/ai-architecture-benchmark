# app/services/benchmark_service.py — full corrected file

import random
from sqlalchemy.orm import Session
from app.models.benchmark import Benchmark
from app.models.benchmark_run import BenchmarkRun
from app.models.architecture import Architecture
from app.services.project_service import get_owned_project

BENCHMARK_PROFILES = {
    "monolithic": {
        "latency_p50_ms": (40, 70),
        "latency_p95_ms": (60, 100),
        "latency_p99_ms": (80, 120),
        "throughput_rps": (800, 1200),
        "error_rate_pct": (0.1, 0.5),
        "cpu_usage_pct": (60, 80),
        "memory_usage_mb": (512, 1024),
    },
    "microservices": {
        "latency_p50_ms": (80, 130),
        "latency_p95_ms": (120, 200),
        "latency_p99_ms": (150, 250),
        "throughput_rps": (2000, 4000),
        "error_rate_pct": (0.5, 1.5),
        "cpu_usage_pct": (40, 65),
        "memory_usage_mb": (300, 600),
    },
    "event_driven": {
        "latency_p50_ms": (100, 180),
        "latency_p95_ms": (160, 280),
        "latency_p99_ms": (200, 350),
        "throughput_rps": (5000, 9000),
        "error_rate_pct": (0.2, 0.8),
        "cpu_usage_pct": (35, 55),
        "memory_usage_mb": (400, 700),
    },
}

LOAD_PROFILE_MULTIPLIERS = {
    "light": {"latency": 0.6, "throughput": 0.5, "error_rate": 0.4, "cpu": 0.6, "memory": 0.8},
    "medium": {"latency": 1.0, "throughput": 1.0, "error_rate": 1.0, "cpu": 1.0, "memory": 1.0},
    "heavy": {"latency": 1.8, "throughput": 1.4, "error_rate": 3.5, "cpu": 1.3, "memory": 1.25},
}


def _simulate_metric(low: float, high: float, multiplier: float) -> float:
    base = random.uniform(low, high)
    return round(base * multiplier, 2)


def simulate_benchmarks_for_project(
    db: Session,
    project_id: int,
    user_id: int,
    load_profile: str = "medium"
) -> list[Benchmark]:
    """
    Generate simulated benchmark metrics for all architectures in a project,
    scaled by the selected load profile. Each call creates a NEW BenchmarkRun
    rather than overwriting previous results — full history is preserved.
    """
    get_owned_project(db, project_id, user_id)

    architectures = (
        db.query(Architecture)
        .filter(Architecture.project_id == project_id)
        .all()
    )

    if not architectures:
        return []

    run = BenchmarkRun(project_id=project_id, load_profile=load_profile, simulation_type="simulated")
    db.add(run)
    db.commit()
    db.refresh(run)

    mult = LOAD_PROFILE_MULTIPLIERS.get(load_profile, LOAD_PROFILE_MULTIPLIERS["medium"])

    saved = []
    for arch in architectures:
        profile = BENCHMARK_PROFILES.get(arch.arch_type)
        if not profile:
            continue

        cpu_low, cpu_high = profile["cpu_usage_pct"]
        cpu_value = min(_simulate_metric(cpu_low, cpu_high, mult["cpu"]), 99.0)

        err_low, err_high = profile["error_rate_pct"]
        err_value = min(_simulate_metric(err_low, err_high, mult["error_rate"]), 25.0)

        benchmark = Benchmark(
            architecture_id=arch.id,
            project_id=project_id,
            run_id=run.id,
            latency_p50_ms=_simulate_metric(*profile["latency_p50_ms"], mult["latency"]),
            latency_p95_ms=_simulate_metric(*profile["latency_p95_ms"], mult["latency"]),
            latency_p99_ms=_simulate_metric(*profile["latency_p99_ms"], mult["latency"]),
            throughput_rps=_simulate_metric(*profile["throughput_rps"], mult["throughput"]),
            error_rate_pct=err_value,
            cpu_usage_pct=cpu_value,
            memory_usage_mb=_simulate_metric(*profile["memory_usage_mb"], mult["memory"]),
            simulation_type="simulated",
            load_profile=load_profile,
        )
        db.add(benchmark)
        saved.append(benchmark)

    db.commit()
    for b in saved:
        db.refresh(b)

    return saved


def get_benchmarks_for_project(db: Session, project_id: int, user_id: int) -> list[Benchmark]:
    """Returns benchmarks from the MOST RECENT run only."""
    get_owned_project(db, project_id, user_id)
    latest_run = (
        db.query(BenchmarkRun)
        .filter(BenchmarkRun.project_id == project_id)
        .order_by(BenchmarkRun.created_at.desc())
        .first()
    )
    if not latest_run:
        return []
    return (
        db.query(Benchmark)
        .filter(Benchmark.run_id == latest_run.id)
        .all()
    )


def get_benchmark_history(db: Session, project_id: int, user_id: int) -> list[dict]:
    """Returns ALL past runs for a project, each with its benchmarks — the actual history."""
    get_owned_project(db, project_id, user_id)
    runs = (
        db.query(BenchmarkRun)
        .filter(BenchmarkRun.project_id == project_id)
        .order_by(BenchmarkRun.created_at.desc())
        .all()
    )
    return [
        {
            "run_id": run.id,
            "load_profile": run.load_profile,
            "simulation_type": run.simulation_type,
            "created_at": run.created_at,
            "benchmarks": run.benchmarks,
        }
        for run in runs
    ]