"""
Scenario routes — list and get available scenarios.
"""

from __future__ import annotations

from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.services.game_engine import GameEngine
from app.core.auth import get_current_user_optional
from app.db.mongodb import get_database

router = APIRouter()
_engine = GameEngine()


class ScenarioSummary(BaseModel):
    """Lightweight view for the case gallery."""
    id: str
    title: str
    description: str
    victim: str
    difficulty: str = "medium"
    phase_count: int = 0
    progress_percent: float = 0.0
    is_complete: bool = False
    last_played_at: Optional[datetime] = None


@router.get("/", response_model=List[ScenarioSummary])
async def list_scenarios(user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """List all available scenarios for the case gallery, factoring in progress if logged in."""
    summaries = []
    
    # If the user is logged in, find all their active game sessions
    user_sessions = {}
    if user:
        db = await get_database()
        if db is not None:
            # Query the latest session per scenario
            cursor = db["game_sessions"].find({"user_id": user["id"]}).sort("updated_at", -1)
            async for doc in cursor:
                sid = doc.get("scenario_id")
                # Store the most recent session we see for each scenario
                if sid not in user_sessions:
                    user_sessions[sid] = doc

    for sid, scenario in _engine.scenarios.items():
        summary = ScenarioSummary(
            id=sid,
            title=scenario.title,
            description=scenario.description,
            victim=scenario.victim,
            difficulty="medium",  # Default, read from scenario later if added
            phase_count=len(scenario.phases),
        )

        # Attach progress if a session exists
        if sid in user_sessions:
            session_doc = user_sessions[sid]
            state = session_doc.get("player_state", {})
            current_phase = state.get("current_phase", 0)
            phase_count = len(scenario.phases)
            
            # Calculate naive progress based on phase completion
            if phase_count > 0:
                summary.progress_percent = (current_phase / phase_count) * 100
                
            summary.is_complete = session_doc.get("is_complete", False)
            if summary.is_complete:
                summary.progress_percent = 100.0
                
            # updated_at from DB
            summary.last_played_at = session_doc.get("updated_at")

        summaries.append(summary)
        
    return summaries


@router.get("/{scenario_id}")
async def get_scenario(scenario_id: str):
    """Get full scenario data (Knowledge Graph)."""
    scenario = _engine.load_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")
    return scenario
