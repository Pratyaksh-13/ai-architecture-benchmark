# app/services/scoring_service.py

from sqlalchemy.orm import Session
from app.models.benchmark import Benchmark

# Weights sum to 1.0 — adjust these if you want to favor different priorities.
# These reflect common real-world priorities: latency and reliability matter
# most for user-facing systems, throughput next, resource efficiency last.
WEIGHTS = {
    "latency": 0.35,
    "throughput": 0.25,
    "reliability": 0.25,   # inverse of error rate
    "efficiency": 0.15,    # inverse of resource usage
}


def _normalize(value: float, all_values: list[float], lower_is_better: bool) -> float:
    """
    Scales a value to 0-100 relative to the other architectures being compared.
    This is a relative score (best-in-this-comparison = 100), not an absolute
    benchmark against some external standard — appropriate since we're
    specifically comparing 3 architectures against each other.
    """
    if not all_values or max(all_values) == min(all_values):
        return 100.0  # all equal, or only one data point — no meaningful spread

    lo, hi = min(all_values), max(all_values)
    if lower_is_better:
        return round(100 * (hi - value) / (hi - lo), 1)
    else:
        return round(100 * (value - lo) / (hi - lo), 1)


def calculate_scores(benchmarks: list[Benchmark]) -> dict[int, dict]:
    """
    Takes the benchmarks for ALL architectures in a project (one per architecture)
    and returns a score breakdown per architecture_id, comparing them against
    each other on this run's metrics.
    """
    if not benchmarks:
        return {}

    p95_values = [b.latency_p95_ms for b in benchmarks]
    throughput_values = [b.throughput_rps for b in benchmarks]
    error_values = [b.error_rate_pct for b in benchmarks]

    # Only include resource metrics if they're actually present (real benchmarks
    # may have None for CPU/memory — see the k6_runner.py limitation noted earlier)
    has_resource_data = all(b.cpu_usage_pct is not None for b in benchmarks)
    cpu_values = [b.cpu_usage_pct for b in benchmarks] if has_resource_data else []

    results = {}
    for b in benchmarks:
        latency_score = _normalize(b.latency_p95_ms, p95_values, lower_is_better=True)
        throughput_score = _normalize(b.throughput_rps, throughput_values, lower_is_better=False)
        reliability_score = _normalize(b.error_rate_pct, error_values, lower_is_better=True)

        if has_resource_data:
            efficiency_score = _normalize(b.cpu_usage_pct, cpu_values, lower_is_better=True)
        else:
            # Redistribute the efficiency weight proportionally across the other
            # 3 dimensions rather than silently scoring it as 0 — don't penalize
            # real benchmarks just because CPU/memory wasn't measured.
            efficiency_score = None

        if efficiency_score is not None:
            overall = (
                latency_score * WEIGHTS["latency"]
                + throughput_score * WEIGHTS["throughput"]
                + reliability_score * WEIGHTS["reliability"]
                + efficiency_score * WEIGHTS["efficiency"]
            )
        else:
            remaining_weight = WEIGHTS["latency"] + WEIGHTS["throughput"] + WEIGHTS["reliability"]
            overall = (
                latency_score * (WEIGHTS["latency"] / remaining_weight)
                + throughput_score * (WEIGHTS["throughput"] / remaining_weight)
                + reliability_score * (WEIGHTS["reliability"] / remaining_weight)
            )

        results[b.architecture_id] = {
            "latency_score": latency_score,
            "throughput_score": throughput_score,
            "reliability_score": reliability_score,
            "efficiency_score": efficiency_score,
            "overall_score": round(overall, 1),
        }

    return results