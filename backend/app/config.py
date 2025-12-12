from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # PostgreSQL (macOS Homebrew default: current user, no password)
    database_url: str = "postgresql://localhost:5432/aide"
    db_pool_min_size: int = 2
    db_pool_max_size: int = 10
    
    # Ollama LLM
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:4b"
    
    # Query limits
    max_query_rows: int = 1000
    max_query_timeout_seconds: int = 30
    
    # Practice mode limits
    max_practice_tables: int = 5
    max_practice_rows: int = 100
    rate_limit_per_minute: int = 3
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
