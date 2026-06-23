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
    """
    Generates a complete Markdown report for a project — requirement,
    architecture summaries, benchmark comparison, resilience results,
    scoring breakdown, and AI recommendation.
    """
    project = get_owned_project(db, project_id, user_id)

    architectures = (
        db.query(Architecture)
        .filter(Architecture.project_id == project_id)
        .all()
    )

    benchmarks = _get_latest_benchmarks(db, project_id)
    bm_lookup = {b.architecture_id: b for b in benchmarks}

    scores = calculate_scores(benchmarks) if benchmarks else {}

    resilience_results = (
        db.query(ResilienceResult)
        .filter(ResilienceResult.project_id == project_id)
        .order_by(ResilienceResult.created_at.desc())
        .limit(3)
        .all()
    )
    res_lookup = {r.architecture_id: r for r in resilience_results}

    recommendation = (
        db.query(Recommendation)
        .filter(Recommendation.project_id == project_id)
        .first()
    )

    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    lines = []

    # Header
    lines += [
        "# ArchBench Architecture Report",
        f"",
        f"**Generated:** {now}  ",
        f"**Project ID:** {project_id}  ",
        f"**Status:** {project.status}  ",
        f"",
        "---",
        "",
        "## Requirement",
        "",
        f"> {project.requirement}",
        "",
        "---",
        "",
    ]

    # Architecture summaries
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
                lines.append("")
                lines.append("**Cons:**")
                lines += [f"- {c}" for c in cons]
        lines.append("")

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

        # Benchmark table
        lines += [
            "| Metric | " + " | ".join(
                arch.arch_type.replace("_", " ").title() for arch in architectures
            ) + " |",
            "|--------|" + "|".join("--------|" for _ in architectures),
        ]

        metrics = [
            ("p50 Latency (ms)", "latency_p50_ms"),
            ("p95 Latency (ms)", "latency_p95_ms"),
            ("p99 Latency (ms)", "latency_p99_ms"),
            ("Throughput (req/s)", "throughput_rps"),
            ("Error Rate (%)", "error_rate_pct"),
            ("CPU Usage (%)", "cpu_usage_pct"),
            ("Memory (MB)", "memory_usage_mb"),
        ]

        for label, field in metrics:
            values = []
            for arch in architectures:
                bm = bm_lookup.get(arch.id)
                val = getattr(bm, field, None) if bm else None
                values.append(str(round(val, 2)) if val is not None else "N/A")
            lines.append(f"| {label} | " + " | ".join(values) + " |")

        lines += [""]

        # Score breakdown table
        lines += [
            "### Score Breakdown",
            "",
            "| Score | " + " | ".join(
                arch.arch_type.replace("_", " ").title() for arch in architectures
            ) + " |",
            "|-------|" + "|".join("--------|" for _ in architectures),
        ]

        score_fields = [
            ("Latency Score", "latency_score"),
            ("Throughput Score", "throughput_score"),
            ("Reliability Score", "reliability_score"),
            ("Efficiency Score", "efficiency_score"),
            ("**Overall Score**", "overall_score"),
        ]

        for label, field in score_fields:
            values = []
            for arch in architectures:
                s = scores.get(arch.id, {})
                val = s.get(field)
                values.append(str(val) if val is not None else "N/A")
            lines.append(f"| {label} | " + " | ".join(values) + " |")

        lines += [""]
    else:
        lines += ["_No benchmarks run yet._", ""]

    # Resilience results
    lines += ["---", "", "## Resilience Analysis", ""]

    if resilience_results:
        lines += [
            "| Architecture | Resilience Score | Availability | Failure Type | Recovered | Recovery Time |",
            "|-------------|-----------------|--------------|--------------|-----------|---------------|",
        ]
        for r in resilience_results:
            arch = next((a for a in architectures if a.id == r.architecture_id), None)
            arch_name = arch.arch_type.replace("_", " ").title() if arch else "Unknown"
            recovery = f"{round(r.recovery_time_ms)}ms" if r.recovery_time_ms else "Never"
            lines.append(
                f"| {arch_name} | {r.resilience_score}/100 | "
                f"{r.availability_pct}% | {r.failure_type} | "
                f"{'✓' if r.recovered else '✗'} | {recovery} |"
            )
        lines += [""]

        lines += ["### Resilience Details", ""]
        for r in resilience_results:
            arch = next((a for a in architectures if a.id == r.architecture_id), None)
            arch_name = arch.arch_type.replace("_", " ").title() if arch else "Unknown"
            lines += [
                f"**{arch_name}** — {r.failure_type} (killed `{r.container_killed}`)",
                f"- Pre-failure p95 latency: {r.pre_latency_p95_ms}ms | "
                f"Error rate: {r.pre_error_rate_pct}%",
                f"- Failure-period p95 latency: {r.failure_latency_p95_ms}ms | "
                f"Error rate: {r.failure_error_rate_pct}%",
                f"- Availability: {r.availability_pct}% | "
                f"Resilience Score: {r.resilience_score}/100",
                "",
            ]
    else:
        lines += ["_No resilience tests run yet._", ""]

    # Recommendation
    lines += ["---", "", "## AI Recommendation", ""]

    if recommendation:
        lines += [
            f"**Recommended Architecture:** {recommendation.recommended_arch_type.replace('_', ' ').title()}  ",
            f"**Confidence:** {round(recommendation.confidence_score * 100)}%  ",
            f"**Provider:** {recommendation.llm_provider}  ",
            "",
            recommendation.reasoning,
            "",
        ]
    else:
        lines += ["_No recommendation generated yet._", ""]

    lines += [
        "---",
        "",
        "_Report generated by [ArchBench](https://github.com/Pratyaksh-13/ai-architecture-benchmark) "
        "— AI Architecture Benchmarking Platform_",
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