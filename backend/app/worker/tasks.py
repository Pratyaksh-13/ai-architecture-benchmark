# app/worker/tasks.py
from app.worker.celery_app import celery_app
from app.database.connection import SessionLocal

# Import ALL models so SQLAlchemy mapper can resolve all relationships
from app.models import project
from app.models import architecture
from app.models import architecture_evolution
from app.models import benchmark
from app.models import benchmark_run
from app.models import bottleneck_finding
from app.models import capacity_projection
from app.models import cost_estimate
from app.models import optimization_recommendation
from app.models import recommendation
from app.models import resilience_result
from app.models import service_split_recommendation
from app.models import user


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
        self.update_state(state="FAILURE", meta={"status": "failed", "error": str(e)})
        return {"status": "failed", "error": str(e)}
    except Exception as e:
        self.update_state(state="FAILURE", meta={"status": "failed", "error": str(e)})
        return {"status": "failed", "error": str(e)}
    finally:
        db.close()
