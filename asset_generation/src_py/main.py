from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from src_py.api.routes import router

_THIS_FILE = Path(__file__).resolve()
_ASSET_GENERATION_DIR = _THIS_FILE.parents[1]
_REPO_ROOT = _THIS_FILE.parents[2]
load_dotenv(_ASSET_GENERATION_DIR / ".env")
load_dotenv(_REPO_ROOT / ".env")

app = FastAPI(title="Mistry Asset Generation API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
