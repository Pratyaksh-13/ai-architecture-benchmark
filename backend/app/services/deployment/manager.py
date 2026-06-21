# app/services/deployment/manager.py

import time
import subprocess
import requests
from pathlib import Path

# Maps each architecture type to its benchmark_apps folder and external port,
# matching exactly what we already set up in docker-compose.yml for each.
ARCHITECTURE_CONFIG = {
    "monolithic": {
        "path": "monolith",
        "port": 8001,
    },
    "microservices": {
        "path": "microservices",
        "port": 8002,
    },
    "event_driven": {
        "path": "event-driven",
        "port": 8003,
    },
}

# Path to benchmark_apps/, relative to this file: backend/app/services/deployment/manager.py
# -> backend/app/services/deployment -> backend/app/services -> backend/app -> backend -> repo root
BENCHMARK_APPS_ROOT = Path(__file__).resolve().parents[4] / "benchmark_apps"

HEALTH_CHECK_TIMEOUT_SECONDS = 60
HEALTH_CHECK_INTERVAL_SECONDS = 2


class DeploymentError(Exception):
    pass


def _compose_path(arch_type: str) -> Path:
    config = ARCHITECTURE_CONFIG.get(arch_type)
    if not config:
        raise DeploymentError(f"Unknown architecture type: {arch_type}")
    path = BENCHMARK_APPS_ROOT / config["path"]
    if not path.exists():
        raise DeploymentError(f"benchmark_apps folder not found: {path}")
    return path


def deploy_architecture(arch_type: str) -> dict:
    """
    Runs `docker compose up -d --build` for the given architecture,
    waits for its /health endpoint to respond, and returns connection info.
    Raises DeploymentError if the build fails or health check times out.
    """
    config = ARCHITECTURE_CONFIG[arch_type]
    compose_dir = _compose_path(arch_type)
    port = config["port"]

    print(f"[deployment] Starting {arch_type} from {compose_dir}...")

    result = subprocess.run(
        ["docker", "compose", "up", "-d", "--build"],
        cwd=compose_dir,
        capture_output=True,
        text=True,
        timeout=180,
    )

    if result.returncode != 0:
        raise DeploymentError(
            f"docker compose up failed for {arch_type}:\n{result.stderr}"
        )

    health_url = f"http://localhost:{port}/health"
    deadline = time.time() + HEALTH_CHECK_TIMEOUT_SECONDS

    while time.time() < deadline:
        try:
            resp = requests.get(health_url, timeout=2)
            if resp.status_code == 200:
                print(f"[deployment] {arch_type} is healthy on port {port}")
                return {"arch_type": arch_type, "port": port, "base_url": f"http://localhost:{port}"}
        except requests.RequestException:
            pass
        time.sleep(HEALTH_CHECK_INTERVAL_SECONDS)

    # Health check never succeeded — tear down what we started, don't leave it orphaned
    teardown_architecture(arch_type)
    raise DeploymentError(
        f"{arch_type} did not become healthy within {HEALTH_CHECK_TIMEOUT_SECONDS}s, rolled back"
    )


def teardown_architecture(arch_type: str) -> None:
    """Runs `docker compose down` for the given architecture, including volumes."""
    compose_dir = _compose_path(arch_type)
    print(f"[deployment] Tearing down {arch_type}...")

    subprocess.run(
        ["docker", "compose", "down", "-v"],
        cwd=compose_dir,
        capture_output=True,
        text=True,
        timeout=60,
    )