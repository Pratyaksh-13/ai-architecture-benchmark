# app/services/deployment/manager.py
# Replaced: no longer does docker compose up/down.
# Benchmark services are always-running — just resolve their URLs.

from app.services.deployment.target_resolver import get_target_url
import requests


class DeploymentError(Exception):
    pass


def deploy_architecture(arch_type: str) -> dict:
    """
    No longer deploys anything. Returns the pre-configured URL for the
    always-running benchmark service matching arch_type.
    Raises DeploymentError if the service is unreachable.
    """
    try:
        base_url = get_target_url(arch_type)
    except ValueError as e:
        raise DeploymentError(str(e))

    # Health check — confirm the service is actually up
    try:
        resp = requests.get(f"{base_url}/health", timeout=5)
        if resp.status_code != 200:
            raise DeploymentError(
                f"{arch_type} health check returned {resp.status_code} at {base_url}"
            )
    except requests.RequestException as e:
        raise DeploymentError(
            f"{arch_type} is unreachable at {base_url}: {e}"
        )

    print(f"[deployment] {arch_type} confirmed healthy at {base_url}")
    return {"arch_type": arch_type, "base_url": base_url}


def teardown_architecture(arch_type: str) -> None:
    """No-op — services are always running, nothing to tear down."""
    print(f"[deployment] {arch_type} teardown skipped (always-on service)")
