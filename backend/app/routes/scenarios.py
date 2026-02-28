"""
Scenario routes — list and get available scenarios.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.game_engine import GameEngine

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


@router.get("/", response_model=List[ScenarioSummary])
async def list_scenarios():
    """List all available scenarios for the case gallery."""
    summaries = []
    for sid, scenario in _engine.scenarios.items():
        summaries.append(ScenarioSummary(
            id=sid,
            title=scenario.title,
            description=scenario.description,
            victim=scenario.victim,
            difficulty="medium",  # Default
            phase_count=len(scenario.phases),
        ))
    return summaries


@router.get("/{scenario_id}")
async def get_scenario(scenario_id: str):
    """Get full scenario data (Knowledge Graph)."""
    scenario = _engine.load_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")
    return scenario
