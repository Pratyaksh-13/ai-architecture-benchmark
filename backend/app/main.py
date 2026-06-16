# app/main.py

from fastapi import FastAPI
from app.database.connection import Base, engine
from app.models import project  # Import model so SQLAlchemy sees it
from app.api import projects    # Import router

# Create all tables on startup (safe to run repeatedly)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Architecture Benchmarking Platform",
    description="Generate, compare, and benchmark software architectures with AI",
    version="0.1.0",
)

# Register routers
app.include_router(projects.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "AI Architecture Benchmarking Platform API", "version": "0.1.0"}