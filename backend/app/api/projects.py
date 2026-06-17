# app/api/projects.py
from app.schemas.architecture import GenerateRequest, GenerateResponse
from app.services.architecture_service import (
    generate_architectures_for_project,
    get_architectures_for_project,
)
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectListResponse
from app.services.project_service import (
    create_project,
    get_all_projects,
    get_project_by_id,
    delete_project,
)

router = APIRouter(
    prefix="/projects",
    tags=["Projects"],          # Groups endpoints in Swagger UI
)


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_new_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    """
    Create a new architecture benchmarking project.
    Accepts a natural language requirement.
    """
    return create_project(db, payload)


@router.get("/", response_model=ProjectListResponse)
def list_projects(db: Session = Depends(get_db)):
    """Return all projects ordered by creation date (newest first)."""
    projects = get_all_projects(db)
    return {"total": len(projects), "projects": projects}


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Return a single project by ID."""
    return get_project_by_id(db, project_id)


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
def remove_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a project by ID."""
    return delete_project(db, project_id)



@router.post("/{project_id}/generate", response_model=GenerateResponse)
def generate_architectures(
    project_id: int,
    payload: GenerateRequest,
    db: Session = Depends(get_db)
):
    """
    Trigger LLM architecture generation for a project.
    Optionally specify 'provider': 'claude' or 'openai' in the request body.
    """
    architectures = generate_architectures_for_project(db, project_id, payload.provider)
    return {"project_id": project_id, "architectures": architectures}


@router.get("/{project_id}/architectures", response_model=GenerateResponse)
def list_architectures(project_id: int, db: Session = Depends(get_db)):
    """Return all previously generated architectures for a project."""
    architectures = get_architectures_for_project(db, project_id)
    return {"project_id": project_id, "architectures": architectures}