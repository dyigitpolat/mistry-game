from __future__ import annotations

import hashlib
import json

from pydantic import BaseModel, ConfigDict, Field

from .models import CacheManifest, Diagnostics, Layout, Placement, World
from .rendering import RenderArtifact, RenderProfile, RenderRequest, RenderTargetFormat


def world_hash(world: World) -> str:
    serialized = json.dumps(world.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class InitializeWorldRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    world: World
    seed: int = 0
    target_format: RenderTargetFormat = RenderTargetFormat.SVG
    profile: RenderProfile = Field(default_factory=RenderProfile)


class UpdateWorldRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    world: World
    layout: Layout
    placement: Placement
    previous_world_hash: str | None = None
    target_format: RenderTargetFormat = RenderTargetFormat.SVG
    profile: RenderProfile = Field(default_factory=RenderProfile)


class RenderBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requests: list[RenderRequest]
    profile: RenderProfile = Field(default_factory=RenderProfile)


class RenderBatchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    artifacts: dict[str, RenderArtifact]
    cache_manifest: CacheManifest
    diagnostics: Diagnostics


class WorldResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    world: World
    world_hash: str
    layout: Layout
    placement: Placement
    artifacts: dict[str, RenderArtifact]
    cache_manifest: CacheManifest
    diagnostics: Diagnostics
