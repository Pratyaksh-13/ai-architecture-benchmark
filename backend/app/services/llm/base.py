# app/services/llm/base.py

from abc import ABC, abstractmethod

class LLMProvider(ABC):
    """
    Abstract interface all LLM providers must implement.
    This is what lets us swap Claude <-> OpenAI without touching business logic.
    """

    @abstractmethod
    def generate_architectures(self, requirement: str) -> list[dict]:
        """
        Given a natural language requirement, return a list of 3 dicts:
        [
          {
            "arch_type": "monolithic" | "microservices" | "event_driven",
            "explanation": str,
            "mermaid_diagram": str,
            "docker_compose": str,
            "tradeoffs": {"pros": [...], "cons": [...]}
          },
          ...
        ]
        """
        raise NotImplementedError