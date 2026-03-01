import sys
import os
import asyncio
from mistry_agents.scene_generator import SceneGenerator
from app.services.game_engine import GameEngine

async def main():
    engine = GameEngine()
    scenario = engine.load_scenario("the_crooked_man")
    # Access location via game_world.locations
    loc = scenario.game_world.locations["Watson's Hearth"]

    # Build visual_metadata from new schema format
    visual_metadata = {
        "setting": loc.setting,
        "objects": [obj.model_dump() for obj in loc.objects],
        "connections": [conn.model_dump() for conn in loc.connections],
    }

    gen = SceneGenerator()
    path = await gen.generate_scene_image(visual_metadata, "Watson's Hearth")
    print(f"Result: {path}")

if __name__ == "__main__":
    asyncio.run(main())
