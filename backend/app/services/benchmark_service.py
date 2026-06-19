# app/services/benchmark_service.py

import random
from sqlalchemy.orm import Session
from app.models.benchmark import Benchmark
from app.models.architecture import Architecture
from app.services.project_service import get_project_by_id

# Base metric ranges per architecture type
# Values reflect real-world performance characteristics
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


def _simulate_metric(low: float, high: float) -> float:
    """Generate a realistic metric value with small random variance."""
    return round(random.uniform(low, high), 2)


def simulate_benchmarks_for_project(db: Session, project_id: int) -> list[Benchmark]:
    """
    Generate simulated benchmark metrics for all architectures
    belonging to a project. Idempotent — deletes existing benchmarks
    before regenerating so you can re-run safely.
    """
    get_project_by_id(db, project_id)  # raises 404 if missing

    # Delete any existing benchmarks for this project
    db.query(Benchmark).filter(Benchmark.project_id == project_id).delete()
    db.commit()

    # Fetch all architectures for the project
    architectures = (
        db.query(Architecture)
        .filter(Architecture.project_id == project_id)
        .all()
    )

    if not architectures:
        return []

    saved = []
    for arch in architectures:
        profile = BENCHMARK_PROFILES.get(arch.arch_type)
        if not profile:
            continue

        benchmark = Benchmark(
            architecture_id=arch.id,
            project_id=project_id,
            latency_p50_ms=_simulate_metric(*profile["latency_p50_ms"]),
            latency_p95_ms=_simulate_metric(*profile["latency_p95_ms"]),
            latency_p99_ms=_simulate_metric(*profile["latency_p99_ms"]),
            throughput_rps=_simulate_metric(*profile["throughput_rps"]),
            error_rate_pct=_simulate_metric(*profile["error_rate_pct"]),
            cpu_usage_pct=_simulate_metric(*profile["cpu_usage_pct"]),
            memory_usage_mb=_simulate_metric(*profile["memory_usage_mb"]),
            simulation_type="simulated",
        )
        db.add(benchmark)
        saved.append(benchmark)

    db.commit()
    for b in saved:
        db.refresh(b)

    return saved


def get_benchmarks_for_project(db: Session, project_id: int) -> list[Benchmark]:
    """Fetch stored benchmarks for a project."""
    get_project_by_id(db, project_id)
    return (
        db.query(Benchmark)
        .filter(Benchmark.project_id == project_id)
        .all()
    )