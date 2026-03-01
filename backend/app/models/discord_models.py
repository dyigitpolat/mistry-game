"""
Discord integration models for Mistry Game.
Handles guild-session linking and speech summarization notes.
"""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


# ─── Speech Summarization Schemas ─────────────────────────────────────


class ClueNote(BaseModel):
    """A clue discussed in the conversation."""
    name: str = Field(..., description="Short name/title of the clue")
    description: str = Field(..., description="What was discussed about this clue")
    significance: str = Field(default="unknown", description="Why this clue matters (high/medium/low/unknown)")


class SuspectNote(BaseModel):
    """A suspect discussed in the conversation."""
    name: str = Field(..., description="Name of the suspect")
    motive: Optional[str] = Field(None, description="Suspected motive if discussed")
    alibi: Optional[str] = Field(None, description="Their alibi if mentioned")
    suspicion_level: str = Field(default="unknown", description="Level of suspicion (high/medium/low/unknown)")
    notes: str = Field(default="", description="Additional observations about this suspect")


class ItemNote(BaseModel):
    """An item/object discussed in the conversation."""
    name: str = Field(..., description="Name of the item")
    relevance: str = Field(..., description="Why this item is relevant to the mystery")
    location_found: Optional[str] = Field(None, description="Where this item was found")


class LocationNote(BaseModel):
    """A location discussed in the conversation."""
    name: str = Field(..., description="Name of the location")
    significance: str = Field(..., description="Why this location matters")
    events: List[str] = Field(default_factory=list, description="What happened here")


class TheoryNote(BaseModel):
    """A theory or deduction made during discussion."""
    theory: str = Field(..., description="The theory or deduction")
    supporting_evidence: List[str] = Field(default_factory=list, description="Evidence supporting this theory")
    counter_evidence: List[str] = Field(default_factory=list, description="Evidence against this theory")
    proposed_by: Optional[str] = Field(None, description="Who proposed this theory if identifiable")


# ─── Discussion Summary (from speech) ─────────────────────────────────


class DiscussionSummary(BaseModel):
    """Complete structured summary of a mystery game discussion from speech."""

    # Metadata
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    duration_discussed: Optional[str] = Field(None, description="Approximate discussion duration")

    # Transcript
    transcript: Optional[str] = Field(None, description="Raw transcript of what was spoken")

    # Historical summary
    summary: str = Field(..., description="Brief narrative summary of what was discussed")
    key_points: List[str] = Field(default_factory=list, description="Bullet points of main discussion topics")

    # Game entities discussed
    clues: List[ClueNote] = Field(default_factory=list)
    suspects: List[SuspectNote] = Field(default_factory=list)
    items: List[ItemNote] = Field(default_factory=list)
    locations: List[LocationNote] = Field(default_factory=list)

    # Theories and next steps
    theories: List[TheoryNote] = Field(default_factory=list)
    action_items: List[str] = Field(default_factory=list, description="Next steps or things to investigate")
    unresolved_questions: List[str] = Field(default_factory=list, description="Questions that remain unanswered")


# ─── Discord Guild Link ───────────────────────────────────────────────


class DiscordGuildLink(BaseModel):
    """Links a Discord guild to a game session."""
    id: Optional[str] = Field(None, description="Link ID (set by DB)")
    guild_id: str = Field(..., description="Discord guild/server ID")
    guild_name: str = Field(..., description="Discord guild/server name")
    session_id: str = Field(..., description="Game session ID")
    scenario_id: str = Field(..., description="Scenario being played")
    voice_channel_id: Optional[str] = Field(None, description="Active voice channel ID")
    text_channel_id: Optional[str] = Field(None, description="Text channel for bot responses")
    linked_by: str = Field(..., description="User ID who linked the session")
    linked_at: datetime = Field(default_factory=datetime.utcnow)
    is_recording: bool = Field(False, description="Whether voice recording is active")


class DiscordLinkRequest(BaseModel):
    """Request to link a Discord guild to a game session."""
    guild_id: str
    guild_name: str
    session_id: str
    scenario_id: str
    text_channel_id: Optional[str] = None
    linked_by: str


class DiscordLinkResponse(BaseModel):
    """Response after linking Discord to a session."""
    status: str
    link_id: str
    session_id: str
    guild_name: str


# ─── Discussion Note (stored in DB) ───────────────────────────────────


class DiscussionNote(BaseModel):
    """A stored discussion note from speech summarization."""
    id: Optional[str] = Field(None, description="Note ID (set by DB)")
    session_id: str = Field(..., description="Game session ID")
    guild_id: str = Field(..., description="Discord guild ID where recorded")

    # Summarization content
    summary: DiscussionSummary = Field(..., description="Structured summary")

    # Metadata
    recorded_at: datetime = Field(default_factory=datetime.utcnow)
    duration_seconds: Optional[float] = Field(None, description="Recording duration")
    recorded_by: Optional[str] = Field(None, description="User who started recording")


class DiscussionNoteResponse(BaseModel):
    """Response format for discussion notes API."""
    id: str
    session_id: str
    summary: str
    key_points: List[str]
    clues: List[ClueNote]
    suspects: List[SuspectNote]
    items: List[ItemNote]
    locations: List[LocationNote]
    theories: List[TheoryNote]
    action_items: List[str]
    unresolved_questions: List[str]
    recorded_at: datetime
    duration_seconds: Optional[float]


# ─── Discord Session State ────────────────────────────────────────────


class DiscordSessionState(BaseModel):
    """Tracks active Discord session state."""
    session_id: str
    guild_id: str
    is_linked: bool = False
    is_recording: bool = False
    recording_started_at: Optional[datetime] = None
    recording_user_id: Optional[str] = None
    notes_count: int = 0


class DiscordStatusResponse(BaseModel):
    """Response for Discord status endpoint."""
    is_linked: bool
    guild_id: Optional[str] = None
    guild_name: Optional[str] = None
    is_recording: bool = False
    notes_count: int = 0
    bot_invite_url: str = ""


# ─── Audio Summarization Request ──────────────────────────────────────


class SummarizeAudioRequest(BaseModel):
    """Request to summarize uploaded audio."""
    recorded_by: Optional[str] = None
    duration_seconds: Optional[float] = None


class SummarizeAudioResponse(BaseModel):
    """Response after audio summarization."""
    status: str
    note_id: str
    summary: DiscussionSummary
