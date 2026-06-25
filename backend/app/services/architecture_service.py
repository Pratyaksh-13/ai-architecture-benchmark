# app/services/architecture_service.py

from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.architecture import Architecture
from app.services.llm.factory import get_llm_provider
from app.services.project_service import get_project_by_id

from app.services.project_service import get_owned_project  # changed import



def generate_architectures_for_project(
    db: Session,
    project_id: int,
    user_id: int,     
    provider_override: str | None = None
) -> list[Architecture]:
    """
    Calls the LLM to generate 3 architectures for a project's requirement,
    stores them, and returns the saved rows.
    """
    project = get_owned_project(db, project_id, user_id)
    # Delete existing before generating fresh
    existing = db.query(Architecture).filter(Architecture.project_id == project_id).all()
    for arch in existing:
        db.delete(arch)
    db.commit()

    provider_name = provider_override or "openai"
    

    try:
        llm = get_llm_provider(provider_override)
        raw_architectures = llm.generate_architectures(project.requirement)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"LLM generation failed: {str(e)}")

    saved_architectures = []
    for arch_data in raw_architectures:
        architecture = Architecture(
            project_id=project.id,
            arch_type=arch_data["arch_type"],
            explanation=arch_data["explanation"],
            mermaid_diagram=arch_data["mermaid_diagram"],
            docker_compose=arch_data.get("docker_compose"),
            tradeoffs=arch_data.get("tradeoffs"),
            llm_provider=provider_name,
        )
        db.add(architecture)
        saved_architectures.append(architecture)

    project.status = "done"
    db.commit()

    for arch in saved_architectures:
        db.refresh(arch)

    return saved_architectures

def get_architectures_for_project(db: Session, project_id: int, user_id: int) -> list[Architecture]:
    get_owned_project(db, project_id, user_id)  # changed
    return db.query(Architecture).filter(Architecture.project_id == project_id).all()