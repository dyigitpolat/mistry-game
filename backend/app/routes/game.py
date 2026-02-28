"""
Game session routes — create, get state, perform actions, accuse, connect clues.
"""

from __future__ import annotations

import uuid
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, Depends

from app.core.auth import get_current_user
from app.db.mongodb import get_database

from app.models.game_state import (
    AccuseRequest,
    ActionRequest,
    ActionResponse,
    GameSession,
    PhaseInfo,
    PlayerState,
    CharacterState,
)
from app.services.game_engine import GameEngine

router = APIRouter()

# ── Engine configuration ───────────────────────────────────────────────
_engine = GameEngine()

async def _get_session(session_id: str, user_id: str) -> GameSession:
    db = await get_database()
    doc = await db.sessions.find_one({"_id": session_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found.")
    doc["id"] = doc.pop("_id")
    return GameSession(**doc)

async def _save_session(session: GameSession):
    db = await get_database()
    doc = session.model_dump()
    doc["_id"] = doc.pop("id")
    await db.sessions.replace_one({"_id": doc["_id"]}, doc, upsert=True)


@router.post("/start", response_model=GameSession)
async def start_game(scenario_id: str, user_auth: Dict[str, Any] = Depends(get_current_user)):
    """Start a new game session for a given scenario."""
    user_id = user_auth["id"]
    scenario = _engine.load_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    db = await get_database()
    
    # Check for an existing incomplete session
    existing_session = await db.sessions.find_one({"user_id": user_id, "scenario_id": scenario_id, "is_complete": False})
    if existing_session:
        existing_session["id"] = existing_session.pop("_id")
        return GameSession(**existing_session)

    session_id = str(uuid.uuid4())

    # Initialize character states from scenario
    char_states = {}
    for name, char in scenario.characters.items():
        char_states[name] = CharacterState(
            suspicion_meter=char.suspicion_meter,
        )

    # Determine starting location from the first Phase object
    start_location = ""
    if scenario.phases:
        unlocked = scenario.phases[0].unlocked_locations
        if unlocked:
            start_location = unlocked[0]

    session = GameSession(
        id=session_id,
        scenario_id=scenario_id,
        user_id=user_id,
        player_state=PlayerState(
            current_location=start_location,
            current_phase=0,  # 0-based array index into scenario.phases[]
        ),
        character_states=char_states,
    )
    await _save_session(session)
    return session


@router.get("/{session_id}/state", response_model=GameSession)
async def get_game_state(session_id: str, user_auth: Dict[str, Any] = Depends(get_current_user)):
    """Get the current state of a game session."""
    session = await _get_session(session_id, user_auth["id"])
    return session


@router.get("/{session_id}/context")
async def get_scenario_context(session_id: str, user_auth: Dict[str, Any] = Depends(get_current_user)):
    """Get current phase info, unlocked locations/characters for the UI."""
    session = await _get_session(session_id, user_auth["id"])

    scenario = _engine.load_scenario(session.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=500, detail="Scenario data missing.")

    phase_idx = session.player_state.current_phase
    phase_info = None
    if phase_idx < len(scenario.phases):
        phase = scenario.phases[phase_idx]
        phase_info = {
            "id": phase.id,
            "name": phase.name,
            "objective": phase.objective,
            "unlocked_locations": phase.unlocked_locations,
            "unlocked_characters": phase.unlocked_characters,
        }

    # Characters at current location
    chars_in_room = _engine._get_characters_at_location(scenario, session.player_state)

    return {
        "phase": phase_info,
        "characters_in_room": chars_in_room,
        "player_state": session.player_state,
        "character_states": session.character_states,
        "is_complete": session.is_complete,
        "outcome": session.outcome,
    }


@router.post("/{session_id}/action", response_model=ActionResponse)
async def perform_action(session_id: str, action: ActionRequest, user_auth: Dict[str, Any] = Depends(get_current_user)):
    """Process a player action through the agent engine."""
    session = await _get_session(session_id, user_auth["id"])

    scenario = _engine.load_scenario(session.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=500, detail="Scenario data missing.")

    if session.is_complete:
        return ActionResponse(
            narrative="This case has already been concluded.",
            characters_in_room=[],
        )

    try:
        response = await _engine.process_action(session, scenario, action)

        # Apply state updates if returned
        if response.state_updates:
            session.player_state = response.state_updates
        if response.phase_advanced and response.new_phase is not None:
            session.player_state.current_phase = response.new_phase

        await _save_session(session)
        return response

    except Exception as e:
        return ActionResponse(
            narrative="Something went wrong processing your action.",
            error=str(e),
            characters_in_room=[],
        )


@router.post("/{session_id}/chat", response_model=ActionResponse)
async def chat_with_character(session_id: str, character_name: str, message: str, user_auth: Dict[str, Any] = Depends(get_current_user)):
    """Chat with a specific character via the Character Agent."""
    session = await _get_session(session_id, user_auth["id"])

    scenario = _engine.load_scenario(session.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=500, detail="Scenario data missing.")

    if character_name not in scenario.characters:
        raise HTTPException(status_code=404, detail=f"Character '{character_name}' not found.")

    action = ActionRequest(
        action_type="talk",
        target=character_name,
        message=message,
    )

    response = await _engine.process_action(session, scenario, action)

    # Apply state updates
    if response.state_updates:
        session.player_state = response.state_updates

    await _save_session(session)
    return response


@router.post("/{session_id}/present_evidence", response_model=ActionResponse)
async def present_evidence(session_id: str, character_name: str, evidence: str, user_auth: Dict[str, Any] = Depends(get_current_user)):
    """Present evidence to a character."""
    session = await _get_session(session_id, user_auth["id"])

    scenario = _engine.load_scenario(session.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=500, detail="Scenario data missing.")

    evidence_list = [e.strip() for e in evidence.split(",") if e.strip()]

    action = ActionRequest(
        action_type="present_evidence",
        target=character_name,
        evidence=evidence_list,
    )

    response = await _engine.process_action(session, scenario, action)

    if response.state_updates:
        session.player_state = response.state_updates

    await _save_session(session)
    return response


@router.post("/{session_id}/connect_clues", response_model=ActionResponse)
async def connect_clues(session_id: str, clues: str, reasoning: str = "", user_auth: Dict[str, Any] = Depends(get_current_user)):
    """Connect clues on the deduction board via the Epiphany Engine."""
    session = await _get_session(session_id, user_auth["id"])

    scenario = _engine.load_scenario(session.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=500, detail="Scenario data missing.")

    clue_list = [c.strip() for c in clues.split(",") if c.strip()]

    action = ActionRequest(
        action_type="connect_clues",
        evidence=clue_list,
        message=reasoning,
    )

    response = await _engine.process_action(session, scenario, action)

    if response.state_updates:
        session.player_state = response.state_updates

    await _save_session(session)
    return response


@router.post("/{session_id}/accuse", response_model=ActionResponse)
async def accuse(session_id: str, accusation: AccuseRequest, user_auth: Dict[str, Any] = Depends(get_current_user)):
    """Submit a final accusation to solve the case."""
    session = await _get_session(session_id, user_auth["id"])

    scenario = _engine.load_scenario(session.scenario_id)
    if scenario is None:
        raise HTTPException(status_code=500, detail="Scenario data missing.")

    if session.is_complete:
        return ActionResponse(
            narrative="This case has already been concluded.",
            characters_in_room=[],
        )

    response = await _engine.process_accusation(session, scenario, accusation)
    
    if session.is_complete and session.outcome == "solved":
        # Finalize the elapsed time. The engine/agents update player_state.elapsed_minutes naturally.
        # We just need to make sure we persist it before concluding.
        # (You could optionally add a real-world clock diff here, but in-game time is better for Leaderboards)
        response.narrative += f"\n\n**Total Investigation Time:** {session.player_state.elapsed_minutes} minutes."
    
    await _save_session(session)
    return response
