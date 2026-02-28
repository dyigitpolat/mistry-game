"""
Scenario routes — list, get, and manage available scenarios.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.services.game_engine import GameEngine
from app.core.auth import get_current_user, get_current_user_optional
from app.db.mongodb import get_database

router = APIRouter()
_engine = GameEngine()


class ScenarioSummary(BaseModel):
    """Lightweight view for the case gallery."""
    id: str
    title: str
    author: str = ""
    description: str
    victim: str
    difficulty: str = "medium"
    phase_count: int = 0
    progress_percent: float = 0.0
    is_complete: bool = False
    last_played_at: Optional[datetime] = None
    owner_id: Optional[str] = None
    owner_name: Optional[str] = None
    visibility: str = "public"
    is_own: bool = False
    global_clear_rate: float = 0.0


async def _resolve_user_name(user_id: str) -> Optional[str]:
    """Look up a user's display name from the NextAuth users collection."""
    db = await get_database()
    if db is None:
        return None
    user_doc = await db["users"].find_one({"_id": user_id})
    if not user_doc:
        from bson import ObjectId
        try:
            user_doc = await db["users"].find_one({"_id": ObjectId(user_id)})
        except Exception:
            pass
    return user_doc.get("name") if user_doc else None


def _check_ownership(scenario, user_id: str, user_name: Optional[str]) -> bool:
    """
    Check if the given user owns a scenario.
    Matches on owner_id first, falls back to owner_name for file-based
    scenarios that were created before the owner_id system existed.
    """
    if scenario.owner_id and scenario.owner_id == user_id:
        return True
    if (
        not scenario.owner_id
        and scenario.owner_name
        and user_name
        and scenario.owner_name.lower() == user_name.lower()
    ):
        return True
    return False

  @router.get("/", response_model=List[ScenarioSummary])
  async def list_scenarios(user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """
    List scenarios visible to the current user.
    Public scenarios are shown to everyone.
    Private scenarios are only shown to their owner.
    Includes global clear rates and user progress if logged in.
    """
    db = await get_database()
    summaries = []

    # Fetch Global Clear Rates
    global_stats = {}
    if db is not None:
        pipeline = [
            {"$group": {
                "_id": "$scenario_id",
                "total_plays": {"$sum": 1},
                "clears": {"$sum": {"$cond": [{"$and": [{"$eq": ["$is_complete", True]}, {"$eq": ["$outcome", "solved"]}]}, 1, 0]}}
            }}
        ]
        cursor = db["game_sessions"].aggregate(pipeline)
        async for doc in cursor:
            sid = doc["_id"]
            total = doc["total_plays"]
            clears = doc["clears"]
            global_stats[sid] = round((clears / total) * 100) if total > 0 else 0.0

    # If the user is logged in, find all their active game sessions and resolve name
    user_sessions: Dict[str, Any] = {}
    user_name: Optional[str] = None

    if user:
        if db is not None:
            cursor = db["game_sessions"].find({"user_id": user["id"]}).sort("updated_at", -1)
            async for doc in cursor:
                sid = doc.get("scenario_id")
                if sid not in user_sessions:
                    user_sessions[sid] = doc
        user_name = await _resolve_user_name(user["id"])

    for sid, scenario in _engine.scenarios.items():
        is_public = scenario.visibility.value == "public" if scenario.visibility else True
        is_owner = bool(user) and _check_ownership(scenario, user["id"], user_name) if user else False

        if not is_public and not is_owner:
            continue

        summary = ScenarioSummary(
            id=sid,
            title=scenario.title,
            author=getattr(scenario, 'author', '') or '',
            description=scenario.description,
            victim=scenario.victim,
            difficulty=scenario.difficulty.value if scenario.difficulty else "medium",
            phase_count=len(scenario.phases),
            owner_id=scenario.owner_id,
            owner_name=scenario.owner_name,
            visibility=scenario.visibility.value if scenario.visibility else "public",
            is_own=is_owner,
            global_clear_rate=global_stats.get(sid, 0.0),
        )

        if sid in user_sessions:
            session_doc = user_sessions[sid]
            state = session_doc.get("player_state", {})
            current_phase = state.get("current_phase", 0)
            phase_count = len(scenario.phases)

            if phase_count > 0:
                summary.progress_percent = (current_phase / phase_count) * 100

            summary.is_complete = session_doc.get("is_complete", False)
            if summary.is_complete:
                summary.progress_percent = 100.0

            summary.last_played_at = session_doc.get("updated_at")

        summaries.append(summary)

    return summaries

async def _set_visibility(scenario_id: str, user: Dict[str, Any], target: str):
    """Shared helper to change a scenario's visibility. Only the owner can do this."""
    from app.models.scenario import ScenarioVisibility

    scenario = _engine.load_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    user_name = await _resolve_user_name(user["id"])
    if not _check_ownership(scenario, user["id"], user_name):
        raise HTTPException(status_code=403, detail="Only the owner can change visibility.")

    if scenario.visibility.value == target:
        raise HTTPException(status_code=400, detail=f"Scenario is already {target}.")

    scenario.visibility = ScenarioVisibility(target)

    db = await get_database()
    if db is not None:
        await db["scenarios"].update_one(
            {"_id": scenario_id},
            {"$set": {"visibility": target}},
        )

    persist_path = Path(__file__).parent.parent.parent / "data" / f"{scenario_id}.json"
    if persist_path.exists():
        data = json.loads(persist_path.read_text(encoding="utf-8"))
        data["visibility"] = target
        persist_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    return {"status": target, "scenario_id": scenario_id, "visibility": target}


@router.post("/{scenario_id}/publish")
async def publish_scenario(
    scenario_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Make a private scenario public. Only the owner can do this."""
    return await _set_visibility(scenario_id, user, "public")


@router.post("/{scenario_id}/unpublish")
async def unpublish_scenario(
    scenario_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Make a public scenario private again. Only the owner can do this."""
    return await _set_visibility(scenario_id, user, "private")


@router.get("/{scenario_id}")
async def get_scenario(scenario_id: str):
    """Get full scenario data (Knowledge Graph)."""
    scenario = _engine.load_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")
    return scenario
