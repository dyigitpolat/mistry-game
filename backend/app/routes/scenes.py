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


@router.post("/{scenario_id}/generate")
async def generate_scene(scenario_id: str, location_name: str):
    """Generate a scene image for a specific location."""
    if _scene_gen is None:
        raise HTTPException(
            status_code=503,
            detail="Scene generation unavailable. Set GEMINI_API_KEY and install mistry-agents."
        )

    from app.services.game_engine import GameEngine
    engine = GameEngine()
    scenario = engine.load_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    # Access locations via game_world
    locations = scenario.game_world.locations
    if location_name not in locations:
        raise HTTPException(status_code=404, detail=f"Location '{location_name}' not found.")

    location = locations[location_name]
    # Build visual metadata from new schema format
    visual_metadata = {
        "setting": location.setting,
        "objects": [obj.model_dump() for obj in location.objects],
        "connections": [conn.model_dump() for conn in location.connections],
    }

    path = await _scene_gen.generate_scene_image(
        visual_metadata=visual_metadata,
        location_name=location_name,
        scenario_id=scenario_id,
    )

    if path is None:
        raise HTTPException(status_code=500, detail="Scene generation failed.")

    # Return relative URL for the static mount
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
    engine = GameEngine()
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
    engine = GameEngine()
    scenario = engine.load_scenario(scenario_id)
    if scenario is None:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    # Access locations via game_world
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
