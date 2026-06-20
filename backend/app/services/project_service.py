# app/services/project_service.py

from sqlalchemy.orm import Session
from app.models.project import Project
from app.schemas.project import ProjectCreate
from fastapi import HTTPException

def create_project(db: Session, data: ProjectCreate, user_id: int | None = None) -> Project:
    """Create a new project from a user requirement."""
    project = Project(
        requirement=data.requirement,
        status="pending",
        user_id=user_id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)  # Reload from DB to get auto-generated id, created_at etc.
    return project


def get_all_projects(db: Session) -> list[Project]:
    """Return all projects, newest first."""
    return db.query(Project).order_by(Project.created_at.desc()).all()


def get_project_by_id(db: Session, project_id: int) -> Project:
    """Return a single project, or raise 404 if not found."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project


def delete_project(db: Session, project_id: int) -> dict:
    """Delete a project by ID."""
    project = get_project_by_id(db, project_id)  # Raises 404 if missing
    db.delete(project)
    db.commit()
    return {"message": f"Project {project_id} deleted successfully"}