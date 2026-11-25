import json
from collections.abc import AsyncIterator

import httpx


class OllamaError(RuntimeError):
    pass


class OllamaClient:
    """Streams chat replies from a local Ollama server (https://ollama.com)."""

    def __init__(
        self,
        base_url: str,
        model: str,
        max_tokens: int,
        context_window: int,
        keep_alive: str,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._max_tokens = max_tokens
        self._context_window = context_window
        self._keep_alive = keep_alive

    async def stream(
        self, messages: list[dict], system: str
    ) -> AsyncIterator[str]:
        payload = {
            "model": self._model,
            "messages": [{"role": "system", "content": system}, *messages],
            "stream": True,
            "keep_alive": self._keep_alive,
            "options": {
                "num_predict": self._max_tokens,
                # Ollama's default context is small and silently drops older
                # messages, which breaks conversation memory.
                "num_ctx": self._context_window,
            },
        }
        timeout = httpx.Timeout(connect=5.0, read=300.0, write=30.0, pool=5.0)
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST", f"{self._base_url}/api/chat", json=payload
                ) as response:
                    if response.status_code != 200:
                        body = (await response.aread()).decode(errors="replace")
                        raise OllamaError(
                            f"Ollama returned {response.status_code}: {body}"
                            + (f" — run `ollama pull {self._model}`" if response.status_code == 404 else "")
                        )
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        data = json.loads(line)
                        if "error" in data:
                            raise OllamaError(data["error"])
                        chunk = data.get("message", {}).get("content", "")
                        if chunk:
                            yield chunk
                        if data.get("done"):
                            break
        except httpx.ConnectError as error:
            raise OllamaError(
                f"Cannot reach Ollama at {self._base_url} — is it installed and running?"
            ) from error
