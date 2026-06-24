# app/services/v4/cost_service.py
# Pricing as of mid-2026 — update periodically from public pricing pages

from app.models.benchmark import Benchmark

PRICING_TABLES = {
    "aws": {
        "compute_per_vcpu_hour": 0.048,
        "memory_per_gb_hour": 0.006,
        "storage_per_gb_month": 0.10,
        "managed_redis_per_hour": 0.034,
        "managed_postgres_per_hour": 0.017,
    },
    "gcp": {
        "compute_per_vcpu_hour": 0.031,
        "memory_per_gb_hour": 0.004,
        "storage_per_gb_month": 0.08,
        "managed_redis_per_hour": 0.049,
        "managed_postgres_per_hour": 0.019,
    },
    "azure": {
        "compute_per_vcpu_hour": 0.052,
        "memory_per_gb_hour": 0.007,
        "storage_per_gb_month": 0.095,
        "managed_redis_per_hour": 0.037,
        "managed_postgres_per_hour": 0.021,
    },
}

HOURS_PER_MONTH = 730

ARCH_RESOURCE_PROFILES = {
    "monolithic":    {"vcpu": 2, "memory_gb": 4, "uses_redis": False},
    "microservices": {"vcpu": 6, "memory_gb": 8, "uses_redis": False},
    "event_driven":  {"vcpu": 4, "memory_gb": 6, "uses_redis": True},
}


def estimate_costs(arch_type: str, benchmark: Benchmark) -> list[dict]:
    """
    Estimates monthly cloud costs for all three providers.
    Uses static resource profiles per architecture type, adjusted
    by actual CPU usage from the benchmark run.
    Pricing sourced from public AWS/GCP/Azure pricing pages, mid-2026.
    """
    profile = ARCH_RESOURCE_PROFILES.get(arch_type, ARCH_RESOURCE_PROFILES["monolithic"])

    cpu_factor = (benchmark.cpu_usage_pct / 60) if benchmark.cpu_usage_pct else 1.0
    actual_vcpu = round(profile["vcpu"] * cpu_factor, 2)
    actual_memory_gb = round(profile["memory_gb"] * cpu_factor, 2)

    estimates = []
    for provider, prices in PRICING_TABLES.items():
        compute = actual_vcpu * prices["compute_per_vcpu_hour"] * HOURS_PER_MONTH
        memory = actual_memory_gb * prices["memory_per_gb_hour"] * HOURS_PER_MONTH
        storage = 20 * prices["storage_per_gb_month"]
        redis = (prices["managed_redis_per_hour"] * HOURS_PER_MONTH) if profile["uses_redis"] else 0
        postgres = prices["managed_postgres_per_hour"] * HOURS_PER_MONTH
        total = round(compute + memory + storage + redis + postgres, 2)

        estimates.append({
            "provider": provider,
            "cpu_units": actual_vcpu,
            "memory_gb": actual_memory_gb,
            "estimated_monthly_usd": total,
            "instance_recommendation": _instance_rec(provider, actual_vcpu, actual_memory_gb),
            "cost_breakdown": {
                "compute_usd": round(compute, 2),
                "memory_usd": round(memory, 2),
                "storage_usd": round(storage, 2),
                "redis_usd": round(redis, 2),
                "postgres_usd": round(postgres, 2),
            },
        })

    return estimates


def _instance_rec(provider: str, vcpu: float, memory_gb: float) -> str:
    if provider == "aws":
        if vcpu <= 2 and memory_gb <= 4:
            return "t3.medium ($0.0416/hr)"
        elif vcpu <= 4:
            return "t3.xlarge ($0.1664/hr)"
        return "c5.2xlarge ($0.34/hr)"
    elif provider == "gcp":
        if vcpu <= 2:
            return "e2-standard-2 ($0.067/hr)"
        return "e2-standard-4 ($0.134/hr)"
    else:
        if vcpu <= 2:
            return "B2s ($0.0416/hr)"
        return "D4s_v3 ($0.192/hr)"
