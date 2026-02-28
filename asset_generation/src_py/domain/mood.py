from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class RoomMood(BaseModel):
    """Atmospheric mood intensities for a room, each 0.0-1.0."""

    model_config = ConfigDict(extra="forbid")

    dim: float = Field(default=0.0, ge=0.0, le=1.0, description="Darkness, low light, shadowy")
    warm: float = Field(default=0.0, ge=0.0, le=1.0, description="Warmth from fire, candles, hearth")
    cold: float = Field(default=0.0, ge=0.0, le=1.0, description="Chill, frost, drafty, unheated")
    dusty: float = Field(default=0.0, ge=0.0, le=1.0, description="Dust, age, neglect, cobwebs")
    eerie: float = Field(default=0.0, ge=0.0, le=1.0, description="Unsettling, supernatural, haunted")
    damp: float = Field(default=0.0, ge=0.0, le=1.0, description="Moisture, dripping, mold")
    opulent: float = Field(default=0.0, ge=0.0, le=1.0, description="Luxury, rich furnishings, gilded")
    desolate: float = Field(default=0.0, ge=0.0, le=1.0, description="Emptiness, abandonment, barren")
    tense: float = Field(default=0.0, ge=0.0, le=1.0, description="Danger, urgency, something wrong")
    serene: float = Field(default=0.0, ge=0.0, le=1.0, description="Calm, peaceful, undisturbed")
