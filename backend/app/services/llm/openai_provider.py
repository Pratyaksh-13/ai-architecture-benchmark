# app/services/llm/openai_provider.py

import os
import json
from openai import OpenAI
from app.services.llm.base import LLMProvider

SYSTEM_PROMPT = """You are a senior software architect. Given a natural language \
requirement, generate exactly 3 architecture proposals: monolithic, microservices, \
and event_driven.

Respond with ONLY valid JSON (no markdown fences, no preamble, no explanation text \
before or after) matching this exact structure - a JSON array of 3 objects:

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
For mermaid_diagram, use ONLY simple flowchart LR syntax. Do not use subgraphs, \
classDef, style, or any advanced Mermaid features. Keep diagrams to under 10 nodes. \
Example valid format: flowchart LR\\n    A[Client] --> B[Server]\\n    B --> C[(Database)]
CRITICAL: Your entire response must be the raw JSON array and nothing else. Do not \
write "Here is the JSON" or any commentary. Start your response with [ and end with ].
"""

class OpenAIProvider(LLMProvider):
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set in environment")

        # If OPENAI_BASE_URL is set (e.g. to OpenRouter), use it.
        # Otherwise defaults to OpenAI's own API.
        base_url = os.getenv("OPENAI_BASE_URL")  # e.g. "https://openrouter.ai/api/v1"
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o")

        client_kwargs = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url

        self.client = OpenAI(**client_kwargs)
        self.is_openrouter = bool(base_url and "openrouter" in base_url)

    def generate_architectures(self, requirement: str) -> list[dict]:
        request_kwargs = {
            "model": self.model,
            "max_tokens": 4000,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Requirement: {requirement}"}
            ],
        }

        # response_format json_object isn't reliably supported across all
        # OpenRouter-hosted models, so only request it when hitting OpenAI directly.
        if not self.is_openrouter:
            request_kwargs["response_format"] = {"type": "json_object"}
            request_kwargs["messages"][0]["content"] += '\n\nWrap the array in a key called "architectures".'

        response = self.client.chat.completions.create(**request_kwargs)
        raw_text = response.choices[0].message.content.strip()

        return self._parse_json_response(raw_text)

    def _parse_json_response(self, raw_text: str) -> list[dict]:
        # Defensive: strip markdown fences if the model adds them anyway
        if raw_text.startswith("```"):
            raw_text = raw_text.strip("`")
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError as e:
            raise ValueError(f"LLM did not return valid JSON: {e}\nRaw: {raw_text[:500]}")

        architectures = data.get("architectures", data) if isinstance(data, dict) else data

        if not isinstance(architectures, list) or len(architectures) != 3:
            raise ValueError(f"Expected 3 architectures, got: {architectures}")

        return architectures