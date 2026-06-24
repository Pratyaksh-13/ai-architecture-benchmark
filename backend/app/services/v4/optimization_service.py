# app/services/v4/optimization_service.py

from app.models.benchmark import Benchmark

OPTIMIZATION_RULES = [
    {
        "condition": lambda b, findings: (
            b.latency_p99_ms and b.latency_p50_ms and b.latency_p50_ms > 0
            and (b.latency_p99_ms / b.latency_p50_ms) > 4
        ),
        "type": "caching",
        "priority": "high",
        "title": "Add Redis caching layer",
        "description": (
            "High p99/p50 latency ratio indicates repeated expensive queries hitting the database. "
            "A Redis cache layer would serve hot data in under 1ms, dramatically reducing tail latency."
        ),
        "expected_improvement": "40-70% reduction in p99 latency for read-heavy paths",
    },
    {
        "condition": lambda b, findings: (
            b.cpu_usage_pct and b.cpu_usage_pct > 75
            and any(f.get("bottleneck_type") == "cpu" for f in findings)
        ),
        "type": "async",
        "priority": "high",
        "title": "Move CPU-intensive operations to async workers",
        "description": (
            "CPU saturation detected in benchmark. Extract non-blocking, CPU-heavy work "
            "(image processing, report generation, heavy computation) to Celery/Redis workers, "
            "freeing the main service path for low-latency request handling."
        ),
        "expected_improvement": "50-60% CPU reduction on main service, lower p95 latency",
    },
    {
        "condition": lambda b, findings: b.error_rate_pct and b.error_rate_pct > 1.0,
        "type": "circuit_breaker",
        "priority": "high",
        "title": "Implement circuit breakers and retry logic",
        "description": (
            "Error rate above 1% suggests cascading failures under load. "
            "Circuit breakers prevent a failing downstream service from taking down the entire system. "
            "Combine with exponential backoff retries and dead-letter queues."
        ),
        "expected_improvement": "80% reduction in cascading failure impact",
    },
    {
        "condition": lambda b, findings: (
            b.throughput_rps and b.throughput_rps < 500
            and b.cpu_usage_pct and b.cpu_usage_pct < 60
        ),
        "type": "read_replica",
        "priority": "medium",
        "title": "Add PostgreSQL read replicas",
        "description": (
            "Low throughput with low CPU usage indicates database read contention — "
            "the bottleneck is DB I/O, not compute. Read replicas distribute SELECT queries "
            "across multiple instances, increasing read throughput without affecting write consistency."
        ),
        "expected_improvement": "2-3x throughput improvement for read-heavy workloads",
    },
    {
        "condition": lambda b, findings: b.latency_p95_ms and b.latency_p95_ms > 300,
        "type": "queue",
        "priority": "medium",
        "title": "Introduce queue-based async communication",
        "description": (
            "High p95 latency suggests synchronous processing bottlenecks on the critical path. "
            "Moving non-critical operations (emails, analytics, notifications) to a message queue "
            "decouples slow operations from the user-facing response path."
        ),
        "expected_improvement": "30-50% p95 latency reduction for write-heavy endpoints",
    },
    {
        "condition": lambda b, findings: (
            b.memory_usage_mb and b.memory_usage_mb > 3500
        ),
        "type": "memory_optimization",
        "priority": "medium",
        "title": "Optimize memory usage or upgrade instance tier",
        "description": (
            "Memory usage approaching instance limits. "
            "Profile for memory leaks, optimize ORM query loading (avoid N+1, use select_related), "
            "or upgrade to a higher memory instance tier."
        ),
        "expected_improvement": "Prevents OOM crashes; 20-30% memory reduction through query optimization",
    },
]


def generate_optimization_recommendations(
    benchmark: Benchmark,
    bottleneck_findings: list[dict],
) -> list[dict]:
    """
    Generates recommendations purely from metric thresholds and bottleneck findings.
    Each recommendation requires a measurable condition — no hallucination.
    """
    recommendations = []
    for rule in OPTIMIZATION_RULES:
        try:
            if rule["condition"](benchmark, bottleneck_findings):
                recommendations.append({
                    "recommendation_type": rule["type"],
                    "priority": rule["priority"],
                    "title": rule["title"],
                    "description": rule["description"],
                    "expected_improvement": rule["expected_improvement"],
                    "evidence_metrics": {
                        "latency_p50_ms": benchmark.latency_p50_ms,
                        "latency_p95_ms": benchmark.latency_p95_ms,
                        "latency_p99_ms": benchmark.latency_p99_ms,
                        "throughput_rps": benchmark.throughput_rps,
                        "error_rate_pct": benchmark.error_rate_pct,
                        "cpu_usage_pct": benchmark.cpu_usage_pct,
                        "memory_usage_mb": benchmark.memory_usage_mb,
                    },
                })
        except Exception:
            continue

    priority_order = {"high": 0, "medium": 1, "low": 2}
    return sorted(recommendations, key=lambda r: priority_order.get(r["priority"], 3))
