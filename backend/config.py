from pydantic_settings import BaseSettings, SettingsConfigDict


SYSTEM_PROMPT = """You are J.A.R.V.I.S., a highly intelligent AI assistant modeled after the one from Iron Man. \
You are witty, precise, and slightly formal but warm. You address the user as "sir" occasionally. \
You give concise, expert answers. When reviewing code, you are thorough and precise. \
You have access to any code the user pastes in their context window. \
Keep responses reasonably short unless the question demands depth. \
Never use markdown headers. Use plain text or code blocks only."""


class Settings(BaseSettings):
    # Which model backend to use: "ollama" (local, free) or "anthropic" (paid API)
    llm_provider: str = "ollama"

    # Ollama — local models, see ollama.com
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "gemma3:12b"
    ollama_context_window: int = 8192
    ollama_keep_alive: str = "10m"  # unload the model from VRAM after 10 idle minutes

    # Anthropic — only needed when llm_provider = "anthropic"
    anthropic_api_key: str = ""
    model: str = "claude-sonnet-4-6"
    max_tokens: int = 2048
    db_path: str = "data/conversations.db"

    # Speech-to-text: "whisper" (local on GPU, private) or "google" (free web API)
    stt_engine: str = "whisper"
    whisper_model: str = "large-v3-turbo"
    whisper_device: str = "auto"  # auto | cuda | cpu
    stt_language: str = "en"      # "en", "pt", ... or "" to auto-detect

    # ElevenLabs TTS — optional; falls back to browser TTS if not set
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "onwK4e9ZLuTAKqWW03F9"  # Daniel — British authoritative male

    # Picovoice wake word — optional; get a free key at picovoice.ai
    picovoice_access_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
