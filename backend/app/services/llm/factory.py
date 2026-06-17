# app/services/llm/factory.py

import os
from app.services.llm.base import LLMProvider
from app.services.llm.claude_provider import ClaudeProvider
from app.services.llm.openai_provider import OpenAIProvider

def get_llm_provider(override: str | None = None) -> LLMProvider:
    """
    Returns an LLMProvider instance based on the override param,
    falling back to the LLM_PROVIDER env var, defaulting to "claude".
    """
    provider_name = (override or os.getenv("LLM_PROVIDER", "claude")).lower()

    if provider_name == "claude":
        return ClaudeProvider()
    elif provider_name == "openai":
        return OpenAIProvider()
    else:
        raise ValueError(f"Unknown LLM provider: {provider_name}. Use 'claude' or 'openai'.")