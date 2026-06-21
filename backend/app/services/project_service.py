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
    db.refresh(project)
    return project


def get_all_projects(db: Session, user_id: int) -> list[Project]:
    """Return all projects belonging to the given user, newest first."""
    return (
        db.query(Project)
        .filter(Project.user_id == user_id)
        .order_by(Project.created_at.desc())
        .all()
    )


def get_project_by_id(db: Session, project_id: int) -> Project:
    """Return a single project, or raise 404 if not found."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project


def get_owned_project(db: Session, project_id: int, user_id: int) -> Project:
    """
    Return a project only if it belongs to the given user.
    Raises 404 (not 403) if the project exists but belongs to someone else —
    this avoids leaking whether a given project ID exists at all to non-owners.
    """
    project = get_project_by_id(db, project_id)
    if project.user_id != user_id:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project


def delete_project(db: Session, project_id: int, user_id: int) -> dict:
    """Delete a project by ID, only if owned by the given user."""
    project = get_owned_project(db, project_id, user_id)
    db.delete(project)
    db.commit()
    return {"message": f"Project {project_id} deleted successfully"}

