import os
from app.services.llm.base import LLMProvider
from app.services.llm.openai_provider import OpenAIProvider

def get_llm_provider(override: str | None = None) -> LLMProvider:
    """
    Returns an LLMProvider instance based on the override param,
    falling back to the LLM_PROVIDER env var, defaulting to "openai" (OpenRouter).
    """
    provider_name = (override or os.getenv("LLM_PROVIDER", "openai")).lower()
    if provider_name == "openai":
        return OpenAIProvider()
    else:
        raise ValueError(f"Unknown LLM provider: {provider_name}. Only 'openai' (OpenRouter via OPENAI_BASE_URL) is supported.")