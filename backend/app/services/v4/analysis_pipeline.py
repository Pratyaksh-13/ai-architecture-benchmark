# app/services/v4/analysis_pipeline.py

from sqlalchemy.orm import Session

from app.models.architecture import Architecture
from app.models.benchmark import Benchmark
from app.models.benchmark_run import BenchmarkRun
from app.models.bottleneck_finding import BottleneckFinding
from app.models.cost_estimate import CostEstimate
from app.models.optimization_recommendation import OptimizationRecommendation
from app.services.project_service import get_owned_project
from app.services.v4.bottleneck_service import analyze_bottlenecks
from app.services.v4.cost_service import estimate_costs
from app.services.v4.optimization_service import generate_optimization_recommendations
from app.services.v4.evolution_service import record_evolution_step


def run_full_analysis(
    db: Session,
    project_id: int,
    user_id: int,
) -> dict:
    """
    Runs the complete V4 analysis pipeline for a project's latest benchmark run.
    Saves all results to DB. Should be called as a Celery task for large projects.
    """
    get_owned_project(db, project_id, user_id)

    architectures = (
        db.query(Architecture)
        .filter(Architecture.project_id == project_id)
        .all()
    )
    if not architectures:
        raise ValueError("No architectures found — generate architectures first")

    latest_run = (
        db.query(BenchmarkRun)
        .filter(BenchmarkRun.project_id == project_id)
        .order_by(BenchmarkRun.created_at.desc())
        .first()
    )
    if not latest_run:
        raise ValueError("No benchmarks found — run a benchmark first")

    benchmarks = db.query(Benchmark).filter(Benchmark.run_id == latest_run.id).all()
    bm_lookup = {b.architecture_id: b for b in benchmarks}

    # Clear previous analysis for this project to keep results fresh
    db.query(BottleneckFinding).filter(BottleneckFinding.project_id == project_id).delete()
    db.query(CostEstimate).filter(CostEstimate.project_id == project_id).delete()
    db.query(OptimizationRecommendation).filter(OptimizationRecommendation.project_id == project_id).delete()
    db.commit()

    results = {
        "project_id": project_id,
        "benchmark_run_id": latest_run.id,
        "bottlenecks": [],
        "optimizations": [],
        "costs": [],
        "evolution_entries": [],
    }

    for arch in architectures:
        bm = bm_lookup.get(arch.id)
        if not bm:
            continue

        # 1. Bottleneck analysis
        findings = analyze_bottlenecks(bm, arch.arch_type)
        for f in findings:
            finding = BottleneckFinding(
                benchmark_run_id=latest_run.id,
                project_id=project_id,
                architecture_id=arch.id,
                bottleneck_type=f["bottleneck_type"],
                severity=f["severity"],
                evidence=f["evidence"],
                recommendation=f.get("recommendation"),
            )
            db.add(finding)
        results["bottlenecks"].extend(findings)

        # 2. Optimization recommendations
        optimizations = generate_optimization_recommendations(bm, findings)
        for opt in optimizations:
            rec = OptimizationRecommendation(
                project_id=project_id,
                benchmark_run_id=latest_run.id,
                recommendation_type=opt["recommendation_type"],
                priority=opt["priority"],
                title=opt["title"],
                description=opt["description"],
                expected_improvement=opt["expected_improvement"],
                evidence_metrics=opt["evidence_metrics"],
            )
            db.add(rec)
        results["optimizations"].extend(optimizations)

        # 3. Cost estimation
        cost_estimates = estimate_costs(arch.arch_type, bm)
        for est in cost_estimates:
            ce = CostEstimate(
                project_id=project_id,
                architecture_id=arch.id,
                benchmark_run_id=latest_run.id,
                provider=est["provider"],
                cpu_units=est["cpu_units"],
                memory_gb=est["memory_gb"],
                estimated_monthly_usd=est["estimated_monthly_usd"],
                instance_recommendation=est["instance_recommendation"],
                cost_breakdown=est["cost_breakdown"],
            )
            db.add(ce)
        results["costs"].extend(cost_estimates)

        # 4. Evolution timeline
        entry = record_evolution_step(
            db=db,
            project_id=project_id,
            to_arch_type=arch.arch_type,
            trigger="benchmark_analyzed",
            benchmark_run_id=latest_run.id,
            notes=f"Analysis run after {latest_run.simulation_type} benchmark ({latest_run.load_profile} load profile)",
        )
        results["evolution_entries"].append(arch.arch_type)

    db.commit()

    return {
        "project_id": project_id,
        "benchmark_run_id": latest_run.id,
        "bottleneck_count": len(results["bottlenecks"]),
        "optimization_count": len(results["optimizations"]),
        "cost_estimate_count": len(results["costs"]),
        "architectures_analyzed": len(architectures),
        "status": "complete",
    }
