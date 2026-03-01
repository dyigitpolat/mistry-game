"""
Pydantic models ported from new schema — Knowledge Graph schema.
These define the immutable "Ground Truth" for each game scenario.
"""

from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional

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
    UNLOCKED = "unlocked"
    LOCKED = "locked"


class ContainerState(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    LOCKED = "locked"


class PersonState(str, Enum):
    ALIVE = "alive"
    DEAD = "dead"


class ObjectCategory(str, Enum):
    SURFACE = "surface"
    CONTAINER = "container"
    ITEM = "item"


# ─── Location sub-models ─────────────────────────────────────────────

class Connection(BaseModel):
    location_id: str = Field(..., description="The ID of the destination location.")
    state: ConnectionState = Field(
        default=ConnectionState.UNLOCKED,
        description="Whether the path to the target location is currently open or blocked."
    )


class Person(BaseModel):
    id: str = Field(..., description="Unique descriptive ID for the character.")
    name: str = Field(..., description="The display name of the person.")
    description: str = Field(..., description="Appearance and current role of the character.")
    notes: str = Field(..., description="AI context regarding personality, secrets, and behavior.")
    state: PersonState = Field(
        default=PersonState.ALIVE,
        description="The current biological status of the person."
    )


class GameObject(BaseModel):
    id: str = Field(..., description="Unique descriptive ID for this specific object instance.")
    category: ObjectCategory = Field(..., description="The type of object: surface, container, or item.")
    name: str = Field(..., description="The display name of the object.")
    description: str = Field(..., description="Surfaces, containers, or loose items found in this location. Prose describing what this object looks like in the room.")
    notes: str = Field(..., description="Internal flavor text, secrets, or AI instructions.")
    state: Optional[ContainerState] = Field(
        default=None,
        description="The physical state of the object. Applicable to containers only."
    )
    contains: Optional[List["GameObject"]] = Field(
        default=None,
        description="A list of items held by this object. Can only be from item category."
    )


class Location(BaseModel):
    description: str = Field(..., description="Text provided to player when entering.")
    clues: List[str] = Field(default_factory=list, description="Intangible deductions.")
    people: List[Person] = Field(
        default_factory=list,
        description="NPCs currently present in this location."
    )
    objects: List[GameObject] = Field(
        default_factory=list,
        description="Surfaces, containers, or loose items found in this location."
    )
    connections: List[Connection] = Field(
        default_factory=list,
        description="A list of directed paths leading to other locations."
    )
    setting: str = Field(..., description="Atmospheric description of the room's aesthetic.")


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
    id: int = Field(..., description="Unique identifier for the phase. Should start at 0 and increment sequentially.")
    name: str
    objective: str
    unlocked_locations: List[str]
    unlocked_characters: List[str]


class WinConditions(BaseModel):
    required_evidence: List[str] = Field(..., description="Item(s) evidence required to win.")
    required_suspect: List[str] = Field(..., description="culprit(s) required to win.")
    required_motive: List[str] = Field(..., description="Motive(s) required to win.")


class ScenarioDifficulty(str, Enum):
    """Pre-set difficulty classification for a scenario."""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ScenarioVisibility(str, Enum):
    PUBLIC = "public"
    PRIVATE = "private"


# ─── GameWorld model ─────────────────────────────────────────────────

class GameWorld(BaseModel):
    locations: Dict[str, Location] = Field(
        ...,
        description="A mapping of location IDs to their full definitions, representing the game world."
    )


# ─── Root Scenario model ────────────────────────────────────────────

class Scenario(BaseModel):
    """The root Knowledge Graph object."""
    title: str
    author: str = Field("", description="Author of the scenario.")
    description: str = Field("", description="Short non-spoiler description.")
    victim: str
    intro_narrative: str
    time_limit_minutes: int = 180
    start_time: str = Field(..., description="In-game starting time.")
    win_conditions: WinConditions
    phases: List[Phase]
    characters: Dict[str, Character]
    game_world: GameWorld = Field(..., description="The game world containing all locations.")
    difficulty: ScenarioDifficulty = Field(ScenarioDifficulty.MEDIUM, description="Pre-set difficulty classification.")
    owner_id: Optional[str] = Field(None, description="User ID of the creator. None for built-in scenarios.")
    owner_name: Optional[str] = Field(None, description="Display name of the creator.")
    visibility: ScenarioVisibility = Field(ScenarioVisibility.PUBLIC, description="Public or private visibility.")
