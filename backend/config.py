from pydantic_settings import BaseSettings, SettingsConfigDict


SYSTEM_PROMPT = """You are J.A.R.V.I.S., a highly intelligent AI assistant modeled after the one from Iron Man. \
You are witty, precise, and slightly formal but warm. You address the user as "sir" occasionally. \
You give concise, expert answers. When reviewing code, you are thorough and precise. \
You have access to any code the user pastes in their context window. \
Keep responses reasonably short unless the question demands depth. \
Never use markdown headers. Use plain text or code blocks only."""


class Settings(BaseSettings):
    anthropic_api_key: str
    model: str = "claude-sonnet-4-6"
    max_tokens: int = 2048
    db_path: str = "data/conversations.db"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
