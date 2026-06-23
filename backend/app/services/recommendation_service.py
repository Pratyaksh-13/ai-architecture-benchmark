# app/services/recommendation_service.py

from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.recommendation import Recommendation
from app.models.benchmark import Benchmark
from app.models.benchmark_run import BenchmarkRun
from app.models.architecture import Architecture
from app.services.project_service import get_owned_project
from app.services.scoring_service import calculate_scores
from app.services.llm.factory import get_llm_provider


def _get_latest_run_benchmarks(db: Session, project_id: int) -> list[Benchmark]:
    latest_run = (
        db.query(BenchmarkRun)
        .filter(BenchmarkRun.project_id == project_id)
        .order_by(BenchmarkRun.created_at.desc())
        .first()
    )
    if not latest_run:
        return []
    return db.query(Benchmark).filter(Benchmark.run_id == latest_run.id).all()


def _build_data_backed_prompt(
    requirement: str,
    winner_arch: Architecture,
    winner_benchmark: Benchmark,
    winner_score: dict,
    all_scores: dict,
    architectures: list[Architecture],
) -> str:
    """
    The winner is already decided by calculate_scores() before this prompt
    is built. The LLM's only job is to explain WHY, citing actual numbers.
    """
    arch_lookup = {a.id: a for a in architectures}

    comparison_lines = []
    for arch_id, score in all_scores.items():
        arch = arch_lookup.get(arch_id)
        if arch:
            comparison_lines.append(
                f"- {arch.arch_type}: overall score {score['overall_score']}/100 "
                f"(latency score {score['latency_score']}, "
                f"throughput score {score['throughput_score']}, "
                f"reliability score {score['reliability_score']})"
            )

    return f"""A user requested this system: "{requirement}"

Three architectures were benchmarked. Based on measured performance data, {winner_arch.arch_type} scored highest overall ({winner_score['overall_score']}/100).

Full comparison:
{chr(10).join(comparison_lines)}

Winning architecture measured metrics:
- p95 latency: {winner_benchmark.latency_p95_ms}ms
- p99 latency: {winner_benchmark.latency_p99_ms}ms
- Throughput: {winner_benchmark.throughput_rps} req/s
- Error rate: {winner_benchmark.error_rate_pct}%

Write 2-4 sentences explaining why {winner_arch.arch_type} is the right choice for THIS specific requirement, citing the actual numbers above. Do not suggest a different architecture — the winner is already determined by the data. Focus on connecting the measured performance to what the user actually asked for.

Respond with ONLY the explanation text, no preamble, no JSON, no markdown."""


def generate_recommendation(
    db: Session,
    project_id: int,
    user_id: int,
    provider_override: str | None = None,
) -> Recommendation:
    """
    Determines the winning architecture from real benchmark scores FIRST
    (deterministic, from calculate_scores()), then asks the LLM only to
    explain the already-determined result in plain language, citing real
    numbers. The LLM cannot pick the wrong winner because it doesn't pick.
    """
    project = get_owned_project(db, project_id, user_id)

    benchmarks = _get_latest_run_benchmarks(db, project_id)
    if not benchmarks:
        raise HTTPException(status_code=400, detail="No benchmarks found — run a benchmark first")

    architectures = (
        db.query(Architecture)
        .filter(Architecture.project_id == project_id)
        .all()
    )
    if not architectures:
        raise HTTPException(status_code=400, detail="No architectures found — generate first")

    arch_lookup = {a.id: a for a in architectures}

    scores = calculate_scores(benchmarks)
    if not scores:
        raise HTTPException(status_code=400, detail="Could not compute scores from benchmarks")

    # Winner decided here in code, not by the LLM
    winner_arch_id = max(scores, key=lambda aid: scores[aid]["overall_score"])
    winner_score = scores[winner_arch_id]
    winner_arch = arch_lookup[winner_arch_id]
    winner_benchmark = next(b for b in benchmarks if b.architecture_id == winner_arch_id)

    prompt = _build_data_backed_prompt(
        project.requirement, winner_arch, winner_benchmark, winner_score, scores, architectures
    )

    try:
        llm = get_llm_provider(provider_override)

        if hasattr(llm, "client") and hasattr(llm.client, "messages"):
            # Claude-style client
            response = llm.client.messages.create(
                model=getattr(llm, "model", "claude-sonnet-4-6"),
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}],
            )
            reasoning = response.content[0].text.strip()
        else:
            # OpenAI-style client (also covers OpenRouter)
            response = llm.client.chat.completions.create(
                model=llm.model,
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}],
            )
            reasoning = response.choices[0].message.content.strip()

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM explanation failed: {str(e)}")

    # Confidence score derived from actual margin between winner and runner-up,
    # not an LLM-guessed number — a 95-vs-40 win is genuinely more confident
    # than a 95-vs-91 win
    sorted_scores = sorted(scores.values(), key=lambda s: s["overall_score"], reverse=True)
    if len(sorted_scores) > 1:
        margin = sorted_scores[0]["overall_score"] - sorted_scores[1]["overall_score"]
        confidence = round(min(0.5 + (margin / 100), 0.99), 2)
    else:
        confidence = 0.75

    # Replace any existing recommendation for this project
    db.query(Recommendation).filter(Recommendation.project_id == project_id).delete()

    recommendation = Recommendation(
        project_id=project_id,
        recommended_arch_type=winner_arch.arch_type,
        reasoning=reasoning,
        confidence_score=confidence,
        llm_provider=provider_override or "default",
    )
    db.add(recommendation)
    db.commit()
    db.refresh(recommendation)

    return recommendation


def get_recommendation_for_project(db: Session, project_id: int, user_id: int) -> Recommendation:
    get_owned_project(db, project_id, user_id)
    rec = db.query(Recommendation).filter(Recommendation.project_id == project_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="No recommendation generated yet")
    return rec