# app/services/deployment/resilience_runner.py

import subprocess
import json
import time
import tempfile
from pathlib import Path
from sqlalchemy.orm import Session

from app.models.resilience_result import ResilienceResult
from app.models.architecture import Architecture

K6_RESILIENCE_ROOT = Path(__file__).resolve().parents[4] / "k6" / "resilience"

# Architecture-specific failure configuration:
# container_suffix is the Docker Compose service name that gets killed
FAILURE_CONFIG = {
    "monolithic": {
        "container_suffix": "app",         # kills monolith-app-1
        "failure_type": "app_kill",
        "description": "Kill the application container",
    },
    "microservices": {
        "container_suffix": "shortener-service",  # kills the critical path service
        "failure_type": "service_kill",
        "description": "Kill the shortener service while redirect service stays up",
    },
    "event_driven": {
        "container_suffix": "worker",      # kills the async worker
        "failure_type": "worker_kill",
        "description": "Kill the async worker — redirects still work, click tracking stops",
    },
}


def _run_k6_phase(script_name: str, base_url: str) -> dict:
    """Runs one k6 phase script and returns parsed metrics."""
    script_path = K6_RESILIENCE_ROOT / script_name

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        summary_path = Path(tmp.name)

    try:
        result = subprocess.run(
            ["k6", "run", "-e", f"BASE_URL={base_url}",
             f"--summary-export={summary_path}", str(script_path)],
            capture_output=True, text=True, timeout=90,
        )
        with open(summary_path) as f:
            summary = json.load(f)
        return summary
    finally:
        summary_path.unlink(missing_ok=True)


def _extract_metrics(summary: dict) -> dict:
    """Pulls the metrics we care about from a k6 summary."""
    metrics = summary.get("metrics", {})
    duration = metrics.get("http_req_duration", {})
    reqs = metrics.get("http_reqs", {})
    failed = metrics.get("http_req_failed", {})

    return {
        "latency_p50_ms": round(duration.get("p(50)", 0), 2),
        "latency_p95_ms": round(duration.get("p(95)", 0), 2),
        "latency_p99_ms": round(duration.get("p(99)", 0), 2),
        "throughput_rps": round(reqs.get("rate", 0), 2),
        "error_rate_pct": round((metrics.get("checks", {}).get("fails", 0) / max(metrics.get("checks", {}).get("passes", 0) + metrics.get("checks", {}).get("fails", 0), 1)) * 100, 2),
    }


def _find_container_name(arch_type: str, container_suffix: str) -> str | None:
    """
    Finds the actual running container name matching the suffix.
    Docker Compose names containers as {folder}-{service}-{index},
    e.g. monolith-app-1, microservices-shortener-service-1.
    """
    result = subprocess.run(
        ["docker", "ps", "--format", "{{.Names}}"],
        capture_output=True, text=True
    )
    containers = result.stdout.strip().split("\n")
    for name in containers:
        if container_suffix in name:
            return name
    return None


def _kill_container(container_name: str) -> bool:
    """Kills a container. Returns True if successful."""
    result = subprocess.run(
        ["docker", "kill", container_name],
        capture_output=True, text=True
    )
    return result.returncode == 0


def _check_recovery(base_url: str, timeout_seconds: int = 30) -> float | None:
    """
    Polls the /health endpoint after failure to detect recovery.
    Returns the recovery time in ms, or None if it never recovered.
    """
    import requests
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
    """
    Composite resilience score 0-100:
    - Availability (40%): what % of all requests across both phases succeeded
    - Error containment (30%): how much worse did errors get during failure?
    - Recovery (30%): did it recover? How fast?
    """
    # Availability score — 100% availability = 100 points
    availability_score = availability_pct

    # Error containment — if errors didn't spike much, score is high
    error_delta = failure_error_rate - pre_error_rate
    error_containment_score = max(0, 100 - (error_delta * 5))

    # Recovery score — recovered fast = high score, no recovery = 0
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
    """
    Full resilience test for one architecture:
    1. Run k6 for 30s (pre-failure baseline)
    2. Kill the architecture-specific container
    3. Run k6 for 30s (failure period — errors expected)
    4. Check if/when the app recovered
    5. Compute resilience score and save result
    """
    config = FAILURE_CONFIG.get(arch_type)
    if not config:
        raise ValueError(f"No failure config for arch_type: {arch_type}")

    # Brief warmup — health endpoint passes before worker/DB connections are fully ready
    time.sleep(10)
    print(f"[resilience] Running pre-failure phase for {arch_type}...")
    pre_summary = _run_k6_phase("pre_failure.js", base_url)
    print(f"[resilience] pre-failure checks: {pre_summary['metrics'].get('checks', {})}, http_reqs: {pre_summary['metrics'].get('http_reqs', {})}")
    pre_metrics = _extract_metrics(pre_summary)

    # Find and kill the target container
    container_name = _find_container_name(arch_type, config["container_suffix"])
    print(f"[resilience] Injecting failure: killing {container_name}...")
    killed = _kill_container(container_name) if container_name else False

    print(f"[resilience] Running failure-period phase for {arch_type}...")
    failure_summary = _run_k6_phase("failure_period.js", base_url)
    failure_metrics = _extract_metrics(failure_summary)

    # Check recovery — for monolith (app_kill) the service won't self-heal,
    # so recovery_time_ms will be None. For microservices/event-driven, the
    # gateway/api service is still running, so partial recovery may happen.
    print(f"[resilience] Checking for recovery...")
    recovery_time_ms = _check_recovery(base_url, timeout_seconds=30)
    recovered = recovery_time_ms is not None

    # Availability: % of all requests (both phases) that succeeded
    total_requests = (
        pre_summary["metrics"].get("http_reqs", {}).get("count", 0)
        + failure_summary["metrics"].get("http_reqs", {}).get("count", 0)
    )
    total_failed = (
        pre_summary["metrics"].get("checks", {}).get("fails", 0)
        + failure_summary["metrics"].get("checks", {}).get("fails", 0)
    )
    availability_pct = round(
        ((total_requests - total_failed) / total_requests * 100) if total_requests > 0 else 0,
        2
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
        container_killed=container_name,
        recovered=recovered,
    )
    db.add(result)
    db.commit()
    db.refresh(result)

    print(f"[resilience] {arch_type} — score: {resilience_score}/100, recovered: {recovered}, availability: {availability_pct}%")
    return result