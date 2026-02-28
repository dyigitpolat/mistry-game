"""
Pydantic models ported from Specs.md — Knowledge Graph schema.
These define the immutable "Ground Truth" for each game scenario.
"""

from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional, Literal

from pydantic import BaseModel, Field


# ─── Enums ───────────────────────────────────────────────────────────

class VisibilityState(str, Enum):
    VISIBLE = "visible"
    PARTIALLY_HIDDEN = "partially hidden"
    HIDDEN = "hidden"


class CharacterType(str, Enum):
    SUSPECT = "suspect"
    ASSISTANT = "assistant"


class ConnectionState(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    LOCKED = "locked"
    LOCKED_FROM_INSIDE = "locked from inside"


# ─── Location sub-models ─────────────────────────────────────────────

class SceneObject(BaseModel):
    item_id: str = Field(..., description="Unique identifier or name of the item.")
    visibility: VisibilityState = Field(..., description="How visible the object is initially.")
    hidden_by: Optional[str] = Field(None, description="What is concealing it, if hidden.")


class SurfaceOrContainer(BaseModel):
    id: str = Field(..., description="Name of the furniture or area.")
    type: Literal["surface", "container"] = Field(..., description="Whether items rest ON it or INSIDE it.")
    spatial_relationship: str = Field(..., description="Where it is located in the room.")
    objects: List[SceneObject] = Field(default_factory=list)


class Connection(BaseModel):
    target_location: str = Field(..., description="The connected Location name.")
    mechanism: str = Field(..., description="The physical boundary (door, window, path).")
    state: ConnectionState = Field(..., description="Current traversal state.")


class VisualMetadata(BaseModel):
    """Hierarchical visual representation for scene reconstruction."""
    setting: str = Field(..., description="Rich atmospheric description of the room.")
    connections: List[Connection] = Field(default_factory=list)
    surfaces_and_containers: List[SurfaceOrContainer] = Field(default_factory=list)


class Location(BaseModel):
    description: str = Field(..., description="Text description shown to the player.")
    items: List[str] = Field(default_factory=list, description="Physical inventory items here.")
    clues: List[str] = Field(default_factory=list, description="Observations/deductions found here.")
    base_ascii: str = Field("", description="ASCII art of the room layout.")
    visual_metadata: VisualMetadata = Field(..., description="Structured spatial data.")


# ─── Character models ────────────────────────────────────────────────

class ConditionalBehavior(BaseModel):
    """Triggers evaluated by the Character Agent for dynamic responses."""
    applicable_phases: List[int] = Field(..., description="Phase IDs where this behavior is active.")
    required_evidence: List[str] = Field(default_factory=list, description="Items player MUST have.")
    required_knowledge: List[str] = Field(default_factory=list, description="Clues player MUST have.")
    reaction: str = Field(..., description="How the character reacts if conditions are met.")
    leads_to_break: bool = Field(False, description="If True, forces a confession.")


class Character(BaseModel):
    type: CharacterType
    role: str = Field(..., description="Relationship to the narrative.")
    location: str = Field(..., description="Starting location.")
    phase_locations: Dict[int, str] = Field(..., description="Phase ID → Location mapping.")
    persona: str = Field(..., description="LLM roleplay instructions.")
    knowledge_about_others: Dict[str, str] = Field(default_factory=dict)
    secret: str = Field("", description="Hidden truth they protect (mandatory for suspects).")
    abilities: str = Field("", description="How they can assist (mandatory for assistants).")
    conditional_behaviors: List[ConditionalBehavior] = Field(default_factory=list)
    suspicion_meter: int = Field(0, ge=0, le=100)
    flight_risk: int = Field(0, ge=0, le=100)


# ─── Phase & Win Conditions ──────────────────────────────────────────

class Phase(BaseModel):
    """Breakpoints controlling narrative pacing."""
    id: int
    name: str
    objective: str
    unlocked_locations: List[str]
    unlocked_characters: List[str]


class WinConditions(BaseModel):
    required_weapon: str
    required_suspect: str
    required_motive: str


class ScenarioDifficulty(str, Enum):
    """Pre-set difficulty classification for a scenario."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


# ─── Root Scenario model ────────────────────────────────────────────

class Scenario(BaseModel):
    """The root Knowledge Graph object."""
    title: str
    description: str = Field("", description="Short non-spoiler description.")
    victim: str
    intro_narrative: str
    time_limit_minutes: int = 180
    start_time: str = Field(..., description="In-game starting time.")
    win_conditions: WinConditions
    phases: List[Phase]
    locations: Dict[str, Location]
    characters: Dict[str, Character]
    difficulty: ScenarioDifficulty = Field(ScenarioDifficulty.MEDIUM, description="Pre-set difficulty classification.")
