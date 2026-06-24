# app/services/v4/split_service.py

def generate_split_recommendations(
    project_requirement: str,
    arch: Architecture,
    benchmark: Benchmark,
    bottlenecks: list[dict],
) -> list[dict]:
    """
    Only recommends splits when there's actual evidence from benchmarks.
    The LLM identifies WHAT to split based on the requirement;
    the benchmark data determines IF a split is warranted.
    """
    # Only recommend splits if there's a genuine performance reason
    has_cpu_bottleneck = any(b["bottleneck_type"] == "cpu" and b["severity"] in ["high", "critical"] for b in bottlenecks)
    has_network_overhead = any(b["bottleneck_type"] == "network" for b in bottlenecks)

    if not has_cpu_bottleneck and not has_network_overhead:
        return []  # No evidence for splitting — don't recommend it anyway

    # Use LLM only to identify domain boundaries from the requirement text
    # Not to decide WHETHER to split (that's already decided from metrics above)
    prompt = f"""Given this system requirement:
"{project_requirement}"

And this architecture type: {arch.arch_type}

The benchmark shows CPU at {benchmark.cpu_usage_pct}% and network overhead detected.
Identify 2-3 specific services that could be extracted from this system to reduce CPU pressure.

Respond with ONLY valid JSON:
{{
  "splits": [
    {{
      "current_service": "name of current monolithic component",
      "recommended_splits": [
        {{"name": "ServiceName", "responsibility": "what it handles"}}
      ],
      "reasoning": "one sentence why",
      "expected_latency_improvement_pct": 15
    }}
  ]
}}"""

    return prompt  # caller handles LLM invocation