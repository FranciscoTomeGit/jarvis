from collections.abc import AsyncIterator
from typing import Protocol

from backend.config import Settings


class LLMClient(Protocol):
    def stream(self, messages: list[dict], system: str) -> AsyncIterator[str]: ...


def create_llm_client(settings: Settings) -> LLMClient:
    provider = settings.llm_provider.strip().lower()

    if provider == "ollama":
        from backend.services.ollama_client import OllamaClient
        return OllamaClient(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            max_tokens=settings.max_tokens,
            context_window=settings.ollama_context_window,
            keep_alive=settings.ollama_keep_alive,
        )

    if provider == "anthropic":
        if not settings.anthropic_api_key or settings.anthropic_api_key.startswith("sk-ant-your"):
            raise RuntimeError("LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set in .env")
        from backend.services.claude_client import ClaudeClient
        return ClaudeClient(
            api_key=settings.anthropic_api_key,
            model=settings.model,
            max_tokens=settings.max_tokens,
        )

    raise RuntimeError(f"Unknown LLM_PROVIDER '{settings.llm_provider}' — use 'ollama' or 'anthropic'")
