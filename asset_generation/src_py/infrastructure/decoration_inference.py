from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

from src_py.domain.contracts import DecorationItem

_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".artifact_cache" / "inference"
_suggestion_cache: dict[str, dict[str, list[DecorationItem]]] = {}


def _descriptions_cache_key(descriptions: dict[str, str]) -> str:
    raw = json.dumps(sorted(descriptions.items()), separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _disk_path(cache_key: str) -> Path:
    return _CACHE_DIR / f"decor_{cache_key}.json"


def _load_from_disk(cache_key: str) -> dict[str, list[DecorationItem]] | None:
    path = _disk_path(cache_key)
    if not path.exists():
        return None
    try:
        raw = json.loads(path.read_text())
        result: dict[str, list[DecorationItem]] = {}
        for loc_id, items_raw in raw.items():
            result[loc_id] = [DecorationItem.model_validate(it) for it in items_raw]
        return result
    except Exception as exc:
        print(f"[decoration_inference] failed to load disk cache: {exc}")
        return None


def _save_to_disk(cache_key: str, decorations: dict[str, list[DecorationItem]]) -> None:
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        serialized = {
            loc_id: [it.model_dump() for it in items]
            for loc_id, items in decorations.items()
        }
        _disk_path(cache_key).write_text(json.dumps(serialized, separators=(",", ":")))
    except Exception as exc:
        print(f"[decoration_inference] failed to save disk cache: {exc}")

DECOR_SYSTEM_PROMPT = (
    "You are a set designer for a mystery adventure game. "
    "Given a room description, suggest large standalone decorative objects that sit on the "
    "ground and would naturally exist in such a room. These are background props — not "
    "interactive objects. They occupy a 2×2 tile area so they must be BIG items: "
    "furniture, large pots, barrels, crates, statues, large plants, suits of armor, "
    "floor lamps, grandfather clocks, large vases, stacked firewood, etc. "
    "NEVER suggest small items like books, door knobs, spoons, candles, keys, cups, "
    "coins, quills, or anything that would sit on a table or fit in a hand. "
    "Every item must be a freestanding floor object visible from a top-down perspective. "
    "Return concise visual descriptions suitable for pixel-art image generation. "
    "IMPORTANT: descriptions must be family-friendly and contain no violence, gore, drugs, "
    "weapons, or anything that could be flagged by an AI content safety filter. "
    "Keep descriptions purely about the visual appearance of harmless decorative items."
)


async def suggest_decorations(
    descriptions: dict[str, str],
    count_per_room: int = 3,
) -> dict[str, list[DecorationItem]]:
    """Suggest decorative objects per room using Pydantic AI with Mistral.

    Args:
        descriptions: mapping of location_id -> room description.
        count_per_room: number of decorations to suggest per room.

    Returns:
        mapping of location_id -> list of DecorationItem (without placement coords).
    """
    if not descriptions:
        return {}

    cache_key = _descriptions_cache_key(descriptions)
    if cache_key in _suggestion_cache:
        cached = _suggestion_cache[cache_key]
        total = sum(len(v) for v in cached.values())
        print(f"[decoration_inference] memory cache hit: {total} decorations")
        return cached

    disk_cached = _load_from_disk(cache_key)
    if disk_cached is not None:
        _suggestion_cache[cache_key] = disk_cached
        total = sum(len(v) for v in disk_cached.values())
        print(f"[decoration_inference] disk cache hit: {total} decorations")
        return disk_cached

    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        print("[decoration_inference] MISTRAL_API_KEY not set, returning empty")
        return {loc_id: [] for loc_id in descriptions}

    try:
        from pydantic import BaseModel, ConfigDict, Field
        from pydantic_ai import Agent
    except Exception as exc:
        print(f"[decoration_inference] pydantic-ai not available: {exc}")
        return {loc_id: [] for loc_id in descriptions}

    class DecorationSuggestion(BaseModel):
        model_config = ConfigDict(extra="forbid")
        name: str = Field(description="Short name, e.g. 'dusty candelabra'")
        description: str = Field(description="Visual description for pixel-art rendering")

    class RoomDecorations(BaseModel):
        model_config = ConfigDict(extra="forbid")
        items: list[DecorationSuggestion]

    class BatchDecorOutput(BaseModel):
        model_config = ConfigDict(extra="forbid")
        rooms: dict[str, RoomDecorations] = Field(
            description="Map of location_id to its decoration suggestions"
        )

    room_lines = "\n".join(
        f"- {loc_id}: {desc}" for loc_id, desc in descriptions.items()
    )
    prompt = (
        f"For each room below, suggest exactly {count_per_room} LARGE standalone floor objects "
        "that fit the room's atmosphere. These are non-interactive background props that occupy "
        "a 2×2 tile area — think furniture, barrels, large pots, statues, floor lamps, etc. "
        "NEVER suggest small hand-held items.\n\n"
        f"{room_lines}\n\n"
        "For each decoration, provide a short name and a concise visual description "
        "suitable for generating a pixel-art sprite. Keep descriptions under 20 words."
    )

    model_name = os.getenv("MOOD_MODEL", "mistral:mistral-large-latest")
    agent = Agent(model=model_name, output_type=BatchDecorOutput, system_prompt=DECOR_SYSTEM_PROMPT)

    try:
        print(f"[decoration_inference] suggesting decorations for {len(descriptions)} rooms")
        result = await agent.run(prompt)
        output = getattr(result, "output", None) or getattr(result, "data", None)
        if isinstance(output, BatchDecorOutput):
            raw = output.rooms
        elif isinstance(output, dict):
            raw = BatchDecorOutput.model_validate(output).rooms
        else:
            raise RuntimeError("Unexpected output type from decoration agent")

        decorations: dict[str, list[DecorationItem]] = {}
        for loc_id in descriptions:
            room_decors = raw.get(loc_id)
            if not room_decors:
                decorations[loc_id] = []
                continue
            items: list[DecorationItem] = []
            for idx, suggestion in enumerate(room_decors.items[:count_per_room]):
                stable_id = hashlib.sha256(f"{loc_id}:{idx}:{suggestion.name}".encode()).hexdigest()[:8]
                items.append(DecorationItem(
                    id=f"decor_{stable_id}",
                    name=suggestion.name,
                    description=suggestion.description,
                ))
            decorations[loc_id] = items

        _suggestion_cache[cache_key] = decorations
        _save_to_disk(cache_key, decorations)
        print(f"[decoration_inference] done: {sum(len(v) for v in decorations.values())} total decorations")
        return decorations
    except Exception as exc:
        print(f"[decoration_inference] inference failed: {exc}, returning empty")
        return {loc_id: [] for loc_id in descriptions}
