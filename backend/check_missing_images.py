import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def check_missing_images():
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    scenarios = await db["scenarios"].find({}, {"_id": 1, "title": 1, "locations": 1}).to_list(length=100)
    scenes_dir = "/Users/aishiknagar/Desktop/mistry-game-main/backend/data/scenes"
    
    missing_heroes = []
    missing_scenes = {}
    
    for s in scenarios:
        sid = str(s["_id"])
        # Basic sanitization used for hero images
        import re
        safe_sid = re.sub(r'[^a-z0-9]', '_', sid.lower())
        safe_sid = re.sub(r'_+', '_', safe_sid).strip('_')
        
        hero_path = os.path.join(scenes_dir, f"{safe_sid}_hero.png")
        if not os.path.exists(hero_path):
            missing_heroes.append(sid)
            
        # Check locations
        locs = s.get("locations", {})
        missing_locs = []
        for loc_name in locs.keys():
            loc_no_apos = loc_name.replace("'", "").replace("’", "")
            safe_name = re.sub(r'[^a-z0-9]', '_', loc_no_apos.lower())
            combined = f"{safe_sid}_{safe_name}"
            expected_name = f"{re.sub(r'_+', '_', combined).strip('_')}.png"
            
            p = os.path.join(scenes_dir, expected_name)
            if not os.path.exists(p):
                missing_locs.append(loc_name)
                
        if missing_locs:
            missing_scenes[sid] = missing_locs
            
    print(f"Scenarios missing hero images: {len(missing_heroes)}")
    for mh in missing_heroes:
        print(f" - {mh}")
        
    print(f"Scenarios missing scene images: {len(missing_scenes)}")
    for sid, locs in missing_scenes.items():
        print(f" - {sid}: missing {len(locs)} scenes ({', '.join(locs[:3])}...)")

if __name__ == "__main__":
    asyncio.run(check_missing_images())
