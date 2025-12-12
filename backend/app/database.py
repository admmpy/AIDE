import asyncpg
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import HTTPException

from app.config import get_settings

settings = get_settings()

# Global connection pool
_pool: Optional[asyncpg.Pool] = None


def is_pool_available() -> bool:
    """Check if the database pool is available."""
    return _pool is not None


async def create_pool() -> asyncpg.Pool:
    """Create the database connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=settings.db_pool_min_size,
            max_size=settings.db_pool_max_size,
        )
    return _pool


async def close_pool() -> None:
    """Close the database connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


async def get_pool() -> asyncpg.Pool:
    """Get the current connection pool, creating it if necessary."""
    if _pool is None:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please ensure PostgreSQL is running."
        )
    return _pool


@asynccontextmanager
async def get_connection():
    """Context manager to acquire a connection from the pool."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn
