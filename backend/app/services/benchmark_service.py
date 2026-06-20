# app/services/benchmark_service.py

import random
from sqlalchemy.orm import Session
from app.models.benchmark import Benchmark
from app.models.architecture import Architecture
from app.services.project_service import get_project_by_id

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

# Multipliers applied on top of base ranges to simulate load conditions.
# "light" = well under capacity, everything looks great
# "medium" = baseline, matches the original fixed ranges
# "heavy" = near/over capacity — latency and errors climb, throughput plateaus
LOAD_PROFILE_MULTIPLIERS = {
    "light": {
        "latency": 0.6,
        "throughput": 0.5,
        "error_rate": 0.4,
        "cpu": 0.6,
        "memory": 0.8,
    },
    "medium": {
        "latency": 1.0,
        "throughput": 1.0,
        "error_rate": 1.0,
        "cpu": 1.0,
        "memory": 1.0,
    },
    "heavy": {
        "latency": 1.8,
        "throughput": 1.4,
        "error_rate": 3.5,
        "cpu": 1.3,
        "memory": 1.25,
    },
}


def _simulate_metric(low: float, high: float, multiplier: float) -> float:
    """Generate a realistic metric value with variance, scaled by load profile."""
    base = random.uniform(low, high)
    return round(base * multiplier, 2)


def simulate_benchmarks_for_project(
    db: Session,
    project_id: int,
    load_profile: str = "medium"
) -> list[Benchmark]:
    """
    Generate simulated benchmark metrics for all architectures in a project,
    scaled by the selected load profile (light/medium/heavy).
    Idempotent — deletes existing benchmarks before regenerating.
    """
    get_project_by_id(db, project_id)

    db.query(Benchmark).filter(Benchmark.project_id == project_id).delete()
    db.commit()

    architectures = (
        db.query(Architecture)
        .filter(Architecture.project_id == project_id)
        .all()
    )

    if not architectures:
        return []

    mult = LOAD_PROFILE_MULTIPLIERS.get(load_profile, LOAD_PROFILE_MULTIPLIERS["medium"])

    saved = []
    for arch in architectures:
        profile = BENCHMARK_PROFILES.get(arch.arch_type)
        if not profile:
            continue

        # CPU is capped at 99% — can't realistically exceed full utilization
        cpu_low, cpu_high = profile["cpu_usage_pct"]
        cpu_value = min(_simulate_metric(cpu_low, cpu_high, mult["cpu"]), 99.0)

        # Error rate capped at 25% — even under heavy load this stays bounded for realism
        err_low, err_high = profile["error_rate_pct"]
        err_value = min(_simulate_metric(err_low, err_high, mult["error_rate"]), 25.0)

        benchmark = Benchmark(
            architecture_id=arch.id,
            project_id=project_id,
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


def get_benchmarks_for_project(db: Session, project_id: int) -> list[Benchmark]:
    get_project_by_id(db, project_id)
    return (
        db.query(Benchmark)
        .filter(Benchmark.project_id == project_id)
        .all()
    )