from __future__ import annotations

import hashlib
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SubjectType(str, Enum):
    WORLD_OBJECT = "world_object"
    WORLD_ITEM = "world_item"
    WORLD_PERSON = "world_person"
    GENERIC_OBJECT = "generic_object"


class ArtifactType(str, Enum):
    VECTOR = "vector"
    RASTER = "raster"


class RenderTargetFormat(str, Enum):
    SVG = "svg"
    PNG = "png"


class ViewBox(BaseModel):
    model_config = ConfigDict(extra="forbid")

    w: int = Field(gt=0)
    h: int = Field(gt=0)


def _env(key: str, default: str) -> str:
    import os
    return os.getenv(key, default)


class RenderProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    style_profile: str = "clean-minimal"
    provider: str = Field(default_factory=lambda: _env("ASSET_PROVIDER", "fal-ai"))
    model: str = Field(default_factory=lambda: _env("ASSET_MODEL", "fal-ai/nano-banana-2"))
    temperature: float = 0.2
    version: str = "v1"


class RenderRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    subject_type: SubjectType
    subject_id: str
    description: str = Field(min_length=1)
    state: str = "default"
    target_format: RenderTargetFormat = RenderTargetFormat.PNG
    view_box: ViewBox | None = None
    constraints: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

    def fingerprint(self, profile: RenderProfile) -> str:
        basis = "|".join(
            [
                self.subject_type.value,
                self.subject_id,
                self.state,
                self.target_format.value,
                self.description,
                str(self.view_box.model_dump() if self.view_box else None),
                str(sorted(self.constraints.items())),
                profile.provider,
                profile.model,
                profile.style_profile,
                profile.version,
            ]
        )
        return hashlib.sha256(basis.encode("utf-8")).hexdigest()


class RenderVariantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject_type: SubjectType
    subject_id: str
    key_template: str
    states: dict[str, str]
    target_format: RenderTargetFormat = RenderTargetFormat.PNG
    view_box: ViewBox | None = None
    constraints: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)

    def build_key(self, state: str) -> str:
        return self.key_template.format(state=state)

    def fingerprint(self, profile: "RenderProfile") -> str:
        basis = "|".join(
            [
                self.subject_type.value,
                self.subject_id,
                str(sorted(self.states.items())),
                self.target_format.value,
                str(self.view_box.model_dump() if self.view_box else None),
                str(sorted(self.constraints.items())),
                profile.provider,
                profile.model,
                profile.style_profile,
                profile.version,
            ]
        )
        return hashlib.sha256(basis.encode("utf-8")).hexdigest()


class RenderArtifact(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    artifact_type: ArtifactType
    mime_type: str
    content: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    version: str = "v1"


class CacheRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str
    fingerprint: str
    artifact: RenderArtifact
