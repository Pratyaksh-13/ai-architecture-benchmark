# app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.connection import Base, engine
from app.api import projects
from app.auth.router import router as auth_router
from app.models import (
    project, architecture, benchmark, benchmark_run,
    recommendation, user, resilience_result,
    bottleneck_finding, capacity_projection, cost_estimate,
    service_split_recommendation, architecture_evolution,
    optimization_recommendation,
)
from app.worker import tasks
from app.api import v4


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Architecture Benchmarking Platform",
    description="Generate, compare, and benchmark software architectures with AI",
    version="0.1.0",
)



from app.core.config import settings as _settings

# Build the set of allowed origins.
# allow_origin_regex covers Lovable preview URLs, localhost dev ports, and ngrok tunnels.
# allow_origins explicitly adds whatever FRONTEND_URL is set to (e.g. the EC2 public IP).
_cors_origins = []
if _settings.frontend_url:
    _cors_origins.append(_settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"https://.*\.lovable\.app|http://localhost:5173|http://localhost:8080|http://localhost:3000|https://.*\.ngrok-free\.(app|dev)|http://\d+\.\d+\.\d+\.\d+(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(projects.router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(v4.router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "AI Architecture Benchmarking Platform API", "version": "0.1.0"}