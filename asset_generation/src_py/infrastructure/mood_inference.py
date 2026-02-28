from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

from src_py.domain.mood import RoomMood

_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".artifact_cache" / "inference"
_mood_cache: dict[str, dict[str, RoomMood]] = {}


def _descriptions_cache_key(descriptions: dict[str, str]) -> str:
    raw = json.dumps(sorted(descriptions.items()), separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _disk_path(cache_key: str) -> Path:
    return _CACHE_DIR / f"mood_{cache_key}.json"


def _load_from_disk(cache_key: str) -> dict[str, RoomMood] | None:
    path = _disk_path(cache_key)
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text())
        return {loc_id: RoomMood.model_validate(m) for loc_id, m in raw.items()}
    except Exception as exc:
        print(f"[mood_inference] failed to load disk cache: {exc}")
        return None


def _save_to_disk(cache_key: str, moods: dict[str, RoomMood]) -> None:
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        serialized = {loc_id: m.model_dump() for loc_id, m in moods.items()}
        _disk_path(cache_key).write_text(json.dumps(serialized, separators=(",", ":")))
    except Exception as exc:
        print(f"[mood_inference] failed to save disk cache: {exc}")

MOOD_SYSTEM_PROMPT = (
    "You are an atmospheric analyst for a mystery adventure game. "
    "Given a room description, determine the atmospheric mood intensities. "
    "Each mood dimension is a float between 0.0 and 1.0. "
    "Be nuanced: most rooms will have 2-4 active moods at varying intensities. "
    "A value of 0.0 means the mood is absent, 1.0 means it dominates the room."
)


async def infer_room_moods(descriptions: dict[str, str]) -> dict[str, RoomMood]:
    """Infer mood for each location using Pydantic AI with Mistral.

    Args:
        descriptions: mapping of location_id -> room description text.

    Returns:
        mapping of location_id -> RoomMood with AI-determined intensities.
    """
    if not descriptions:
        return {}

    cache_key = _descriptions_cache_key(descriptions)
    if cache_key in _mood_cache:
        print(f"[mood_inference] memory cache hit: {len(_mood_cache[cache_key])} moods")
        return _mood_cache[cache_key]

    disk_cached = _load_from_disk(cache_key)
    if disk_cached is not None:
        _mood_cache[cache_key] = disk_cached
        print(f"[mood_inference] disk cache hit: {len(disk_cached)} moods")
        return disk_cached

    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        print("[mood_inference] MISTRAL_API_KEY not set, returning default moods")
        return {loc_id: RoomMood() for loc_id in descriptions}

    try:
        from pydantic import BaseModel, ConfigDict, Field
        from pydantic_ai import Agent
    except Exception as exc:
        print(f"[mood_inference] pydantic-ai not available: {exc}")
        return {loc_id: RoomMood() for loc_id in descriptions}

    class BatchMoodOutput(BaseModel):
        model_config = ConfigDict(extra="forbid")
        moods: dict[str, RoomMood] = Field(
            description="Map of location_id to its atmospheric mood intensities"
        )

    room_lines = "\n".join(
        f"- {loc_id}: {desc}" for loc_id, desc in descriptions.items()
    )
    prompt = (
        "Analyze the following room descriptions and return mood intensities for each.\n\n"
        f"{room_lines}\n\n"
        "Return a JSON object with a 'moods' key mapping each location_id to its RoomMood. "
        "Mood dimensions: dim, warm, cold, dusty, eerie, damp, opulent, desolate, tense, serene. "
        "Each is a float 0.0 to 1.0."
    )

    model_name = os.getenv("MOOD_MODEL", "mistral:mistral-large-latest")
    agent = Agent(model=model_name, output_type=BatchMoodOutput, system_prompt=MOOD_SYSTEM_PROMPT)

    try:
        print(f"[mood_inference] inferring moods for {len(descriptions)} locations")
        result = await agent.run(prompt)
        output = getattr(result, "output", None) or getattr(result, "data", None)
        if isinstance(output, BatchMoodOutput):
            moods = output.moods
        elif isinstance(output, dict):
            moods = BatchMoodOutput.model_validate(output).moods
        else:
            raise RuntimeError("Unexpected output type from mood agent")

        # Fill in any missing locations with defaults
        for loc_id in descriptions:
            if loc_id not in moods:
                moods[loc_id] = RoomMood()

        _mood_cache[cache_key] = moods
        _save_to_disk(cache_key, moods)
        print(f"[mood_inference] done: {list(moods.keys())}")
        return moods
    except Exception as exc:
        print(f"[mood_inference] inference failed: {exc}, returning defaults")
        return {loc_id: RoomMood() for loc_id in descriptions}
