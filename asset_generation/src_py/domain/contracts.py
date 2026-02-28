from __future__ import annotations

import hashlib
import json

from pydantic import BaseModel, ConfigDict, Field

from .models import CacheManifest, Diagnostics, Layout, Placement, World
from .mood import RoomMood
from .rendering import RenderArtifact, RenderProfile, RenderRequest, RenderTargetFormat


def world_hash(world: World) -> str:
    serialized = json.dumps(world.model_dump(mode="json"), sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


class InitializeWorldRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    world: World
    seed: int = 0
    target_format: RenderTargetFormat = RenderTargetFormat.PNG
    profile: RenderProfile = Field(default_factory=RenderProfile)


class UpdateWorldRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    world: World
    layout: Layout
    placement: Placement
    previous_world_hash: str | None = None
    target_format: RenderTargetFormat = RenderTargetFormat.PNG
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
    moods: dict[str, RoomMood] = Field(default_factory=dict)
    cache_manifest: CacheManifest
    diagnostics: Diagnostics


def _coerce_connection(raw: object) -> dict:
    if not isinstance(raw, dict):
        return {}
    out = {
        "location_id": raw.get("location_id"),
    }
    if "state" in raw:
        out["state"] = raw.get("state")
    return out


def _coerce_item(raw: object) -> dict:
    if not isinstance(raw, dict):
        return {}
    out = {
        "id": raw.get("id"),
        "category": raw.get("category"),
        "name": raw.get("name"),
        "description": raw.get("description"),
    }
    if "notes" in raw:
        out["notes"] = raw.get("notes")
    return out


def _coerce_object(raw: object) -> dict:
    if not isinstance(raw, dict):
        return {}
    out = {
        "id": raw.get("id"),
        "category": raw.get("category"),
        "name": raw.get("name"),
        "description": raw.get("description"),
    }
    if "notes" in raw:
        out["notes"] = raw.get("notes")
    if "state" in raw:
        out["state"] = raw.get("state")
    contains = raw.get("contains")
    if isinstance(contains, list):
        out["contains"] = [_coerce_item(item) for item in contains]
    return out


def _coerce_person(raw: object) -> dict:
    if not isinstance(raw, dict):
        return {}
    out = {
        "id": raw.get("id"),
        "name": raw.get("name"),
        "description": raw.get("description"),
    }
    if "notes" in raw:
        out["notes"] = raw.get("notes")
    if "state" in raw:
        out["state"] = raw.get("state")
    return out


def _coerce_location(raw: object) -> dict:
    if not isinstance(raw, dict):
        return {}
    out = {
        "name": raw.get("name"),
        "description": raw.get("description"),
    }
    connections = raw.get("connections")
    if isinstance(connections, list):
        out["connections"] = [_coerce_connection(connection) for connection in connections]
    people = raw.get("people")
    if isinstance(people, list):
        out["people"] = [_coerce_person(person) for person in people]
    objects = raw.get("objects")
    if isinstance(objects, list):
        out["objects"] = [_coerce_object(obj) for obj in objects]
    return out


def coerce_world_payload(payload: object) -> dict:
    if not isinstance(payload, dict):
        return {}
    if isinstance(payload.get("world"), dict):
        world_like = payload["world"]
    elif isinstance(payload.get("game_world"), dict):
        world_like = payload["game_world"]
    elif isinstance(payload.get("locations"), dict):
        world_like = payload
    else:
        world_like = {}
    locations_raw = world_like.get("locations") if isinstance(world_like, dict) else None
    if not isinstance(locations_raw, dict):
        return {}
    return {
        "locations": {
            str(location_id): _coerce_location(location)
            for location_id, location in locations_raw.items()
        }
    }
