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

from app.routes import game, generate, scenarios, scenes, stats, profile, discord  # noqa: E402
from app.db.mongodb import connect_to_mongo, close_mongo_connection
from app.db.redis_cache import connect_to_redis, close_redis_connection

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
    if os.getenv("MISTRAL_API_KEY"):
        print("🎙️ Voxtral speech summarization enabled")
    if os.getenv("DISCORD_BOT_TOKEN"):
        print("🎮 Discord integration available")

    # Scenes directory is resolved globally
    # Connect to Databases
    await connect_to_mongo()
    await connect_to_redis()

    # Load any user-generated scenarios from MongoDB into the GameEngine
    from app.services.game_engine import GameEngine
    engine = GameEngine._shared_instance
    if engine is None:
        print("🔮 Initializing GameEngine for the first time...")
        engine = GameEngine()
        
    await engine.load_scenarios_from_db()
    print(f"🔮 Total scenarios loaded: {len(engine.scenarios)}")

    yield
    # ── Shutdown ──
    print("🔮 Mistry Backend shutting down…")
    await close_mongo_connection()
    await close_redis_connection()


app = FastAPI(
    title="Mistry Engine",
    description="Backend API for the Mistry multi-agent detective game. "
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
app.include_router(game.router, prefix="/game", tags=["game"])
app.include_router(scenarios.router, prefix="/scenarios", tags=["scenarios"])
app.include_router(generate.router, prefix="/scenarios", tags=["generation"])
app.include_router(scenes.router, prefix="/scenes", tags=["scenes"])
app.include_router(stats.router, prefix="/stats", tags=["stats"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])
app.include_router(discord.router, prefix="/discord", tags=["discord"])


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

# ── Static Files ──────────────────────────────────────────────────────
# Mounted AFTER routers to prevent shadowing the /scenes API endpoints
scenes_dir = _project_root / "backend" / "data" / "scenes"
scenes_dir.mkdir(parents=True, exist_ok=True)
app.mount("/scenes", StaticFiles(directory=str(scenes_dir)), name="scenes_static")
