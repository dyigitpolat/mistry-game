import sys
import os
import asyncio
from mistry_agents.scene_generator import SceneGenerator
from app.services.game_engine import GameEngine

async def main():
    engine = GameEngine()
    scenario = engine.load_scenario("the_crooked_man")
    loc = scenario.locations["Watson's Hearth"]
    
    gen = SceneGenerator()
    path = await gen.generate_scene_image(loc.visual_metadata.model_dump(), "Watson's Hearth")
    print(f"Result: {path}")

if __name__ == "__main__":
    asyncio.run(main())
