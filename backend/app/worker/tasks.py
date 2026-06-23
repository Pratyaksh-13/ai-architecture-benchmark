# app/worker/tasks.py

from app.worker.celery_app import celery_app
from app.database.connection import SessionLocal

# Import ALL models here so SQLAlchemy's mapper can resolve
# all relationships (including Project -> User FK) when the
# Celery worker process starts — without these imports, the
# mapper fails to locate referenced classes at query time
from app.models import (
    project,
    architecture,
    benchmark,
    benchmark_run,
    recommendation,
    user,
    resilience_result,
)


@celery_app.task(bind=True, name="run_real_benchmark")
def run_real_benchmark_task(self, project_id: int, user_id: int, load_profile: str = "medium"):
    """
    Celery task wrapping run_real_benchmark_for_project().
    bind=True gives access to self.update_state() for progress tracking.
    """
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
        raise

    except Exception as e:
        self.update_state(state="FAILURE", meta={"status": "failed", "error": str(e)})
        raise

    finally:
        db.close()