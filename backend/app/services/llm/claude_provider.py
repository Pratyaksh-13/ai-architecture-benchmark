# app/services/llm/claude_provider.py

import os
import json
from anthropic import Anthropic
from app.services.llm.base import LLMProvider

SYSTEM_PROMPT = """You are a senior software architect. Given a natural language \
requirement, generate exactly 3 architecture proposals: monolithic, microservices, \
and event_driven.

Respond with ONLY valid JSON (no markdown fences, no preamble) matching this exact \
structure - a JSON array of 3 objects:

[
  {
    "arch_type": "monolithic",
    "explanation": "2-4 sentence explanation of how this architecture would be applied to the requirement",
    "mermaid_diagram": "valid mermaid.js flowchart syntax as a single string, using \\n for newlines",
    "docker_compose": "valid docker-compose.yml content as a single string, using \\n for newlines",
    "tradeoffs": {"pros": ["...", "..."], "cons": ["...", "..."]}
  },
  { "arch_type": "microservices", ... },
  { "arch_type": "event_driven", ... }
]
"""

class ClaudeProvider(LLMProvider):
    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set in environment")
        self.client = Anthropic(api_key=api_key)

    def generate_architectures(self, requirement: str) -> list[dict]:
        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4000,
            system=SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": f"Requirement: {requirement}"}
            ],
        )

        raw_text = response.content[0].text.strip()
        return self._parse_json_response(raw_text)

    def _parse_json_response(self, raw_text: str) -> list[dict]:
        # Defensive: strip markdown fences if the model adds them anyway
        if raw_text.startswith("```"):
            raw_text = raw_text.strip("`")
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]

        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as e:
            raise ValueError(f"LLM did not return valid JSON: {e}\nRaw: {raw_text[:500]}")

        if not isinstance(data, list) or len(data) != 3:
            raise ValueError(f"Expected a list of 3 architectures, got: {type(data)} len={len(data) if isinstance(data, list) else 'n/a'}")

        return data