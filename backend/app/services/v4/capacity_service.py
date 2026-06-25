# app/services/v4/capacity_service.py

import math
from sqlalchemy.orm import Session
from app.models.benchmark import Benchmark
from app.models.capacity_projection import CapacityProjection


def project_capacity(
    benchmark: Benchmark,
    current_users: int,
    expected_users: int,
    arch_type: str,
) -> dict:
    """
    Uses two models:
    - Logarithmic scaling for latency (grows sub-linearly with good indexing,
      but hits walls at connection pool limits)
    - Linear scaling for resource usage (CPU/memory scale with load)
    These are approximations — stated clearly in model_note.
    """
    if current_users <= 0:
        raise ValueError("current_users must be greater than 0")

    growth_ratio = expected_users / current_users

    # Latency grows logarithmically under normal conditions
    latency_multiplier = math.log(growth_ratio + 1) / math.log(2) if growth_ratio > 0 else 1.0
    projected_latency = round(benchmark.latency_p95_ms * latency_multiplier, 2) if benchmark.latency_p95_ms else None

    # Throughput degrades as load approaches saturation
    throughput_multiplier = min(growth_ratio * 0.7, growth_ratio)
    projected_throughput = round(benchmark.throughput_rps * throughput_multiplier, 2) if benchmark.throughput_rps else None

    # Resource usage scales roughly linearly
    projected_cpu = round(min(benchmark.cpu_usage_pct * growth_ratio * 0.8, 99), 2) if benchmark.cpu_usage_pct else None
    projected_memory = round(benchmark.memory_usage_mb * growth_ratio * 0.6, 2) if benchmark.memory_usage_mb else None

    bottlenecks = []
    if projected_cpu is not None and projected_cpu> 85:
        bottlenecks.append(
            f"CPU will saturate at ~{projected_cpu}% — horizontal scaling required before reaching {expected_users} users"
        )
    if projected_latency and projected_latency > 500:
        bottlenecks.append(
            f"p95 latency projected at {projected_latency}ms — DB query optimization and caching critical"
        )
    if projected_throughput and benchmark.throughput_rps and projected_throughput < benchmark.throughput_rps * 0.5:
        bottlenecks.append(
            "Throughput will degrade significantly — connection pool exhaustion likely"
        )

    return {
        "growth_ratio": round(growth_ratio, 2),
        "projected_latency_p95_ms": projected_latency,
        "projected_throughput_rps": projected_throughput,
        "projected_cpu_pct": projected_cpu,
        "projected_memory_mb": projected_memory,
        "scaling_recommendation": _scaling_recommendation(arch_type, growth_ratio, projected_cpu),
        "expected_bottlenecks": bottlenecks,
        "model_note": (
            "Projections use logarithmic latency + linear resource scaling models. "
            "Treat as order-of-magnitude estimates, validated against your actual load profile."
        ),
    }


def _scaling_recommendation(arch_type: str, ratio: float, projected_cpu: float) -> str:
    if arch_type == "monolithic" and ratio > 10:
        return (
            f"Monolith will struggle at {ratio}x growth. "
            "Consider migrating read-heavy paths to a dedicated service, adding read replicas, "
            "or introducing a caching layer before reaching this scale."
        )
    elif arch_type == "microservices" and projected_cpu is not None and projected_cpu > 85:
        return (
            "Scale CPU-bound services independently via horizontal pod autoscaling. "
            "Identify the bottleneck service using per-service Prometheus metrics."
        )
    elif arch_type == "event_driven":
        return (
            "Event-driven architecture scales well horizontally. "
            "Add worker replicas and partition Redis streams by key range to distribute load."
        )
    return (
        "Current architecture should handle projected load with additional compute resources. "
        "Monitor DB connection pool utilization as the first scaling constraint."
    )


def save_projection(
    db: Session,
    project_id: int,
    architecture_id: int,
    current_users: int,
    expected_users: int,
    projection: dict,
) -> CapacityProjection:
    cp = CapacityProjection(
        project_id=project_id,
        architecture_id=architecture_id,
        current_users=current_users,
        expected_users=expected_users,
        projected_latency_p95_ms=projection["projected_latency_p95_ms"],
        projected_throughput_rps=projection["projected_throughput_rps"],
        projected_cpu_pct=projection["projected_cpu_pct"],
        projected_memory_mb=projection["projected_memory_mb"],
        scaling_recommendation=projection["scaling_recommendation"],
        expected_bottlenecks=projection["expected_bottlenecks"],
    )
    db.add(cp)
    db.commit()
    db.refresh(cp)
    return cp
