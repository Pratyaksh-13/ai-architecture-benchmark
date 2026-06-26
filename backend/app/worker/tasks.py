# app/worker/tasks.py
from app.worker.celery_app import celery_app
from app.database.connection import SessionLocal
from app.models import (
    project, architecture, architecture_evolution, benchmark,
    benchmark_run, bottleneck_finding, capacity_projection,
    cost_estimate, optimization_recommendation, recommendation,
    resilience_result, service_split_recommendation, user,
)

@celery_app.task(bind=True, name="run_real_benchmark")
def run_real_benchmark_task(self, project_id: int, user_id: int, load_profile: str = "medium"):
    from app.services.deployment.orchestrator import run_real_benchmark_for_project, RealBenchmarkError
    db = SessionLocal()
    try:
        self.update_state(state="STARTED", meta={"status": "Deploying architectures..."})
        benchmarks = run_real_benchmark_for_project(db, project_id, user_id, load_profile)
        return {
            "status": "complete",
            "project_id": project_id,
            "benchmark_count": len(benchmarks),
            "load_profile": load_profile,
        }
    except RealBenchmarkError as e:
        return {"status": "failed", "error": str(e)}
    except Exception as e:
        return {"status": "failed", "error": str(e)}
    finally:
        db.close()
