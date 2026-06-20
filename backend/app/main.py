# app/main.py

from fastapi import FastAPI
from app.database.connection import Base, engine
from app.models import project, architecture  # Import both models
from app.api import projects
from app.models import project, architecture, benchmark  # add benchmark
from app.models import project, architecture, benchmark, recommendation

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Architecture Benchmarking Platform",
    description="Generate, compare, and benchmark software architectures with AI",
    version="0.1.0",
)

app.include_router(projects.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "AI Architecture Benchmarking Platform API", "version": "0.1.0"}