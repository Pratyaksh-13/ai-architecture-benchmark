# app/services/deployment/resilience_runner.py
# Replaced: docker kill -> chaos endpoint calls

import subprocess
import json
import time
import tempfile
import requests
from pathlib import Path
from sqlalchemy.orm import Session

from app.models.resilience_result import ResilienceResult
from app.services.deployment.target_resolver import get_target_url, get_chaos_headers

K6_RESILIENCE_ROOT = Path(__file__).resolve().parents[4] / "k6" / "resilience"

FAILURE_CONFIG = {
    "monolithic": {
        "failure_type": "app_kill",
        "chaos_endpoint": "/internal/chaos/kill-worker",
    },
    "microservices": {
        "failure_type": "service_kill",
        "chaos_endpoint": "/internal/chaos/kill-worker",
    },
    "event_driven": {
        "failure_type": "worker_kill",
        "chaos_endpoint": "/internal/chaos/kill-worker",
    },
}


def _run_k6_phase(script_name: str, base_url: str) -> dict:
    script_path = K6_RESILIENCE_ROOT / script_name
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        summary_path = Path(tmp.name)
    try:
        subprocess.run(
            ["k6", "run", "-e", f"BASE_URL={base_url}",
             f"--summary-export={summary_path}", str(script_path)],
            capture_output=True, text=True, timeout=90,
        )
        with open(summary_path) as f:
            return json.load(f)
    finally:
        summary_path.unlink(missing_ok=True)


def _extract_metrics(summary: dict) -> dict:
    metrics = summary.get("metrics", {})
    duration = metrics.get("http_req_duration", {})
    reqs = metrics.get("http_reqs", {})
    checks = metrics.get("checks", {})
    total = checks.get("passes", 0) + checks.get("fails", 0)
    return {
        "latency_p50_ms": round(duration.get("p(50)", 0), 2),
        "latency_p95_ms": round(duration.get("p(95)", 0), 2),
        "latency_p99_ms": round(duration.get("p(99)", 0), 2),
        "throughput_rps": round(reqs.get("rate", 0), 2),
        "error_rate_pct": round((checks.get("fails", 0) / max(total, 1)) * 100, 2),
    }


def _inject_failure(base_url: str, chaos_endpoint: str) -> bool:
    """Calls the chaos endpoint to simulate failure."""
    try:
        resp = requests.post(
            f"{base_url}{chaos_endpoint}",
            json={"duration_s": 30},
            headers=get_chaos_headers(),
            timeout=5,
        )
        return resp.status_code in (200, 202)
    except Exception as e:
        print(f"[resilience] chaos endpoint failed: {e}")
        return False


def _trigger_recovery(base_url: str) -> None:
    """Calls the recover endpoint to restore normal operation."""
    try:
        requests.post(
            f"{base_url}/internal/chaos/recover",
            headers=get_chaos_headers(),
            timeout=5,
        )
    except Exception:
        pass


def _check_recovery(base_url: str, timeout_seconds: int = 30) -> float | None:
    start = time.time()
    deadline = start + timeout_seconds
    while time.time() < deadline:
        try:
            resp = requests.get(f"{base_url}/health", timeout=2)
            if resp.status_code == 200:
                return round((time.time() - start) * 1000, 2)
        except Exception:
            pass
        time.sleep(1)
    return None


def _compute_resilience_score(
    pre_error_rate: float,
    failure_error_rate: float,
    availability_pct: float,
    recovered: bool,
    recovery_time_ms: float | None,
) -> float:
    availability_score = availability_pct
    error_delta = failure_error_rate - pre_error_rate
    error_containment_score = max(0, 100 - (error_delta * 5))
    if not recovered or recovery_time_ms is None:
        recovery_score = 0.0
    elif recovery_time_ms < 5000:
        recovery_score = 100.0
    elif recovery_time_ms < 15000:
        recovery_score = 70.0
    elif recovery_time_ms < 30000:
        recovery_score = 40.0
    else:
        recovery_score = 10.0
    overall = (
        availability_score * 0.40
        + error_containment_score * 0.30
        + recovery_score * 0.30
    )
    return round(min(max(overall, 0), 100), 1)


def run_resilience_test(
    db: Session,
    arch_type: str,
    architecture_id: int,
    project_id: int,
    benchmark_run_id: int,
    base_url: str,
) -> ResilienceResult:
    config = FAILURE_CONFIG.get(arch_type)
    if not config:
        raise ValueError(f"No failure config for arch_type: {arch_type}")

    time.sleep(5)
    print(f"[resilience] Running pre-failure phase for {arch_type}...")
    pre_summary = _run_k6_phase("pre_failure.js", base_url)
    pre_metrics = _extract_metrics(pre_summary)

    print(f"[resilience] Injecting failure via chaos endpoint for {arch_type}...")
    injected = _inject_failure(base_url, config["chaos_endpoint"])
    if not injected:
        print(f"[resilience] WARNING: chaos injection may have failed for {arch_type}")

    print(f"[resilience] Running failure-period phase for {arch_type}...")
    failure_summary = _run_k6_phase("failure_period.js", base_url)
    failure_metrics = _extract_metrics(failure_summary)

    print(f"[resilience] Triggering recovery for {arch_type}...")
    _trigger_recovery(base_url)

    print(f"[resilience] Checking for recovery...")
    recovery_time_ms = _check_recovery(base_url, timeout_seconds=30)
    recovered = recovery_time_ms is not None

    pre_reqs = pre_summary.get("metrics", {}).get("http_reqs", {})
    fail_reqs = failure_summary.get("metrics", {}).get("http_reqs", {})
    pre_checks = pre_summary.get("metrics", {}).get("checks", {})
    fail_checks = failure_summary.get("metrics", {}).get("checks", {})

    total_requests = pre_reqs.get("count", 0) + fail_reqs.get("count", 0)
    total_failed = pre_checks.get("fails", 0) + fail_checks.get("fails", 0)
    availability_pct = round(
        ((total_requests - total_failed) / total_requests * 100)
        if total_requests > 0 else 0, 2
    )

    resilience_score = _compute_resilience_score(
        pre_error_rate=pre_metrics["error_rate_pct"],
        failure_error_rate=failure_metrics["error_rate_pct"],
        availability_pct=availability_pct,
        recovered=recovered,
        recovery_time_ms=recovery_time_ms,
    )

    result = ResilienceResult(
        benchmark_run_id=benchmark_run_id,
        architecture_id=architecture_id,
        project_id=project_id,
        pre_latency_p50_ms=pre_metrics["latency_p50_ms"],
        pre_latency_p95_ms=pre_metrics["latency_p95_ms"],
        pre_latency_p99_ms=pre_metrics["latency_p99_ms"],
        pre_throughput_rps=pre_metrics["throughput_rps"],
        pre_error_rate_pct=pre_metrics["error_rate_pct"],
        failure_latency_p95_ms=failure_metrics["latency_p95_ms"],
        failure_error_rate_pct=failure_metrics["error_rate_pct"],
        failure_throughput_rps=failure_metrics["throughput_rps"],
        recovery_time_ms=recovery_time_ms,
        availability_pct=availability_pct,
        resilience_score=resilience_score,
        failure_type=config["failure_type"],
        container_killed=None,
        recovered=recovered,
    )
    db.add(result)
    db.commit()
    db.refresh(result)

    print(f"[resilience] {arch_type} — score: {resilience_score}/100, recovered: {recovered}, availability: {availability_pct}%")
    return result
