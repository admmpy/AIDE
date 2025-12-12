from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import create_pool, close_pool
from app.routers import sql, practice

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle - startup and shutdown."""
    # Startup: create database pool
    await create_pool()
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
    return {
        "status": "healthy",
        "database": "connected",  # TODO: actual DB check
        "ollama": "unknown",  # TODO: actual Ollama check
    }
