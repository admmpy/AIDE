from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # PostgreSQL (macOS Homebrew default: current user, no password)
    database_url: str = "postgresql://localhost:5432/aide"
    db_pool_min_size: int = 2
    db_pool_max_size: int = 10

    # OpenRouter LLM
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_api_key: str = ""
    openrouter_default_model: str = "openai/gpt-4o-mini"
    openrouter_allowed_models: str = (
        "openai/gpt-4o-mini,google/gemini-3-flash-preview,z-ai/glm-5"
    )

    # Query limits
    max_query_rows: int = 1000
    max_query_timeout_seconds: int = 30

    # Practice mode limits
    max_practice_tables: int = 5
    max_practice_rows: int = 100
    rate_limit_per_minute: int = 3

    def allowed_models_list(self) -> list[str]:
        return [m.strip() for m in self.openrouter_allowed_models.split(",") if m.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
