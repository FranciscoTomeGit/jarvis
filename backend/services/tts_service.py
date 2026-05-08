import httpx


ELEVENLABS_API_BASE = "https://api.elevenlabs.io/v1"


class TTSService:
    def __init__(self, api_key: str, voice_id: str) -> None:
        self._api_key  = api_key
        self._voice_id = voice_id

    @property
    def is_configured(self) -> bool:
        return bool(self._api_key)

    async def synthesize_pcm(self, text: str) -> bytes:
        """Returns raw 16-bit PCM at 16 kHz — playable directly by sounddevice."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ELEVENLABS_API_BASE}/text-to-speech/{self._voice_id}",
                headers={"xi-api-key": self._api_key},
                json={
                    "text": text,
                    "model_id": "eleven_multilingual_v2",
                    "output_format": "pcm_16000",
                    "voice_settings": {
                        "stability":        0.65,
                        "similarity_boost": 0.75,
                    },
                },
                timeout=30.0,
            )
            response.raise_for_status()
            return response.content

    async def synthesize(self, text: str) -> bytes:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{ELEVENLABS_API_BASE}/text-to-speech/{self._voice_id}",
                headers={"xi-api-key": self._api_key},
                json={
                    "text": text,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {
                        "stability":        0.65,
                        "similarity_boost": 0.75,
                    },
                },
                timeout=30.0,
            )
            response.raise_for_status()
            return response.content
