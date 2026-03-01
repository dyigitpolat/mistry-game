import asyncio
import os
import re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import sys
from pathlib import Path

# Setup paths for imports
SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR.parent / "agent"))

print("Importing SceneGenerator...")
from mistry_agents.scene_generator import SceneGenerator
print("Importing Scenario...")
from app.models.scenario import Scenario
print("Imports finished.")

load_dotenv(SCRIPT_DIR.parent / ".env")
load_dotenv(SCRIPT_DIR.parent / "procedural_gen" / ".env")

async def generate_missing_images():
    print("Starting missing images sync...")
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    print("Fetching scenarios...")
    scenarios = await db["scenarios"].find({}).to_list(length=100)
    print(f"Found {len(scenarios)} scenarios.")
    
    scenes_dir = SCRIPT_DIR / "data" / "scenes"
    scenes_dir.mkdir(parents=True, exist_ok=True)
    
    generator = SceneGenerator(output_dir=str(scenes_dir))
    
    for s_raw in scenarios:
        sid = str(s_raw["_id"])
        safe_sid = re.sub(r'[^a-z0-9]', '_', sid.lower())
        safe_sid = re.sub(r'_+', '_', safe_sid).strip('_')
        
        # Check Hero
        hero_path = scenes_dir / f"{safe_sid}_hero.png"
        if not hero_path.exists():
            print(f"Generating missing hero for {sid}...")
            title = s_raw.get("title", "Unknown Title")
            desc = s_raw.get("description", "")
            victim = s_raw.get("victim", "Unknown")
            intro = s_raw.get("intro_narrative", "")
            await generator.generate_hero_banner(title, desc, victim, intro, sid)
            
        # Check locations
        locs = s_raw.get("locations", {})
        missing_locations = {}
        for loc_name, loc_data in locs.items():
            loc_no_apos = loc_name.replace("'", "").replace("’", "")
            safe_name = re.sub(r'[^a-z0-9]', '_', loc_no_apos.lower())
            combined = f"{safe_sid}_{safe_name}"
            expected_name = f"{re.sub(r'_+', '_', combined).strip('_')}.png"
            
            if not (scenes_dir / expected_name).exists():
                missing_locations[loc_name] = loc_data
                
        if missing_locations:
            print(f"Generating {len(missing_locations)} missing scenes for {sid}...")
            await generator.generate_all_scenes(missing_locations, sid)
            
    print("✨ Finished generating all missing images.")

if __name__ == "__main__":
    asyncio.run(generate_missing_images())
