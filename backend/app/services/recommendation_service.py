# app/services/recommendation_service.py

import re
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.recommendation import Recommendation
from app.models.benchmark import Benchmark
from app.models.benchmark_run import BenchmarkRun
from app.models.architecture import Architecture
from app.models.resilience_result import ResilienceResult
from app.services.project_service import get_owned_project
from app.services.scoring_service import calculate_scores
from app.services.llm.factory import get_llm_provider


# ── Signal detection ──────────────────────────────────────────────────────────

SIGNALS = {
    "high_scale":          [r"\b(100k|1m|10m|\d+\s*million|\d{3},\d{3}|concurrent|peak\s+traffic|enterprise|massive)\b"],
    "small_scale":         [r"\b(simple|basic|small|mvp|prototype|startup|side\s+project|solo|lean|single\s+team)\b"],
    "realtime":            [r"\b(real.?time|live|tracking|streaming|websocket|push\s+notification|live\s+update|driver\s+location)\b"],
    "streaming":           [r"\b(stream|kafka|kinesis|video\s+stream|audio\s+stream|data\s+pipeline|feed)\b"],
    "event_processing":    [r"\b(event.?driven|event\s+sourcing|cqrs|message\s+broker|pub.?sub|rabbitmq|sqs)\b"],
    "async_workload":      [r"\b(notification|email|sms|push|queue|background|worker|async|asynchronous|decouple|pipeline)\b"],
    "batch_processing":    [r"\b(batch|scheduled|cron|nightly|bulk\s+process|etl|report\s+generation)\b"],
    "high_availability":   [r"\b(99\.9|sla|uptime|availability|zero\s+downtime|always\s+on|highly\s+available)\b"],
    "disaster_recovery":   [r"\b(disaster\s+recovery|backup|failover|multi.?region|dr\s+plan|rto|rpo)\b"],
    "multi_region":        [r"\b(multi.?region|global|worldwide|geo.?distributed|regional|cdn|edge)\b"],
    "independent_scaling": [r"\b(independent\s+scal|horizontal\s+scal|auto.?scal|scale\s+out|kubernetes|k8s|container)\b"],
    "fault_isolation":     [r"\b(fault\s+isolation|circuit\s+breaker|resilience|bulkhead|independent\s+deploy|rolling\s+update)\b"],
    "strong_consistency":  [r"\b(transaction|acid|consistent|strong\s+consistency|two.?phase|distributed\s+transaction)\b"],
    "eventual_consistency":[r"\b(eventual\s+consistency|saga|base|idempotent|retry|at.?least.?once)\b"],
    "low_latency":         [r"\b(low\s+latency|sub.?second|millisecond|fast\s+response|response\s+time|<\s*100ms)\b"],
    "cost_sensitive":      [r"\b(cost|budget|cheap|affordable|economical|optimize\s+spend|save\s+money)\b"],
    "large_team":          [r"\b(team|domain|bounded\s+context|ownership|squad|multiple\s+team|org\s+scal|conway)\b"],
    "frequent_deploys":    [r"\b(ci.?cd|continuous\s+deploy|frequent\s+deploy|release\s+often|devops|gitops)\b"],
    "compliance":          [r"\b(gdpr|hipaa|pci|sox|compliance|regulatory|audit|data\s+residency)\b"],
    "analytics_heavy":     [r"\b(analytics|reporting|dashboard|bi|data\s+warehouse|olap|metrics|insight)\b"],
    "read_heavy":          [r"\b(read.?heavy|read\s+replica|cache|cdn|content\s+delivery|mostly\s+read)\b"],
    "write_heavy":         [r"\b(write.?heavy|high\s+write|ingest|append.?only|time\s+series|log\s+aggregat)\b"],
    "payment":             [r"\b(payment|transaction|billing|checkout|financial|stripe|razorpay|wallet)\b"],
}

SIGNAL_LABEL = {
    "high_scale": "High Scale",
    "small_scale": "Small Scale / MVP",
    "realtime": "Real-time Communication",
    "streaming": "Data Streaming",
    "event_processing": "Event Processing",
    "async_workload": "Async Workloads",
    "batch_processing": "Batch Processing",
    "high_availability": "High Availability",
    "disaster_recovery": "Disaster Recovery",
    "multi_region": "Multi-region Deployment",
    "independent_scaling": "Independent Scaling",
    "fault_isolation": "Fault Isolation",
    "strong_consistency": "Strong Consistency",
    "eventual_consistency": "Eventual Consistency",
    "low_latency": "Low Latency",
    "cost_sensitive": "Cost Sensitive",
    "large_team": "Large Engineering Team",
    "frequent_deploys": "Frequent Deployments",
    "compliance": "Regulatory Compliance",
    "analytics_heavy": "Analytics Heavy",
    "read_heavy": "Read Heavy",
    "write_heavy": "Write Heavy",
    "payment": "Payment Processing",
}


def _detect_signals(requirement: str) -> dict[str, bool]:
    text = requirement.lower()
    return {
        signal: any(re.search(p, text) for p in patterns)
        for signal, patterns in SIGNALS.items()
    }


def _extract_user_count(requirement: str) -> int:
    text = requirement.lower()
    patterns = [
        (r"(\d+)\s*,\s*(\d{3})\s*,\s*(\d{3})", lambda m: int(m.group(1)) * 1_000_000 + int(m.group(2)) * 1000 + int(m.group(3))),
        (r"(\d+)\s*,\s*(\d{3})", lambda m: int(m.group(1)) * 1000 + int(m.group(2))),
        (r"(\d+)\s*m\b", lambda m: int(m.group(1)) * 1_000_000),
        (r"(\d+)\s*k\b", lambda m: int(m.group(1)) * 1000),
        (r"(\d+)\s*(million|crore)", lambda m: int(m.group(1)) * 1_000_000),
        (r"(\d+)\s*(thousand|lakh)", lambda m: int(m.group(1)) * 1000),
    ]
    counts = []
    for pattern, converter in patterns:
        for match in re.finditer(pattern, text):
            try:
                counts.append(converter(match))
            except Exception:
                pass
    return max(counts) if counts else 0


# ── Multi-dimensional fitness scoring ─────────────────────────────────────────

def _compute_requirement_fitness(
    arch_type: str,
    signals: dict[str, bool],
    user_count: int,
) -> dict:
    """
    Scores each architecture across 10 dimensions (0-100 each).
    Returns overall fitness + per-category breakdown.
    Avoids perfect scores unless every dimension genuinely supports it.
    """
    s = signals  # shorthand

    if arch_type == "monolithic":
        scalability        = 85 if not s["high_scale"] and user_count < 10_000 else max(10, 60 - min(user_count // 5000, 40))
        realtime_fit       = 55 if not s["realtime"] else 30
        fault_isolation_fit= 30 if s["fault_isolation"] else 55
        async_fit          = 40 if s["async_workload"] or s["event_processing"] else 65
        consistency_fit    = 85 if s["strong_consistency"] else 70
        operational_simplicity = 90
        deployment_simplicity  = 88
        resilience_fit     = 40 if s["high_availability"] or s["disaster_recovery"] else 60
        future_growth      = 35 if s["high_scale"] or user_count >= 50_000 else 65
        cost_fit           = 85 if s["cost_sensitive"] or user_count < 10_000 else 60

    elif arch_type == "microservices":
        scalability        = 90 if s["high_scale"] or s["independent_scaling"] or user_count >= 50_000 else 70
        realtime_fit       = 65 if s["realtime"] else 72
        fault_isolation_fit= 88 if s["fault_isolation"] else 72
        async_fit          = 70 if s["async_workload"] else 65
        consistency_fit    = 72 if s["strong_consistency"] else 75
        operational_simplicity = 40 if not s["large_team"] else 60
        deployment_simplicity  = 55 if s["frequent_deploys"] else 50
        resilience_fit     = 82 if s["high_availability"] else 70
        future_growth      = 85 if s["high_scale"] or user_count >= 50_000 else 68
        cost_fit           = 40 if s["cost_sensitive"] else 60

    else:  # event_driven
        scalability        = 92 if s["high_scale"] or s["streaming"] or user_count >= 50_000 else 72
        realtime_fit       = 95 if s["realtime"] else 70
        fault_isolation_fit= 88 if s["fault_isolation"] else 75
        async_fit          = 97 if s["async_workload"] or s["event_processing"] or s["streaming"] else 65
        consistency_fit    = 60 if s["strong_consistency"] else 78
        operational_simplicity = 35 if not s["large_team"] else 55
        deployment_simplicity  = 50 if s["frequent_deploys"] else 48
        resilience_fit     = 85 if s["high_availability"] or s["disaster_recovery"] else 72
        future_growth      = 90 if s["high_scale"] or s["multi_region"] else 72
        cost_fit           = 50 if s["cost_sensitive"] else 65

    categories = {
        "Scalability":             scalability,
        "Real-time Fit":           realtime_fit,
        "Fault Isolation":         fault_isolation_fit,
        "Async Workloads":         async_fit,
        "Consistency":             consistency_fit,
        "Operational Simplicity":  operational_simplicity,
        "Deployment Simplicity":   deployment_simplicity,
        "Resilience":              resilience_fit,
        "Future Growth":           future_growth,
        "Cost Fit":                cost_fit,
    }

    # Weighted overall (scalability and async weighted more for distributed systems)
    weights = {
        "Scalability": 0.15, "Real-time Fit": 0.12, "Fault Isolation": 0.10,
        "Async Workloads": 0.12, "Consistency": 0.08, "Operational Simplicity": 0.08,
        "Deployment Simplicity": 0.08, "Resilience": 0.10, "Future Growth": 0.10, "Cost Fit": 0.07,
    }
    overall = sum(categories[k] * weights[k] for k in categories)

    # Derive top reasons and penalties from category scores
    sorted_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)
    reasons = [f"{k} ({v}/100)" for k, v in sorted_cats[:3]]
    penalties = [f"{k} ({v}/100)" for k, v in sorted_cats[-2:] if v < 60]

    return {
        "fitness_score": round(overall, 1),
        "categories": categories,
        "reasons": reasons,
        "penalties": penalties,
    }


# ── Production recommendation sentence ───────────────────────────────────────

def _build_production_recommendation(
    prod_arch: str,
    reasons: list[str],
    bench_winner: str,
    agree: bool,
) -> str:
    arch_label = {"monolithic": "Monolithic", "microservices": "Microservices", "event_driven": "Event-Driven"}.get(prod_arch, prod_arch)
    bench_label = {"monolithic": "Monolithic", "microservices": "Microservices", "event_driven": "Event-Driven"}.get(bench_winner, bench_winner)

    if agree:
        base = f"Deploy the {arch_label} architecture in production."
    else:
        base = f"Although {bench_label} won the benchmark, deploy the {arch_label} architecture in production."

    if reasons:
        base += " Key strengths: " + ", ".join(r.split(" (")[0] for r in reasons[:3]) + "."
    return base


# ── Confidence calculation ────────────────────────────────────────────────────

def _compute_confidence(
    fitness_results: dict,
    benchmark_scores: dict,
    signals: dict,
    agree: bool,
    has_resilience: bool,
) -> tuple[float, list[str]]:
    reasons = []
    score = 0.50

    # Fitness margin
    sorted_fitness = sorted(fitness_results.values(), key=lambda f: f["fitness_score"], reverse=True)
    if len(sorted_fitness) > 1:
        margin = sorted_fitness[0]["fitness_score"] - sorted_fitness[1]["fitness_score"]
        fitness_contribution = min(margin / 100 * 0.25, 0.25)
        score += fitness_contribution
        if margin > 15:
            reasons.append("Strong requirement match — clear fitness margin over alternatives")
        elif margin > 5:
            reasons.append("Moderate requirement match")

    # Benchmark evidence
    sorted_bench = sorted(benchmark_scores.values(), key=lambda s: s["overall_score"], reverse=True)
    if sorted_bench:
        score += 0.08
        reasons.append("Benchmark evidence available")
        if len(sorted_bench) > 1:
            bench_margin = sorted_bench[0]["overall_score"] - sorted_bench[1]["overall_score"]
            score += min(bench_margin / 100 * 0.10, 0.10)

    # Signal count
    active_signals = sum(1 for v in signals.values() if v)
    signal_contribution = min(active_signals * 0.02, 0.12)
    score += signal_contribution
    if active_signals >= 5:
        reasons.append(f"{active_signals} requirement signals detected — strong architectural clarity")
    elif active_signals >= 2:
        reasons.append(f"{active_signals} requirement signals detected")

    # Resilience data
    if has_resilience:
        score += 0.05
        reasons.append("Resilience testing completed")

    # Agreement penalty/bonus
    if agree:
        score += 0.05
        reasons.append("Benchmark winner and production recommendation agree")
    else:
        score -= 0.05
        reasons.append("Minor disagreement between benchmark winner and production recommendation")

    return round(min(score, 0.99), 2), reasons


# ── LLM prompt ────────────────────────────────────────────────────────────────

def _build_explanation_prompt(
    requirement: str,
    benchmark_winner: str,
    production_recommendation: str,
    benchmark_winner_score: float,
    prod_rec_fitness: float,
    prod_rec_categories: dict,
    active_signals: list[str],
    user_count: int,
    agree: bool,
) -> str:
    top_cats = sorted(prod_rec_categories.items(), key=lambda x: x[1], reverse=True)[:4]
    cat_summary = ", ".join(f"{k} ({v}/100)" for k, v in top_cats)

    if agree:
        return f"""A user requested: "{requirement}"

Three architectures were benchmarked. {benchmark_winner} won both the benchmark (score: {benchmark_winner_score}/100) and is the recommended production architecture (fitness: {prod_rec_fitness}/100).

Top fitness categories: {cat_summary}
Detected signals: {", ".join(active_signals) or "none"}
Expected scale: {user_count:,} users

Write 2-3 sentences explaining why {production_recommendation} is both the benchmark winner AND the right production choice for these specific requirements. Reference the actual signals and fitness strengths.

Respond with ONLY the explanation text. No preamble, no JSON, no markdown."""

    else:
        return f"""A user requested: "{requirement}"

Benchmark winner: {benchmark_winner} (score: {benchmark_winner_score}/100)
Production recommendation: {production_recommendation} (fitness: {prod_rec_fitness}/100)

Top fitness categories for {production_recommendation}: {cat_summary}
Detected signals: {", ".join(active_signals)}
Expected scale: {user_count:,} users

Write 3-4 sentences:
1. Why {benchmark_winner} won the benchmark (1 sentence, brief)
2. Why {production_recommendation} is better for production given the actual requirements
3. The primary architectural reason (scalability, real-time, fault isolation, async processing, etc.)

Be specific — cite the detected signals and category scores.

Respond with ONLY the explanation text. No preamble, no JSON, no markdown."""


# ── Main function ─────────────────────────────────────────────────────────────

def generate_recommendation(
    db: Session,
    project_id: int,
    user_id: int,
    provider_override: str | None = None,
) -> Recommendation:
    project = get_owned_project(db, project_id, user_id)

    latest_run = (
        db.query(BenchmarkRun)
        .filter(BenchmarkRun.project_id == project_id)
        .order_by(BenchmarkRun.created_at.desc())
        .first()
    )
    if not latest_run:
        raise HTTPException(status_code=400, detail="No benchmarks found — run a benchmark first")

    benchmarks = db.query(Benchmark).filter(Benchmark.run_id == latest_run.id).all()
    if not benchmarks:
        raise HTTPException(status_code=400, detail="No benchmarks found — run a benchmark first")

    architectures = db.query(Architecture).filter(Architecture.project_id == project_id).all()
    arch_lookup = {a.id: a for a in architectures}

    has_resilience = db.query(ResilienceResult).filter(ResilienceResult.project_id == project_id).count() > 0

    # Step 1: Benchmark winner
    benchmark_scores = calculate_scores(benchmarks)
    if not benchmark_scores:
        raise HTTPException(status_code=400, detail="Could not compute scores from benchmarks")

    benchmark_winner_id = max(benchmark_scores, key=lambda aid: benchmark_scores[aid]["overall_score"])
    benchmark_winner_arch = arch_lookup[benchmark_winner_id]
    benchmark_winner_score = benchmark_scores[benchmark_winner_id]["overall_score"]

    # Step 2: Requirement fitness
    signals = _detect_signals(project.requirement)
    user_count = _extract_user_count(project.requirement)
    active_signals = [k for k, v in signals.items() if v]

    fitness_results = {
        arch.id: _compute_requirement_fitness(arch.arch_type, signals, user_count)
        for arch in architectures
    }

    prod_rec_id = max(fitness_results, key=lambda aid: fitness_results[aid]["fitness_score"])
    prod_rec_arch = arch_lookup[prod_rec_id]
    prod_rec_fitness = fitness_results[prod_rec_id]
    agree = benchmark_winner_id == prod_rec_id

    # Step 3: LLM explanation
    prompt = _build_explanation_prompt(
        requirement=project.requirement,
        benchmark_winner=benchmark_winner_arch.arch_type,
        production_recommendation=prod_rec_arch.arch_type,
        benchmark_winner_score=benchmark_winner_score,
        prod_rec_fitness=prod_rec_fitness["fitness_score"],
        prod_rec_categories=prod_rec_fitness["categories"],
        active_signals=active_signals,
        user_count=user_count,
        agree=agree,
    )

    try:
        llm = get_llm_provider(provider_override)
        if hasattr(llm, "client") and hasattr(llm.client, "messages"):
            response = llm.client.messages.create(
                model=getattr(llm, "model", "claude-sonnet-4-6"),
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}],
            )
            reasoning = response.content[0].text.strip()
        else:
            response = llm.client.chat.completions.create(
                model=llm.model,
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}],
            )
            reasoning = response.choices[0].message.content.strip()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM explanation failed: {str(e)}")

    # Step 4: Confidence
    confidence, confidence_reasons = _compute_confidence(
        fitness_results, benchmark_scores, signals, agree, has_resilience
    )

    production_rec_sentence = _build_production_recommendation(
        prod_rec_arch.arch_type, prod_rec_fitness["reasons"],
        benchmark_winner_arch.arch_type, agree,
    )

    # Store fitness categories in signals_detected alongside active signals
    signals_payload = active_signals

    db.query(Recommendation).filter(Recommendation.project_id == project_id).delete()

    recommendation = Recommendation(
        project_id=project_id,
        recommended_arch_type=prod_rec_arch.arch_type,
        reasoning=reasoning,
        confidence_score=confidence,
        llm_provider=provider_override or "default",
        benchmark_winner=benchmark_winner_arch.arch_type,
        benchmark_winner_score=benchmark_winner_score,
        production_recommendation=production_rec_sentence,
        fitness_score=prod_rec_fitness["fitness_score"],
        signals_detected=signals_payload,
        benchmark_agrees=agree,
    )
    db.add(recommendation)
    db.commit()
    db.refresh(recommendation)

    # Store fitness categories for report use (attach as transient attr)
    recommendation.__dict__["_fitness_categories"] = prod_rec_fitness["categories"]
    recommendation.__dict__["_confidence_reasons"] = confidence_reasons
    recommendation.__dict__["_all_fitness"] = {
        arch_lookup[aid].arch_type: fitness_results[aid]
        for aid in fitness_results
    }

    return recommendation


def get_recommendation_for_project(db: Session, project_id: int, user_id: int) -> Recommendation:
    get_owned_project(db, project_id, user_id)
    rec = db.query(Recommendation).filter(Recommendation.project_id == project_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="No recommendation generated yet")
    return rec
