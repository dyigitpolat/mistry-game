"""
Mutable player/game state models.
Updated in real-time as the player interacts with the game.
"""

from __future__ import annotations

from typing import Dict, List, Optional
from datetime import datetime

from pydantic import BaseModel, Field


class PlayerState(BaseModel):
    """Current mutable state of the player within a game session."""
    inventory: List[str] = Field(default_factory=list, description="Physical items collected.")
    clues: List[str] = Field(default_factory=list, description="Intangible deductions discovered.")
    epiphanies: List[str] = Field(default_factory=list, description="Knowledge tokens from the Epiphany Engine.")
    current_location: str = Field("", description="Where the player currently is.")
    current_phase: int = Field(0, description="Active phase index.")
    elapsed_minutes: float = Field(0.0, description="In-game time elapsed.")
    notes: str = Field("", description="Player's personal notes / canvas.")
    clue_connections: List[List[str]] = Field(default_factory=list, description="Pairs/groups of connected clues on deduction board.")


class CharacterState(BaseModel):
    """Mutable per-character state during a session."""
    suspicion_meter: int = Field(0, ge=0, le=100)
    is_broken: bool = Field(False, description="True if alibi has been shattered.")
    conversation_history: List[Dict[str, str]] = Field(default_factory=list)


class GameSession(BaseModel):
    """A single play-through of a scenario."""
    id: Optional[str] = Field(None, description="Session ID (set by DB).")
    scenario_id: str = Field(..., description="Reference to the scenario being played.")
    user_id: str = Field(..., description="Owning user.")
    player_state: PlayerState = Field(default_factory=PlayerState)
    character_states: Dict[str, CharacterState] = Field(
        default_factory=dict,
        description="Character name → mutable state.",
    )
    started_at: datetime = Field(default_factory=datetime.utcnow)
    last_action_at: Optional[datetime] = None
    is_complete: bool = False
    outcome: Optional[str] = None  # "solved", "failed", "abandoned"


class ActionRequest(BaseModel):
    """Incoming player action from the frontend."""
    action_type: str = Field("free", description="Type: 'free' (natural language), 'talk', 'present_evidence', 'connect_clues', 'accuse'")
    target: str = Field("", description="Target of the action (location, item, character name).")
    message: str = Field("", description="Free-text message — the player's natural language input.")
    evidence: List[str] = Field(default_factory=list, description="Items being presented.")


class AccuseRequest(BaseModel):
    """Player submits their final accusation to solve the case."""
    suspect: str = Field(..., description="Name of the accused.")
    weapon: str = Field(..., description="The weapon/method of death.")
    motive: str = Field(..., description="Why the suspect committed the crime.")


class PhaseInfo(BaseModel):
    """Current phase context returned to the frontend."""
    id: int
    name: str
    objective: str
    unlocked_locations: List[str] = Field(default_factory=list)
    unlocked_characters: List[str] = Field(default_factory=list)


class AccusationResult(BaseModel):
    """Result of a final accusation."""
    correct: bool
    narrative: str
    correct_suspect: Optional[str] = None
    correct_weapon: Optional[str] = None
    correct_motive: Optional[str] = None


class ActionResponse(BaseModel):
    """Structured response returned to the frontend after processing an action."""
    narrative: str = Field(..., description="Story text to display to the player.")
    state_updates: Optional[PlayerState] = None
    character_state_updates: Dict[str, CharacterState] = Field(default_factory=dict)
    phase_advanced: bool = False
    new_phase: Optional[int] = None
    phase_info: Optional[PhaseInfo] = None
    character_reaction: Optional[str] = None
    visual_metadata_diff: Optional[Dict] = None
    error: Optional[str] = None
    # Enriched fields for frontend UI
    new_clues: List[str] = Field(default_factory=list, description="Clues discovered in this action.")
    new_items: List[str] = Field(default_factory=list, description="Items picked up in this action.")
    new_location: Optional[str] = Field(None, description="Location the player moved to.")
    scene_image_url: Optional[str] = Field(None, description="Generated scene image URL for current location.")
    accusation_result: Optional[AccusationResult] = None
    characters_in_room: List[str] = Field(default_factory=list, description="Characters available at current location/phase.")
