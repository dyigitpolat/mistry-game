import asyncio
import os
import re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def check_mappings():
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    scenarios = await db["scenarios"].find({}, {"_id": 1, "title": 1, "locations": 1}).to_list(length=100)
    scenes_dir = "/Users/aishiknagar/Desktop/mistry-game-main/backend/data/scenes"
    
    expected_files = set()
    location_map = {} # mapped from expected_file -> (sid, loc_name)
    
    for s in scenarios:
        sid = str(s["_id"])
        safe_sid = re.sub(r'[^a-z0-9]', '_', sid.lower())
        safe_sid = re.sub(r'_+', '_', safe_sid).strip('_')
        
        expected_hero = f"{safe_sid}_hero.png"
        expected_files.add(expected_hero)
        location_map[expected_hero] = (sid, "HERO")
        
        locs = s.get("locations", {})
        for loc_name in locs.keys():
            loc_no_apos = loc_name.replace("'", "").replace("’", "")
            safe_name = re.sub(r'[^a-z0-9]', '_', loc_no_apos.lower())
            combined = f"{safe_sid}_{safe_name}"
            expected_name = f"{re.sub(r'_+', '_', combined).strip('_')}.png"
            
            expected_files.add(expected_name)
            location_map[expected_name] = (sid, loc_name)
            
    actual_files = set([f for f in os.listdir(scenes_dir) if f.endswith('.png')])
    
    missing_expected = expected_files - actual_files
    unmapped_actual = actual_files - expected_files
    
    print(f"Total expected files from DB: {len(expected_files)}")
    print(f"Total actual files in disk: {len(actual_files)}")
    print(f"Files missing from disk: {len(missing_expected)}")
    print(f"Files on disk with NO DB matchup (Unmapped/Orphans): {len(unmapped_actual)}\n")
    
    if unmapped_actual:
        print("--- Unmapped (Orphan) Files ---")
        for f in sorted(list(unmapped_actual)):
            print(f)
            
    if missing_expected:
        print("\n--- Missing Expected Files ---")
        for f in sorted(list(missing_expected))[:20]:
            print(f"Missing: {f} (for {location_map[f]})")
        if len(missing_expected) > 20:
            print(f"... and {len(missing_expected) - 20} more.")

if __name__ == "__main__":
    asyncio.run(check_mappings())
