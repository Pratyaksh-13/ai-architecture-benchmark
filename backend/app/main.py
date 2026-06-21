# app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.connection import Base, engine
from app.models import project, architecture, benchmark, recommendation, user
from app.api import projects
from app.auth.router import router as auth_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Architecture Benchmarking Platform",
    description="Generate, compare, and benchmark software architectures with AI",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https://.*\.lovable\.app|http://localhost:5173|http://localhost:8080|https://.*\.ngrok-free\.(app|dev)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "AI Architecture Benchmarking Platform API", "version": "0.1.0"}