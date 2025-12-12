import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import create_pool, close_pool, is_pool_available
from app.routers import sql, practice

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown."""
    # Startup: try to create database pool (don't fail if unavailable)
    try:
        await create_pool()
        logger.info("Database pool created successfully")
    except Exception as e:
        logger.warning(f"Could not connect to database: {e}")
        logger.warning("App will start but database features will be unavailable")
    yield
    # Shutdown: close database pool
    await close_pool()


app = FastAPI(
    title="AIDE - SQL Practice Platform",
    description="Local SQL IDE with LLM-powered practice questions",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:3000",  # Alternative port
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(sql.router)
app.include_router(practice.router)


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "AIDE SQL Practice Platform"}


@app.get("/health")
async def health():
    """Detailed health check."""
    from app.services.llm import llm_client
    
    db_status = "connected" if is_pool_available() else "disconnected"
    
    try:
        ollama_ok = await llm_client.is_available()
        ollama_status = "connected" if ollama_ok else "model not found"
    except Exception:
        ollama_status = "disconnected"
    
    overall = "healthy" if db_status == "connected" and ollama_status == "connected" else "degraded"
    
    return {
        "status": overall,
        "database": db_status,
        "ollama": ollama_status,
        "database_url": settings.database_url.split("@")[-1] if "@" in settings.database_url else settings.database_url,
    }
