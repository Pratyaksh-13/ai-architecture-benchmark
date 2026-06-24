# app/services/v4/evolution_service.py

from sqlalchemy.orm import Session
from app.models.architecture_evolution import ArchitectureEvolution


def record_evolution_step(
    db: Session,
    project_id: int,
    to_arch_type: str,
    trigger: str,
    benchmark_run_id: int | None = None,
    notes: str | None = None,
) -> ArchitectureEvolution:
    """
    Records an architecture evolution step.
    Automatically determines from_arch_type from the previous entry.
    """
    last = (
        db.query(ArchitectureEvolution)
        .filter(ArchitectureEvolution.project_id == project_id)
        .filter(ArchitectureEvolution.to_arch_type == to_arch_type)
        .order_by(ArchitectureEvolution.created_at.desc())
        .first()
    )

    # Don't duplicate — if we already have this arch_type as the latest entry, skip
    if last and last.benchmark_run_id == benchmark_run_id:
        return last

    previous = (
        db.query(ArchitectureEvolution)
        .filter(ArchitectureEvolution.project_id == project_id)
        .order_by(ArchitectureEvolution.created_at.desc())
        .first()
    )
    from_arch = previous.to_arch_type if previous and previous.to_arch_type != to_arch_type else None

    entry = ArchitectureEvolution(
        project_id=project_id,
        from_arch_type=from_arch,
        to_arch_type=to_arch_type,
        trigger=trigger,
        benchmark_run_id=benchmark_run_id,
        notes=notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_evolution_timeline(db: Session, project_id: int) -> list[ArchitectureEvolution]:
    return (
        db.query(ArchitectureEvolution)
        .filter(ArchitectureEvolution.project_id == project_id)
        .order_by(ArchitectureEvolution.created_at.asc())
        .all()
    )
