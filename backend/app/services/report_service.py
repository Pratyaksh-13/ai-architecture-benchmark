# app/services/report_service.py

from sqlalchemy.orm import Session
from datetime import datetime
from app.models.project import Project
from app.models.architecture import Architecture
from app.models.benchmark import Benchmark
from app.models.benchmark_run import BenchmarkRun
from app.models.recommendation import Recommendation
from app.models.resilience_result import ResilienceResult
from app.services.project_service import get_owned_project
from app.services.scoring_service import calculate_scores
from app.models.bottleneck_finding import BottleneckFinding
from app.models.capacity_projection import CapacityProjection
from app.models.cost_estimate import CostEstimate
from app.models.optimization_recommendation import OptimizationRecommendation
from app.models.architecture_evolution import ArchitectureEvolution
from app.services.recommendation_service import (
    _detect_signals, _extract_user_count, _compute_requirement_fitness, SIGNAL_LABEL
)

ARCH_LABEL = {
    "monolithic": "Monolithic",
    "microservices": "Microservices",
    "event_driven": "Event-Driven",
}


def _get_latest_run_and_benchmarks(db, project_id):
    latest_run = (
        db.query(BenchmarkRun)
        .filter(BenchmarkRun.project_id == project_id)
        .order_by(BenchmarkRun.created_at.desc())
        .first()
    )
    if not latest_run:
        return None, []
    return latest_run, db.query(Benchmark).filter(Benchmark.run_id == latest_run.id).all()


def _confidence_label(score: float) -> str:
    if score >= 0.85: return "Very High"
    if score >= 0.70: return "High"
    if score >= 0.55: return "Moderate"
    return "Low"


def generate_markdown_report(db: Session, project_id: int, user_id: int) -> str:
    project = get_owned_project(db, project_id, user_id)
    architectures = db.query(Architecture).filter(Architecture.project_id == project_id).all()
    latest_run, benchmarks = _get_latest_run_and_benchmarks(db, project_id)
    bm_lookup = {b.architecture_id: b for b in benchmarks}
    scores = calculate_scores(benchmarks) if benchmarks else {}
    recommendation = db.query(Recommendation).filter(Recommendation.project_id == project_id).first()

    bottlenecks = db.query(BottleneckFinding).filter(BottleneckFinding.project_id == project_id).order_by(BottleneckFinding.created_at.desc()).all()
    projections = db.query(CapacityProjection).filter(CapacityProjection.project_id == project_id).order_by(CapacityProjection.created_at.desc()).limit(3).all()
    costs = db.query(CostEstimate).filter(CostEstimate.project_id == project_id).order_by(CostEstimate.created_at.desc()).all()
    optimizations = db.query(OptimizationRecommendation).filter(OptimizationRecommendation.project_id == project_id).order_by(OptimizationRecommendation.created_at.desc()).all()
    evolution = db.query(ArchitectureEvolution).filter(ArchitectureEvolution.project_id == project_id).order_by(ArchitectureEvolution.created_at.asc()).all()
    resilience_results = db.query(ResilienceResult).filter(ResilienceResult.project_id == project_id).order_by(ResilienceResult.created_at.desc()).limit(3).all()

    # Recompute fitness for report (not stored in DB)
    signals = _detect_signals(project.requirement)
    user_count = _extract_user_count(project.requirement)
    active_signals = [k for k, v in signals.items() if v]
    fitness_by_arch = {
        arch.arch_type: _compute_requirement_fitness(arch.arch_type, signals, user_count)
        for arch in architectures
    }

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = []

    # ── Header ────────────────────────────────────────────────────────────────
    lines += [
        "# ArchBench Architecture Decision Report",
        "",
        f"**Generated:** {now} &nbsp;|&nbsp; **Project ID:** {project_id} &nbsp;|&nbsp; **Status:** {project.status.upper()}",
        "",
        "---",
        "",
    ]

    # ── Executive Summary ─────────────────────────────────────────────────────
    if recommendation:
        rec_label = ARCH_LABEL.get(recommendation.recommended_arch_type, recommendation.recommended_arch_type)
        bench_label = ARCH_LABEL.get(recommendation.benchmark_winner or "", recommendation.benchmark_winner or "N/A")
        confidence_pct = round((recommendation.confidence_score or 0) * 100)
        conf_label = _confidence_label(recommendation.confidence_score or 0)
        agrees = recommendation.benchmark_agrees

        lines += [
            "## Executive Summary",
            "",
            "| Field | Value |",
            "|-------|-------|",
            f"| **Recommended Architecture** | **{rec_label}** |",
            f"| **Confidence** | {confidence_pct}% — {conf_label} |",
            f"| **Benchmark Winner** | {bench_label} ({round(recommendation.benchmark_winner_score or 0, 1)}/100) |",
            f"| **Fitness Score** | {round(recommendation.fitness_score or 0, 1)}/100 |",
            f"| **Benchmark Agreement** | {'✅ Agree' if agrees else '⚠️ Override — fitness takes precedence'} |",
            "",
        ]

        if agrees:
            lines += [f"> ✅ Both benchmark performance and requirement fitness point to **{rec_label}** as the optimal architecture.", ""]
        else:
            lines += [
                f"> ⚠️ **{bench_label}** achieved better benchmark metrics, but requirement fitness analysis recommends **{rec_label}** for production.",
                f"> Benchmark scores reflect synthetic test performance. The production recommendation additionally accounts for scalability, async workloads, fault isolation, and long-term architectural fit.",
                "",
            ]

        if recommendation.production_recommendation:
            lines += ["**Decision Statement:**", "", f"> {recommendation.production_recommendation}", ""]

    # ── Requirement ───────────────────────────────────────────────────────────
    lines += ["---", "", "## Requirement", "", f"> {project.requirement}", ""]

    # ── Architecture Decision Process ─────────────────────────────────────────
    if recommendation and active_signals:
        rec_label = ARCH_LABEL.get(recommendation.recommended_arch_type, recommendation.recommended_arch_type)
        bench_label = ARCH_LABEL.get(recommendation.benchmark_winner or "", "N/A")
        prod_fitness = fitness_by_arch.get(recommendation.recommended_arch_type, {})

        lines += ["---", "", "## Architecture Decision Process", ""]

        lines += ["### Requirement Analysis", ""]
        for sig in active_signals:
            label = SIGNAL_LABEL.get(sig, sig.replace("_", " ").title())
            lines.append(f"- ✓ **{label}**")
        lines += ["", f"_Detected {len(active_signals)} architectural signals from the requirement description._", ""]

        lines += [
            "### Decision Logic",
            "",
            f"| Step | Output |",
            f"|------|--------|",
            f"| Benchmark Winner | {bench_label} ({round(recommendation.benchmark_winner_score or 0, 1)}/100) |",
            f"| Architecture Fitness Winner | {rec_label} ({round(recommendation.fitness_score or 0, 1)}/100) |",
            f"| Final Recommendation | **{rec_label}** |",
            f"| Benchmark Agreement | {'Yes' if recommendation.benchmark_agrees else 'No — fitness overrides benchmark'} |",
            "",
        ]

        if not recommendation.benchmark_agrees:
            lines += [
                "> Although the benchmark favored a different architecture, the requirement signals indicate",
                f"> that **{rec_label}** is better suited for the long-term workload characteristics of this system.",
                "",
            ]

    # ── Architecture Fitness ──────────────────────────────────────────────────
    if fitness_by_arch:
        lines += ["---", "", "## Architecture Fitness Analysis", ""]
        lines += [
            "Fitness scores measure how well each architecture suits the **stated requirements** — independent of benchmark performance.",
            "",
        ]

        for arch in architectures:
            label = ARCH_LABEL.get(arch.arch_type, arch.arch_type)
            fitness = fitness_by_arch.get(arch.arch_type, {})
            overall = fitness.get("fitness_score", 0)
            cats = fitness.get("categories", {})
            is_rec = recommendation and arch.arch_type == recommendation.recommended_arch_type

            badge = " ⭐ Recommended" if is_rec else ""
            lines += [f"### {label}{badge}", "", f"**Overall Fitness: {overall}/100**", ""]

            if cats:
                lines += ["| Dimension | Score |", "|-----------|-------|"]
                for dim, score in sorted(cats.items(), key=lambda x: x[1], reverse=True):
                    bar = "▓" * (score // 10) + "░" * (10 - score // 10)
                    lines.append(f"| {dim} | {score}/100 |")
            lines.append("")

    # ── Benchmark Results ─────────────────────────────────────────────────────
    lines += ["---", "", "## Benchmark Results", ""]
    if benchmarks:
        if latest_run:
            lines += [
                f"**Load Profile:** {latest_run.load_profile.upper()} &nbsp;|&nbsp; "
                f"**Type:** {latest_run.simulation_type.upper()} &nbsp;|&nbsp; "
                f"**Run Date:** {latest_run.created_at.strftime('%Y-%m-%d %H:%M')}",
                "",
            ]

        arch_headers = " | ".join(ARCH_LABEL.get(a.arch_type, a.arch_type) for a in architectures)
        lines += [
            f"| Metric | {arch_headers} |",
            "|--------|" + "|".join("--------|" for _ in architectures),
        ]
        for label, field in [
            ("p50 Latency (ms)", "latency_p50_ms"),
            ("p95 Latency (ms)", "latency_p95_ms"),
            ("p99 Latency (ms)", "latency_p99_ms"),
            ("Throughput (req/s)", "throughput_rps"),
            ("Error Rate (%)", "error_rate_pct"),
        ]:
            values = []
            for arch in architectures:
                bm = bm_lookup.get(arch.id)
                val = getattr(bm, field, None) if bm else None
                values.append(str(round(val, 2)) if val is not None else "—")
            lines.append(f"| {label} | " + " | ".join(values) + " |")

        # Infrastructure metrics
        has_cpu = any(bm_lookup.get(a.id) and bm_lookup[a.id].cpu_usage_pct is not None for a in architectures)
        if has_cpu:
            for label, field in [("CPU (%)", "cpu_usage_pct"), ("Memory (MB)", "memory_usage_mb")]:
                values = []
                for arch in architectures:
                    bm = bm_lookup.get(arch.id)
                    val = getattr(bm, field, None) if bm else None
                    values.append(str(round(val, 2)) if val is not None else "—")
                lines.append(f"| {label} | " + " | ".join(values) + " |")
        else:
            lines += ["", "_Infrastructure metrics (CPU, memory) were not collected in this benchmark run. These require a docker stats poller running alongside k6._"]

        lines += ["", "### Score Breakdown", ""]
        lines += [
            f"| Score | {arch_headers} |",
            "|-------|" + "|".join("--------|" for _ in architectures),
        ]
        for label, field in [
            ("Latency Score", "latency_score"),
            ("Throughput Score", "throughput_score"),
            ("Reliability Score", "reliability_score"),
            ("Efficiency Score", "efficiency_score"),
            ("**Overall Score**", "overall_score"),
        ]:
            values = [str(scores.get(a.id, {}).get(field, "N/A")) for a in architectures]
            lines.append(f"| {label} | " + " | ".join(values) + " |")
        lines.append("")
    else:
        lines += ["_No benchmarks run yet._", ""]

    # ── Resilience Analysis ───────────────────────────────────────────────────
    lines += ["---", "", "## Resilience Analysis", ""]
    if resilience_results:
        lines += [
            "| Architecture | Score | Availability | Failure Type | Recovered | Recovery Time |",
            "|-------------|-------|--------------|-------------|-----------|---------------|",
        ]
        for r in resilience_results:
            arch = next((a for a in architectures if a.id == r.architecture_id), None)
            name = ARCH_LABEL.get(arch.arch_type, arch.arch_type) if arch else "Unknown"
            rec_time = f"{round(r.recovery_time_ms)}ms" if r.recovery_time_ms else "—"
            failure = r.failure_type.replace("_", " ").title() if r.failure_type else "—"
            lines.append(f"| {name} | {r.resilience_score}/100 | {r.availability_pct}% | {failure} | {'✓' if r.recovered else '✗'} | {rec_time} |")
        lines.append("")
    else:
        lines += ["_No resilience tests run yet. Run a real benchmark to collect resilience data._", ""]

    # ── Bottleneck Analysis ───────────────────────────────────────────────────
    lines += ["---", "", "## Bottleneck Analysis", ""]
    if bottlenecks:
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        for b in sorted(bottlenecks, key=lambda x: severity_order.get(x.severity, 4)):
            arch = next((a for a in architectures if a.id == b.architecture_id), None)
            arch_name = ARCH_LABEL.get(arch.arch_type, arch.arch_type) if arch else "Unknown"
            lines += [f"### [{b.severity.upper()}] {b.bottleneck_type.replace('_',' ').title()} — {arch_name}", ""]
            for e in (b.evidence or []):
                lines.append(f"- {e}")
            if b.recommendation:
                lines += ["", f"**Recommendation:** {b.recommendation}"]
            lines.append("")
    else:
        lines += ["_No bottleneck analysis run yet. Run V4 Analysis to generate findings._", ""]

    # ── Optimization Recommendations ──────────────────────────────────────────
    lines += ["---", "", "## Optimization Recommendations", ""]
    if optimizations:
        for opt in optimizations:
            lines += [f"### [{opt.priority.upper()}] {opt.title}", "", opt.description, "", f"**Expected improvement:** {opt.expected_improvement}", ""]
    else:
        lines += ["_No optimization recommendations generated yet._", ""]

    # ── Cloud Cost Estimates ──────────────────────────────────────────────────
    lines += ["---", "", "## Cloud Cost Estimates", ""]
    if costs:
        lines += [
            "| Architecture | Provider | Monthly Cost (USD) | Instance | vCPU | Memory (GB) |",
            "|-------------|----------|--------------------|----------|------|-------------|",
        ]
        for c in costs:
            arch = next((a for a in architectures if a.id == c.architecture_id), None)
            arch_name = ARCH_LABEL.get(arch.arch_type, arch.arch_type) if arch else "Unknown"
            lines.append(f"| {arch_name} | {c.provider.upper()} | ${c.estimated_monthly_usd:.2f} | {c.instance_recommendation} | {c.cpu_units} | {c.memory_gb} |")
        lines.append("")
    else:
        lines += ["_No cost estimates generated yet._", ""]

    # ── Capacity Projections ──────────────────────────────────────────────────
    lines += ["---", "", "## Capacity Projections", ""]
    if projections:
        lines += [
            "_Note: Projections use heuristic scaling models. Assumes horizontal scaling, caching, and database optimization are available._",
            "",
        ]
        for p in projections:
            arch = next((a for a in architectures if a.id == p.architecture_id), None)
            arch_name = ARCH_LABEL.get(arch.arch_type, arch.arch_type) if arch else "Unknown"
            ratio = f"{round(p.expected_users / p.current_users, 1)}x" if p.current_users else "N/A"
            lines += [
                f"### {arch_name} — {p.current_users:,} → {p.expected_users:,} users ({ratio} growth)",
                "",
                f"| Metric | Projected Value |",
                f"|--------|----------------|",
                f"| p95 Latency | {p.projected_latency_p95_ms}ms |",
                f"| Throughput | {p.projected_throughput_rps} req/s |",
                "",
                f"**Scaling Strategy:** {p.scaling_recommendation}",
                "",
            ]
            if p.expected_bottlenecks:
                lines.append("**Expected Bottlenecks:**")
                for b in p.expected_bottlenecks:
                    lines.append(f"- {b}")
            lines.append("")
    else:
        lines += ["_No capacity projections generated yet._", ""]

    # ── Evolution Timeline ────────────────────────────────────────────────────
    lines += ["---", "", "## Architecture Evolution Timeline", ""]
    if evolution:
        for i, step in enumerate(evolution):
            arrow = "→" if step.from_arch_type else "◉"
            from_name = ARCH_LABEL.get(step.from_arch_type, step.from_arch_type) if step.from_arch_type else "Origin"
            to_name = ARCH_LABEL.get(step.to_arch_type, step.to_arch_type)
            lines.append(f"{i+1}. **{from_name}** {arrow} **{to_name}**  ")
            lines.append(f"   _Trigger: {step.trigger} · {step.created_at.strftime('%Y-%m-%d')}_")
            if step.notes:
                lines.append(f"   {step.notes}")
            lines.append("")
    else:
        lines += ["_No evolution history yet._", ""]

    # ── Final Recommendation ──────────────────────────────────────────────────
    lines += ["---", "", "## Final Recommendation", ""]
    if recommendation:
        rec_label = ARCH_LABEL.get(recommendation.recommended_arch_type, recommendation.recommended_arch_type)
        bench_label = ARCH_LABEL.get(recommendation.benchmark_winner or "", "N/A")
        confidence_pct = round((recommendation.confidence_score or 0) * 100)
        agrees = recommendation.benchmark_agrees

        lines += [
            f"**Recommended Architecture:** {rec_label}  ",
            f"**Confidence:** {confidence_pct}% — {_confidence_label(recommendation.confidence_score or 0)}  ",
            f"**Provider:** {recommendation.llm_provider.upper()}",
            "",
            "### Reasoning",
            "",
            recommendation.reasoning,
            "",
        ]

        if not agrees:
            lines += [
                "### Trade-off Analysis",
                "",
                f"Although **{bench_label}** demonstrated stronger benchmark performance under the synthetic test workload, "
                f"**{rec_label}** is recommended for production. "
                f"The benchmark measures current implementation performance in a controlled environment — "
                f"it does not capture long-term scalability, independent deployment needs, asynchronous workload suitability, "
                f"or organizational scaling requirements. "
                f"The requirement fitness analysis identified signals that make **{rec_label}** the more appropriate production architecture.",
                "",
            ]

        if recommendation.production_recommendation:
            lines += ["### Production Deployment Summary", "", f"> {recommendation.production_recommendation}", ""]

    else:
        lines += ["_No recommendation generated yet. Click Re-evaluate to generate._", ""]

    # ── Footer ────────────────────────────────────────────────────────────────
    lines += [
        "---",
        "",
        "_Generated by [ArchBench](https://github.com/Pratyaksh-13/ai-architecture-benchmark) — Architecture Decision Intelligence Engine_",
    ]

    return "\n".join(lines)


def generate_pdf_report(db: Session, project_id: int, user_id: int) -> bytes:
    import markdown2
    from weasyprint import HTML

    md_content = generate_markdown_report(db, project_id, user_id)
    html_content = markdown2.markdown(md_content, extras=["tables", "fenced-code-blocks"])

    styled_html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: Georgia, serif; max-width: 900px; margin: 40px auto; padding: 0 40px; color: #1B2330; background: #F2EFE6; line-height: 1.6; }}
        h1 {{ color: #2952A3; border-bottom: 2px solid #2952A3; padding-bottom: 8px; font-size: 1.8rem; }}
        h2 {{ color: #2952A3; border-bottom: 1px solid #C9C2AE; padding-bottom: 4px; margin-top: 32px; font-size: 1.3rem; }}
        h3 {{ color: #1B2330; margin-top: 20px; font-size: 1.1rem; }}
        blockquote {{ border-left: 4px solid #2952A3; margin: 12px 0; padding: 8px 16px; background: #E8E4D8; color: #4A4035; font-style: italic; }}
        table {{ border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 13px; }}
        th {{ background: #2952A3; color: white; padding: 8px 12px; text-align: left; font-weight: 600; }}
        td {{ border: 1px solid #C9C2AE; padding: 6px 12px; }}
        tr:nth-child(even) td {{ background: #E8E4D8; }}
        ul {{ padding-left: 1.5rem; }}
        li {{ margin-bottom: 4px; }}
        code {{ background: #E8E4D8; padding: 2px 6px; border-radius: 3px; font-size: 12px; font-family: "Courier New", monospace; }}
        hr {{ border: none; border-top: 1px solid #C9C2AE; margin: 28px 0; }}
        strong {{ color: #1B2330; }}
    </style>
</head>
<body>{html_content}</body>
</html>"""

    return HTML(string=styled_html).write_pdf()
