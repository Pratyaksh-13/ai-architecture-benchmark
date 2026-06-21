# app/services/deployment/k6_runner.py

import subprocess
import json
import tempfile
from pathlib import Path

# Path to k6/ folder at repo root, relative to this file:
# backend/app/services/deployment/k6_runner.py -> ... -> repo root -> k6/
K6_SCRIPTS_ROOT = Path(__file__).resolve().parents[4] / "k6"

LOAD_PROFILE_SCRIPTS = {
    "light": "light.js",
    "medium": "medium.js",
    "heavy": "heavy.js",
}


class K6RunError(Exception):
    pass


def run_k6_benchmark(base_url: str, load_profile: str) -> dict:
    """
    Runs the k6 script for the given load profile against a live deployed app,
    parses the resulting summary JSON, and returns metrics in the same shape
    as your existing simulate_benchmarks_for_project() output — ready to be
    saved into the benchmarks table with simulation_type="real".
    """
    script_name = LOAD_PROFILE_SCRIPTS.get(load_profile)
    if not script_name:
        raise K6RunError(f"Unknown load profile: {load_profile}")

    script_path = K6_SCRIPTS_ROOT / script_name
    if not script_path.exists():
        raise K6RunError(f"k6 script not found: {script_path}")

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
        summary_path = Path(tmp.name)

    try:
        result = subprocess.run(
            [
                "k6", "run",
                "-e", f"BASE_URL={base_url}",
                f"--summary-export={summary_path}",
                str(script_path),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            raise K6RunError(f"k6 run failed:\n{result.stderr}")

        with open(summary_path) as f:
            summary = json.load(f)

        return _parse_k6_summary(summary)

    finally:
        summary_path.unlink(missing_ok=True)


def _parse_k6_summary(summary: dict) -> dict:
    """Maps k6's raw summary JSON onto the benchmarks table schema."""
    metrics = summary["metrics"]

    duration = metrics["http_req_duration"]
    reqs = metrics["http_reqs"]
    failed = metrics["http_req_failed"]

    return {
        "latency_p50_ms": round(duration["p(50)"], 2),
        "latency_p95_ms": round(duration["p(95)"], 2),
        "latency_p99_ms": round(duration["p(99)"], 2),
        "throughput_rps": round(reqs["rate"], 2),
        "error_rate_pct": round(failed["value"] * 100, 2),
        # k6 doesn't measure container-level CPU/memory directly — that
        # would require a separate `docker stats` poller running alongside
        # the load test. Documented as a known limitation for now.
        "cpu_usage_pct": None,
        "memory_usage_mb": None,
    }