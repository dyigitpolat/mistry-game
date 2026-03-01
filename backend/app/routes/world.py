"""
World routes — initialize and update the gameplay world for the canvas UI.

Bridges the main game engine's scenario data with the asset-generation
pipeline so the frontend receives layout, placement, and sprite artifacts.
"""

from __future__ import annotations

import json
from typing import Any, Dict

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import ValidationError

from app.core.auth import get_current_user
from app.db.mongodb import get_database
from app.models.game_state import GameSession
from app.services.game_engine import GameEngine

from src_py.api.dependencies import get_world_service
from src_py.domain.contracts import (
    InitializeWorldRequest,
    UpdateWorldRequest,
    WorldResponse,
    coerce_world_payload,
)
from src_py.domain.models import World

router = APIRouter()

_engine: GameEngine | None = None


def _get_engine() -> GameEngine:
    global _engine
    if _engine is None:
        _engine = GameEngine._shared_instance or GameEngine()
    return _engine


async def _get_session(session_id: str, user_id: str) -> GameSession:
    db = await get_database()
    doc = await db.sessions.find_one({"_id": session_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found.")
    doc["id"] = doc.pop("_id")
    return GameSession(**doc)


def _apply_display_names_to_world(world_dict: dict, name_map: dict) -> None:
    """Replace verbose names with simplified display names in-place."""
    if not name_map:
        return
    locations = world_dict.get("locations", {})
    for loc_data in locations.values():
        loc_name = loc_data.get("name", "")
        if loc_name in name_map:
            loc_data["name"] = name_map[loc_name]
        for obj in loc_data.get("objects", []):
            obj_name = obj.get("name", "")
            if obj_name in name_map:
                obj["name"] = name_map[obj_name]
            for child in obj.get("contains", []) or []:
                child_name = child.get("name", "")
                if child_name in name_map:
                    child["name"] = name_map[child_name]
        for person in loc_data.get("people", []):
            person_name = person.get("name", "")
            if person_name in name_map:
                person["name"] = name_map[person_name]


def _scenario_world_to_asset_world(engine: GameEngine, scenario_id: str) -> World:
    """Extract game_world from a scenario and convert to asset-gen World model."""
    scenario = engine.load_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    world_dict = json.loads(scenario.game_world.model_dump_json())

    # Apply simplified display names before sending to asset generation
    name_map = engine._ensure_display_names(scenario_id)
    _apply_display_names_to_world(world_dict, name_map)

    coerced = coerce_world_payload({"game_world": world_dict})

    try:
        return World.model_validate(coerced)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc


@router.post("/{session_id}/world/initialize", response_model=WorldResponse)
async def initialize_world(
    session_id: str,
    user_auth: Dict[str, Any] = Depends(get_current_user),
) -> WorldResponse:
    """Initialize the gameplay world for the canvas UI.

    Extracts game_world from the session's scenario, computes layout/placement,
    generates sprite artifacts, infers moods, and suggests decorations.
    """
    session = await _get_session(session_id, user_auth["id"])
    engine = _get_engine()
    world = _scenario_world_to_asset_world(engine, session.scenario_id)

    service = get_world_service()
    try:
        request = InitializeWorldRequest(world=world, seed=0)
        return await service.initialize_world(request)
    except RuntimeError as exc:
        detail = str(exc)
        status = 504 if "timed out" in detail.lower() else 502
        raise HTTPException(status_code=status, detail=detail) from exc


@router.post("/{session_id}/world/update", response_model=WorldResponse)
async def update_world(
    session_id: str,
    payload: dict = Body(...),
    user_auth: Dict[str, Any] = Depends(get_current_user),
) -> WorldResponse:
    """Re-render world sprites after state changes (e.g. item pickup, container opened)."""
    await _get_session(session_id, user_auth["id"])

    try:
        coerced_world = coerce_world_payload(payload)
        request = UpdateWorldRequest(
            world=World.model_validate(coerced_world),
            layout=payload["layout"],
            placement=payload["placement"],
            previous_world_hash=payload.get("previous_world_hash"),
        )
        service = get_world_service()
        return await service.update_world(request)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        detail = str(exc)
        status = 504 if "timed out" in detail.lower() else 502
        raise HTTPException(status_code=status, detail=detail) from exc
