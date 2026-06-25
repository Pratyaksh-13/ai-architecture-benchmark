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

def _get_latest_benchmarks(db: Session, project_id: int) -> list[Benchmark]:
    latest_run = (
        db.query(BenchmarkRun)
        .filter(BenchmarkRun.project_id == project_id)
        .order_by(BenchmarkRun.created_at.desc())
        .first()
    )
    if not latest_run:
        return []
    return db.query(Benchmark).filter(Benchmark.run_id == latest_run.id).all()


def generate_markdown_report(db: Session, project_id: int, user_id: int) -> str:
    project = get_owned_project(db, project_id, user_id)

    architectures = db.query(Architecture).filter(Architecture.project_id == project_id).all()
    benchmarks = _get_latest_benchmarks(db, project_id)
    bm_lookup = {b.architecture_id: b for b in benchmarks}
    scores = calculate_scores(benchmarks) if benchmarks else {}

    recommendation = db.query(Recommendation).filter(Recommendation.project_id == project_id).first()

    # V4 data
    bottlenecks = (
        db.query(BottleneckFinding)
        .filter(BottleneckFinding.project_id == project_id)
        .order_by(BottleneckFinding.created_at.desc())
        .all()
    )
    projections = (
        db.query(CapacityProjection)
        .filter(CapacityProjection.project_id == project_id)
        .order_by(CapacityProjection.created_at.desc())
        .limit(3)
        .all()
    )
    costs = (
        db.query(CostEstimate)
        .filter(CostEstimate.project_id == project_id)
        .order_by(CostEstimate.created_at.desc())
        .all()
    )
    optimizations = (
        db.query(OptimizationRecommendation)
        .filter(OptimizationRecommendation.project_id == project_id)
        .order_by(OptimizationRecommendation.created_at.desc())
        .all()
    )
    evolution = (
        db.query(ArchitectureEvolution)
        .filter(ArchitectureEvolution.project_id == project_id)
        .order_by(ArchitectureEvolution.created_at.asc())
        .all()
    )
    resilience_results = (
        db.query(ResilienceResult)
        .filter(ResilienceResult.project_id == project_id)
        .order_by(ResilienceResult.created_at.desc())
        .limit(3)
        .all()
    )
    res_lookup = {r.architecture_id: r for r in resilience_results}

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = []

    # Header
    lines += [
        "# ArchBench Architecture Decision Report",
        "",
        f"**Generated:** {now}  ",
        f"**Project ID:** {project_id}  ",
        f"**Status:** {project.status}  ",
        "",
        "---",
        "",
        "## Requirement",
        "",
        f"> {project.requirement}",
        "",
        "---",
        "",
    ]

    # Architecture Summaries
    lines += ["## Architecture Summaries", ""]
    for arch in architectures:
        score = scores.get(arch.id, {})
        overall = score.get("overall_score", "N/A")
        lines += [
            f"### {arch.arch_type.replace('_', ' ').title()}",
            f"**Overall Score:** {overall}/100  ",
            f"**LLM Provider:** {arch.llm_provider}  ",
            "",
            arch.explanation or "_No explanation available._",
            "",
        ]
        if arch.tradeoffs:
            pros = arch.tradeoffs.get("pros", [])
            cons = arch.tradeoffs.get("cons", [])
            if pros:
                lines.append("**Pros:**")
                lines += [f"- {p}" for p in pros]
            if cons:
                lines += ["", "**Cons:**"]
                lines += [f"- {c}" for c in cons]
        lines.append("")

    # Benchmark Comparison
    lines += ["---", "", "## Benchmark Comparison", ""]
    if benchmarks:
        latest_run = (
            db.query(BenchmarkRun)
            .filter(BenchmarkRun.project_id == project_id)
            .order_by(BenchmarkRun.created_at.desc())
            .first()
        )
        if latest_run:
            lines += [
                f"**Load Profile:** {latest_run.load_profile}  ",
                f"**Type:** {latest_run.simulation_type}  ",
                f"**Run Date:** {latest_run.created_at.strftime('%Y-%m-%d %H:%M')}  ",
                "",
            ]

        lines += [
            "| Metric | " + " | ".join(a.arch_type.replace("_"," ").title() for a in architectures) + " |",
            "|--------|" + "|".join("--------|" for _ in architectures),
        ]
        for label, field in [
            ("p50 Latency (ms)", "latency_p50_ms"),
            ("p95 Latency (ms)", "latency_p95_ms"),
            ("p99 Latency (ms)", "latency_p99_ms"),
            ("Throughput (req/s)", "throughput_rps"),
            ("Error Rate (%)", "error_rate_pct"),
            ("CPU (%)", "cpu_usage_pct"),
            ("Memory (MB)", "memory_usage_mb"),
        ]:
            values = []
            for arch in architectures:
                bm = bm_lookup.get(arch.id)
                val = getattr(bm, field, None) if bm else None
                values.append(str(round(val, 2)) if val is not None else "N/A")
            lines.append(f"| {label} | " + " | ".join(values) + " |")

        lines += ["", "### Score Breakdown", "",
            "| Score | " + " | ".join(a.arch_type.replace("_"," ").title() for a in architectures) + " |",
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

    # Resilience Analysis
    lines += ["---", "", "## Resilience Analysis", ""]
    if resilience_results:
        lines += [
            "| Architecture | Score | Availability | Failure | Recovered | Recovery |",
            "|-------------|-------|--------------|---------|-----------|----------|",
        ]
        for r in resilience_results:
            arch = next((a for a in architectures if a.id == r.architecture_id), None)
            name = arch.arch_type.replace("_"," ").title() if arch else "Unknown"
            rec = f"{round(r.recovery_time_ms)}ms" if r.recovery_time_ms else "Never"
            lines.append(
                f"| {name} | {r.resilience_score}/100 | {r.availability_pct}% | "
                f"{r.failure_type} | {'✓' if r.recovered else '✗'} | {rec} |"
            )
        lines.append("")
    else:
        lines += ["_No resilience tests run yet._", ""]

    # V4: Bottleneck Analysis
    lines += ["---", "", "## Bottleneck Analysis", ""]
    if bottlenecks:
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        sorted_bottlenecks = sorted(bottlenecks, key=lambda b: severity_order.get(b.severity, 4))
        for b in sorted_bottlenecks:
            arch = next((a for a in architectures if a.id == b.architecture_id), None)
            arch_name = arch.arch_type.replace("_"," ").title() if arch else "Unknown"
            lines += [
                f"### [{b.severity.upper()}] {b.bottleneck_type.replace('_',' ').title()} — {arch_name}",
                "",
            ]
            for e in (b.evidence or []):
                lines.append(f"- {e}")
            if b.recommendation:
                lines += ["", f"**Recommendation:** {b.recommendation}"]
            lines.append("")
    else:
        lines += ["_No bottleneck analysis run yet. Call POST /analyze first._", ""]

    # V4: Optimization Recommendations
    lines += ["---", "", "## Optimization Recommendations", ""]
    if optimizations:
        for opt in optimizations:
            lines += [
                f"### [{opt.priority.upper()}] {opt.title}",
                "",
                opt.description,
                "",
                f"**Expected improvement:** {opt.expected_improvement}",
                "",
            ]
    else:
        lines += ["_No optimization recommendations generated yet._", ""]

    # V4: Cost Estimates
    lines += ["---", "", "## Cloud Cost Estimates", ""]
    if costs:
        lines += [
            "| Architecture | Provider | Monthly Cost (USD) | Instance | vCPU | Memory (GB) |",
            "|-------------|----------|--------------------|----------|------|-------------|",
        ]
        for c in costs:
            arch = next((a for a in architectures if a.id == c.architecture_id), None)
            arch_name = arch.arch_type.replace("_"," ").title() if arch else "Unknown"
            lines.append(
                f"| {arch_name} | {c.provider.upper()} | ${c.estimated_monthly_usd} | "
                f"{c.instance_recommendation} | {c.cpu_units} | {c.memory_gb} |"
            )
        lines.append("")
    else:
        lines += ["_No cost estimates generated yet._", ""]

    # V4: Capacity Projections
    lines += ["---", "", "## Capacity Projections", ""]
    if projections:
        for p in projections:
            arch = next((a for a in architectures if a.id == p.architecture_id), None)
            arch_name = arch.arch_type.replace("_"," ").title() if arch else "Unknown"
            ratio = round(p.expected_users / p.current_users, 1) if p.current_users else "N/A"
            lines += [
                f"### {arch_name} — {p.current_users:,} → {p.expected_users:,} users ({ratio}x growth)",
                "",
                f"- Projected p95 latency: {p.projected_latency_p95_ms}ms",
                f"- Projected throughput: {p.projected_throughput_rps} req/s",
                f"- Scaling recommendation: {p.scaling_recommendation}",
                "",
            ]
            if p.expected_bottlenecks:
                lines.append("**Expected bottlenecks:**")
                for b in p.expected_bottlenecks:
                    lines.append(f"- {b}")
            lines.append("")
    else:
        lines += ["_No capacity projections generated yet._", ""]

    # V4: Evolution Timeline
    lines += ["---", "", "## Architecture Evolution Timeline", ""]
    if evolution:
        for i, step in enumerate(evolution):
            arrow = "→" if step.from_arch_type else "◉"
            from_name = step.from_arch_type.replace("_"," ").title() if step.from_arch_type else "Origin"
            to_name = step.to_arch_type.replace("_"," ").title()
            lines.append(f"{i+1}. **{from_name}** {arrow} **{to_name}**  ")
            lines.append(f"   _Trigger: {step.trigger} · {step.created_at.strftime('%Y-%m-%d')}_")
            if step.notes:
                lines.append(f"   {step.notes}")
            lines.append("")
    else:
        lines += ["_No evolution history yet._", ""]

    # AI Recommendation
    lines += ["---", "", "## AI Recommendation", ""]
    if recommendation:
        lines += [
            f"**Recommended:** {recommendation.recommended_arch_type.replace('_',' ').title()}  ",
            f"**Confidence:** {round(recommendation.confidence_score * 100)}%  ",
            "",
            recommendation.reasoning,
            "",
        ]
    else:
        lines += ["_No recommendation generated yet._", ""]

    lines += [
        "---",
        "",
        "_Generated by [ArchBench](https://github.com/Pratyaksh-13/ai-architecture-benchmark)_",
    ]

    return "\n".join(lines)

def generate_pdf_report(db: Session, project_id: int, user_id: int) -> bytes:
    """Converts the Markdown report to PDF via weasyprint."""
    import markdown2
    from weasyprint import HTML, CSS

    md_content = generate_markdown_report(db, project_id, user_id)

    html_content = markdown2.markdown(
        md_content,
        extras=["tables", "fenced-code-blocks"],
    )

    styled_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{
                font-family: 'Georgia', serif;
                max-width: 900px;
                margin: 40px auto;
                padding: 0 40px;
                color: #1B2330;
                background: #F2EFE6;
                line-height: 1.6;
            }}
            h1 {{ color: #2952A3; border-bottom: 2px solid #2952A3; padding-bottom: 8px; }}
            h2 {{ color: #2952A3; border-bottom: 1px solid #C9C2AE; padding-bottom: 4px; margin-top: 32px; }}
            h3 {{ color: #1B2330; margin-top: 24px; }}
            blockquote {{
                border-left: 4px solid #2952A3;
                margin: 0;
                padding: 8px 16px;
                background: #E8E4D8;
                color: #6B6558;
                font-style: italic;
            }}
            table {{
                border-collapse: collapse;
                width: 100%;
                margin: 16px 0;
                font-size: 13px;
            }}
            th {{
                background: #2952A3;
                color: white;
                padding: 8px 12px;
                text-align: left;
            }}
            td {{
                border: 1px solid #C9C2AE;
                padding: 6px 12px;
            }}
            tr:nth-child(even) td {{ background: #E8E4D8; }}
            code {{
                background: #E8E4D8;
                padding: 2px 6px;
                border-radius: 3px;
                font-size: 12px;
                font-family: 'Courier New', monospace;
            }}
            hr {{ border: none; border-top: 1px solid #C9C2AE; margin: 24px 0; }}
            .footer {{ font-size: 11px; color: #6B6558; text-align: center; margin-top: 40px; }}
        </style>
    </head>
    <body>
        {html_content}
    </body>
    </html>
    """

    pdf_bytes = HTML(string=styled_html).write_pdf()
    return pdf_bytes