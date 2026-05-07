from collections.abc import AsyncIterator
from google import genai
from google.genai import types


class GeminiClient:
    def __init__(self, api_key: str, model: str, max_tokens: int) -> None:
        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._max_tokens = max_tokens

    async def stream(
        self, messages: list[dict], system: str
    ) -> AsyncIterator[str]:
        contents = [
            types.Content(
                role="model" if msg["role"] == "assistant" else msg["role"],
                parts=[types.Part(text=msg["content"])],
            )
            for msg in messages
        ]

        config = types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=self._max_tokens,
        )

        async for chunk in await self._client.aio.models.generate_content_stream(
            model=self._model,
            contents=contents,
            config=config,
        ):
            if chunk.text:
                yield chunk.text
