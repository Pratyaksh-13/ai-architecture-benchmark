# app/services/v4/bottleneck_service.py

from app.models.benchmark import Benchmark

THRESHOLDS = {
    "cpu": {"medium": 70, "high": 85, "critical": 95},
    "memory": {"medium": 75, "high": 88, "critical": 96},
    "latency_p99": {"medium": 200, "high": 500, "critical": 1000},
    "error_rate": {"medium": 1.0, "high": 3.0, "critical": 10.0},
}


def analyze_bottlenecks(benchmark: Benchmark, arch_type: str) -> list[dict]:
    findings = []

    # CPU bottleneck
    if benchmark.cpu_usage_pct:
        for severity in ["critical", "high", "medium"]:
            if benchmark.cpu_usage_pct >= THRESHOLDS["cpu"][severity]:
                findings.append({
                    "bottleneck_type": "cpu",
                    "severity": severity,
                    "evidence": [
                        f"CPU at {benchmark.cpu_usage_pct}% "
                        f"(threshold: {THRESHOLDS['cpu'][severity]}%)"
                    ],
                    "recommendation": _cpu_recommendation(arch_type, benchmark.cpu_usage_pct),
                })
                break

    # Memory bottleneck
    if benchmark.memory_usage_mb:
        memory_gb = benchmark.memory_usage_mb / 1024
        if memory_gb > 3.5:
            findings.append({
                "bottleneck_type": "memory",
                "severity": "high" if memory_gb > 6 else "medium",
                "evidence": [f"Memory usage {round(memory_gb, 2)}GB — approaching instance limits"],
                "recommendation": "Increase instance memory tier or introduce memory-efficient data structures",
            })

    # Tail latency bottleneck — p99 vs p50 spread
    if benchmark.latency_p99_ms and benchmark.latency_p50_ms and benchmark.latency_p50_ms > 0:
        spread = benchmark.latency_p99_ms / benchmark.latency_p50_ms
        if spread > 5:
            findings.append({
                "bottleneck_type": "database" if arch_type == "monolithic" else "network",
                "severity": "high" if spread > 10 else "medium",
                "evidence": [
                    f"p99/p50 latency ratio: {round(spread, 1)}x "
                    f"(p50={benchmark.latency_p50_ms}ms, p99={benchmark.latency_p99_ms}ms)",
                    "High tail latency spread indicates lock contention, GC pauses, or hot DB rows",
                ],
                "recommendation": "Consider connection pooling, query optimization, or read replicas",
            })

    # Error rate bottleneck
    if benchmark.error_rate_pct:
        for severity in ["critical", "high", "medium"]:
            if benchmark.error_rate_pct >= THRESHOLDS["error_rate"][severity]:
                findings.append({
                    "bottleneck_type": "reliability",
                    "severity": severity,
                    "evidence": [
                        f"Error rate {benchmark.error_rate_pct}% "
                        f"(threshold: {THRESHOLDS['error_rate'][severity]}%)"
                    ],
                    "recommendation": "Implement circuit breakers, retries with backoff, and error budget alerts",
                })
                break

    # Network overhead specific to microservices
    if arch_type == "microservices" and benchmark.latency_p50_ms and benchmark.latency_p50_ms > 150:
        findings.append({
            "bottleneck_type": "network",
            "severity": "medium",
            "evidence": [
                f"Median latency {benchmark.latency_p50_ms}ms for microservices "
                f"suggests excessive inter-service calls"
            ],
            "recommendation": "Consider service aggregation, GraphQL federation, or gRPC to reduce round trips",
        })

    # Throughput bottleneck
    if benchmark.throughput_rps and benchmark.throughput_rps < 100:
        findings.append({
            "bottleneck_type": "throughput",
            "severity": "high",
            "evidence": [f"Throughput at {benchmark.throughput_rps} req/s — critically low"],
            "recommendation": "Profile for blocking I/O, add connection pooling, consider horizontal scaling",
        })

    return findings


def _cpu_recommendation(arch_type: str, cpu_pct: float) -> str:
    if arch_type == "monolithic":
        return "Scale vertically or extract CPU-intensive operations to background workers"
    elif arch_type == "microservices":
        return "Identify which service is CPU-bound via per-service metrics and scale it independently"
    else:
        return "Worker pool exhausted — add more worker replicas to Redis consumer group"
