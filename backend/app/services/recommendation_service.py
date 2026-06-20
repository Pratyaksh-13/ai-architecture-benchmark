# app/services/recommendation_service.py

import json
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.recommendation import Recommendation
from app.models.architecture import Architecture
from app.models.benchmark import Benchmark
from app.services.project_service import get_project_by_id
from app.services.llm.factory import get_llm_provider

RECOMMEND_SYSTEM_PROMPT = """You are a senior software architect evaluating three \
architecture options against a requirement and their benchmark metrics.

Respond with ONLY valid JSON, no markdown fences, no commentary, matching this exact \
structure:

{
  "recommended_arch_type": "monolithic" | "microservices" | "event_driven",
  "reasoning": "2-4 sentences explaining why this architecture best fits the requirement, referencing the specific benchmark numbers",
  "confidence_score": 0.0 to 1.0
}

CRITICAL: Your entire response must be the raw JSON object and nothing else. Start \
with { and end with }.
"""


def _build_context(requirement: str, architectures: list[Architecture], benchmarks: list[Benchmark]) -> str:
    """Builds the user message with requirement + architecture summaries + benchmark numbers."""
    lines = [f"Requirement: {requirement}\n"]

    for arch in architectures:
        bm = next((b for b in benchmarks if b.architecture_id == arch.id), None)
        lines.append(f"\n--- {arch.arch_type} ---")
        lines.append(f"Explanation: {arch.explanation}")
        if bm:
            lines.append(
                f"Benchmarks: p99 latency={bm.latency_p99_ms}ms, "
                f"throughput={bm.throughput_rps}rps, "
                f"error_rate={bm.error_rate_pct}%, "
                f"cpu={bm.cpu_usage_pct}%, "
                f"memory={bm.memory_usage_mb}MB"
            )

    return "\n".join(lines)


def _parse_recommendation_json(raw_text: str) -> dict:
    raw_text = raw_text.strip()
    if raw_text.startswith("```"):
        raw_text = raw_text.strip("`")
        if raw_text.startswith("json"):
            raw_text = raw_text[4:]
        raw_text = raw_text.strip()

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM did not return valid JSON: {e}\nRaw: {raw_text[:500]}")

    required_keys = {"recommended_arch_type", "reasoning", "confidence_score"}
    if not required_keys.issubset(data.keys()):
        raise ValueError(f"Missing required keys. Got: {list(data.keys())}")

    return data


def generate_recommendation(db: Session, project_id: int, provider_override: str | None = None) -> Recommendation:
    project = get_project_by_id(db, project_id)

    architectures = db.query(Architecture).filter(Architecture.project_id == project_id).all()
    if not architectures:
        raise HTTPException(status_code=400, detail="No architectures found. Generate architectures first.")

    benchmarks = db.query(Benchmark).filter(Benchmark.project_id == project_id).all()
    if not benchmarks:
        raise HTTPException(status_code=400, detail="No benchmarks found. Run benchmarks first.")

    provider_name = provider_override or "claude"
    context = _build_context(project.requirement, architectures, benchmarks)

    try:
        llm = get_llm_provider(provider_override)

        # Reuse the provider's underlying client directly for a single-object response
        # (architectures call expects a list of 3; recommendation expects 1 object)
        if hasattr(llm, "client") and hasattr(llm.client, "messages"):
            # Claude-style client
            response = llm.client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1000,
                system=RECOMMEND_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": context}],
            )
            raw_text = response.content[0].text
        else:
            # OpenAI-style client (also covers OpenRouter)
            response = llm.client.chat.completions.create(
                model=llm.model,
                max_tokens=1000,
                messages=[
                    {"role": "system", "content": RECOMMEND_SYSTEM_PROMPT},
                    {"role": "user", "content": context},
                ],
            )
            raw_text = response.choices[0].message.content

        data = _parse_recommendation_json(raw_text)

    except (ValueError, AttributeError) as e:
        raise HTTPException(status_code=502, detail=f"Recommendation generation failed: {str(e)}")

    # Replace any existing recommendation for this project
    db.query(Recommendation).filter(Recommendation.project_id == project_id).delete()

    recommendation = Recommendation(
        project_id=project_id,
        recommended_arch_type=data["recommended_arch_type"],
        reasoning=data["reasoning"],
        confidence_score=float(data["confidence_score"]),
        llm_provider=provider_name,
    )
    db.add(recommendation)
    db.commit()
    db.refresh(recommendation)

    return recommendation


def get_recommendation_for_project(db: Session, project_id: int) -> Recommendation:
    get_project_by_id(db, project_id)
    rec = db.query(Recommendation).filter(Recommendation.project_id == project_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="No recommendation generated yet")
    return rec