"""
Scene generation routes — generate and serve scene images.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException

router = APIRouter()

# Check if scene generation is available
_scene_gen = None
try:
    if os.getenv("GEMINI_API_KEY"):
        from mistry_agents import SceneGenerator
        _scene_gen = SceneGenerator()
except ImportError:
    pass


def _resolve_location_name(engine, scenario_id: str, location_name: str, locations: dict):
    """Resolve a possibly display-name-mapped location to the original key."""
    if location_name in locations:
        return location_name
    # Reverse lookup: display_name -> original_name
    display_names = engine._display_names.get(scenario_id, {})
    reverse = {v: k for k, v in display_names.items()}
    original = reverse.get(location_name)
    if original and original in locations:
        return original
    # Fallback: case-insensitive partial match on location.name field
    lower = location_name.lower().strip()
    for loc_id, loc in locations.items():
        if (loc.name or loc_id).lower().strip() == lower:
            return loc_id
    return None


@router.post("/{scenario_id}/generate")
async def generate_scene(scenario_id: str, location_name: str):
    """Generate a scene image for a specific location."""
    if _scene_gen is None:
        raise HTTPException(
            status_code=503,
            detail="Scene generation unavailable. Set GEMINI_API_KEY and install mistry-agents."
        )

    from app.services.game_engine import GameEngine
    engine = GameEngine._shared_instance or GameEngine()
    scenario = engine.load_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    locations = scenario.game_world.locations
    resolved = _resolve_location_name(engine, scenario_id, location_name, locations)
    if resolved is None:
        raise HTTPException(status_code=404, detail=f"Location '{location_name}' not found.")

    location = locations[resolved]
    # Build visual metadata from new schema format
    visual_metadata = {
        "setting": location.setting,
        "objects": [obj.model_dump() for obj in location.objects],
        "connections": [conn.model_dump() for conn in location.connections],
    }

    path = await _scene_gen.generate_scene_image(
        visual_metadata=visual_metadata,
        location_name=resolved,
        scenario_id=scenario_id,
    )

    if path is None:
        raise HTTPException(status_code=500, detail="Scene generation failed.")

    filename = Path(path).name
    return {"image_url": f"/scenes/{filename}", "location": location_name}


@router.post("/{scenario_id}/generate-hero")
async def generate_hero(scenario_id: str):
    """Generate a hero banner image for a specific scenario."""
    if _scene_gen is None:
        raise HTTPException(
            status_code=503,
            detail="Scene generation unavailable. Set GEMINI_API_KEY and install mistry-agents."
        )

    from app.services.game_engine import GameEngine
    engine = GameEngine._shared_instance or GameEngine()
    scenario = engine.load_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    path = await _scene_gen.generate_hero_banner(
        title=scenario.title,
        description=scenario.description,
        victim=scenario.victim,
        narrative=scenario.narrative,
        scenario_id=scenario_id,
    )

    if path is None:
        raise HTTPException(status_code=500, detail="Hero Banner generation failed.")

    # Return relative URL for the static mount
    filename = Path(path).name
    return {"image_url": f"/scenes/{filename}", "scenario": scenario_id}


@router.post("/{scenario_id}/generate-all")
async def generate_all_scenes(scenario_id: str):
    """Generate scene images for all locations in a scenario."""
    if _scene_gen is None:
        raise HTTPException(
            status_code=503,
            detail="Scene generation unavailable."
        )

    from app.services.game_engine import GameEngine
    engine = GameEngine._shared_instance or GameEngine()
    scenario = engine.load_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    locations_dict = {}
    for name, loc in scenario.game_world.locations.items():
        locations_dict[name] = {
            "visual_metadata": {
                "setting": loc.setting,
                "objects": [obj.model_dump() for obj in loc.objects],
                "connections": [conn.model_dump() for conn in loc.connections],
            }
        }

    results = await _scene_gen.generate_all_scenes(
        locations=locations_dict,
        scenario_id=scenario_id,
    )

    scene_urls = {}
    for loc_name, path in results.items():
        if path:
            filename = Path(path).name
            scene_urls[loc_name] = f"/scenes/{filename}"
        else:
            scene_urls[loc_name] = None

    return {"scenes": scene_urls}
