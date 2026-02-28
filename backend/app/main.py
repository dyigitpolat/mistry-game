"""
Mistry Backend — FastAPI Application Entry Point.

Configured with Langfuse telemetry, CORS, and agent-powered game engine.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Load .env from project root
_project_root = Path(__file__).parent.parent.parent
load_dotenv(_project_root / ".env")

from app.routes import game, scenarios, scenes  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    # ── Startup ──
    print("🔮 Mistry Backend starting up…")

    # Verify critical env vars
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠️  OPENAI_API_KEY not set — agent features will be limited")
    if os.getenv("LANGFUSE_SECRET_KEY"):
        print("📊 Langfuse telemetry enabled")
    if os.getenv("GEMINI_API_KEY"):
        print("🎨 Google Nanobanana scene generation enabled")

    # Mount generated scenes as static files
    scenes_dir = Path("/tmp/mistry-scenes")
    scenes_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/scenes", StaticFiles(directory=str(scenes_dir)), name="scenes")

    yield
    # ── Shutdown ──
    print("🔮 Mistry Backend shutting down…")


app = FastAPI(
    title="Mistry Whodunit Engine",
    description="Backend API for the Whodunit multi-agent detective game. "
                "Powered by GPT-5-mini via deepagents SDK with Langfuse observability.",
    version="0.2.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────
app.include_router(game.router, prefix="/game", tags=["Game"])
app.include_router(scenarios.router, prefix="/scenarios", tags=["Scenarios"])
app.include_router(scenes.router, prefix="/scenes", tags=["Scene Generation"])


# ── Health Check ──────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    agents_status = "unavailable"
    try:
        from mistry_agents import LLMRegistry
        agents_status = "available"
    except ImportError:
        pass

    return {
        "status": "ok",
        "service": "mistry-backend",
        "agents": agents_status,
        "langfuse": bool(os.getenv("LANGFUSE_SECRET_KEY")),
        "scene_gen": bool(os.getenv("GEMINI_API_KEY")),
    }
