import asyncio
import os
import re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def delete_orphans():
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    scenarios = await db["scenarios"].find({}, {"_id": 1, "locations": 1}).to_list(length=100)
    scenes_dir = "/Users/aishiknagar/Desktop/mistry-game-main/backend/data/scenes"
    
    expected_files = set()
    
    for s in scenarios:
        sid = str(s["_id"])
        safe_sid = re.sub(r'[^a-z0-9]', '_', sid.lower())
        safe_sid = re.sub(r'_+', '_', safe_sid).strip('_')
        
        expected_files.add(f"{safe_sid}_hero.png")
        
        locs = s.get("locations", {})
        for loc_name in locs.keys():
            loc_no_apos = loc_name.replace("'", "").replace("’", "")
            safe_name = re.sub(r'[^a-z0-9]', '_', loc_no_apos.lower())
            combined = f"{safe_sid}_{safe_name}"
            expected_name = f"{re.sub(r'_+', '_', combined).strip('_')}.png"
            expected_files.add(expected_name)
            
    actual_files = set([f for f in os.listdir(scenes_dir) if f.endswith('.png')])
    
    unmapped_actual = list(actual_files - expected_files)
    
    deleted = 0
    for orphan in unmapped_actual:
        if orphan == "default_watsons_hearth.png":
            continue
            
        file_path = os.path.join(scenes_dir, orphan)
        print(f"Deleting true orphan: {orphan}")
        os.remove(file_path)
        deleted += 1
        
    print(f"Cleanup complete. Deleted {deleted} orphaned files.")

if __name__ == "__main__":
    asyncio.run(delete_orphans())
