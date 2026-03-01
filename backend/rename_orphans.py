import asyncio
import os
import re
from difflib import get_close_matches
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def rename_orphaned_images():
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    scenarios = await db["scenarios"].find({}, {"_id": 1, "title": 1, "locations": 1}).to_list(length=100)
    scenes_dir = "/Users/aishiknagar/Desktop/mistry-game-main/backend/data/scenes"
    
    expected_files = {} # filename -> (sid, loc_name)
    title_to_sid = {} # sanitized title -> sid
    sid_to_title = {}
    
    for s in scenarios:
        sid = str(s["_id"])
        title = s.get("title", "")
        safe_title = re.sub(r'[^a-z0-9]', '_', title.lower())
        safe_title = re.sub(r'_+', '_', safe_title).strip('_')
        
        title_to_sid[safe_title] = sid
        sid_to_title[sid] = safe_title
        
        safe_sid = re.sub(r'[^a-z0-9]', '_', sid.lower())
        safe_sid = re.sub(r'_+', '_', safe_sid).strip('_')
        
        expected_hero = f"{safe_sid}_hero.png"
        expected_files[expected_hero] = (sid, "HERO")
        
        locs = s.get("locations", {})
        for loc_name in locs.keys():
            loc_no_apos = loc_name.replace("'", "").replace("’", "")
            safe_name = re.sub(r'[^a-z0-9]', '_', loc_no_apos.lower())
            combined = f"{safe_sid}_{safe_name}"
            expected_name = f"{re.sub(r'_+', '_', combined).strip('_')}.png"
            expected_files[expected_name] = (sid, loc_name)
            
    actual_files = set([f for f in os.listdir(scenes_dir) if f.endswith('.png')])
    
    missing_expected = set(expected_files.keys()) - actual_files
    unmapped_actual = list(actual_files - set(expected_files.keys()))
    
    print(f"Orphaned files to match: {len(unmapped_actual)}")
    renamed_count = 0
    
    for orphan in unmapped_actual:
        if orphan == "default_watsons_hearth.png":
            continue
            
        base_name = orphan.replace(".png", "").lower()
        
        # Determine the target scenario title
        target_title = None
        
        # 1. Try stripping 'game_graph_'
        if base_name.startswith("game_graph_"):
            stripped = base_name[11:]
        else:
            stripped = base_name
            
        # 2. Find longest matching safe_title prefix
        best_match_len = 0
        for safe_title in title_to_sid.keys():
            if stripped.startswith(safe_title) and len(safe_title) > best_match_len:
                target_title = safe_title
                best_match_len = len(safe_title)
                
        # If still no match, try fuzzy matching the prefix against title_to_sid keys
        if not target_title and stripped.endswith("_hero"):
            matches = get_close_matches(stripped[:-5], title_to_sid.keys(), n=1, cutoff=0.7)
            if matches:
                 target_title = matches[0]

        if target_title:
            sid = title_to_sid[target_title]
            safe_sid = re.sub(r'[^a-z0-9]', '_', sid.lower())
            safe_sid = re.sub(r'_+', '_', safe_sid).strip('_')
            
            # Determine if it's a hero or a scene
            if base_name.endswith("_hero"):
                expected_filename = f"{safe_sid}_hero.png"
                if expected_filename in missing_expected:
                    os.rename(os.path.join(scenes_dir, orphan), os.path.join(scenes_dir, expected_filename))
                    missing_expected.remove(expected_filename)
                    print(f"Renamed HERO: {orphan} -> {expected_filename}")
                    renamed_count += 1
            else:
                # Scene mapping
                candidates = [f for f in missing_expected if f.startswith(f"{safe_sid}_") and not f.endswith("_hero.png")]
                if candidates:
                    # Score based on filename similarity
                    matches = get_close_matches(stripped, candidates, n=1, cutoff=0.2)
                    if matches:
                        expected_filename = matches[0]
                        os.rename(os.path.join(scenes_dir, orphan), os.path.join(scenes_dir, expected_filename))
                        missing_expected.remove(expected_filename)
                        print(f"Renamed SCENE: {orphan} -> {expected_filename}")
                        renamed_count += 1
                    else:
                         print(f"  Cannot map SCENE '{orphan}' to {len(candidates)} candidates.")
                
    print(f"\nSuccessfully renamed {renamed_count} orphaned files.")

if __name__ == "__main__":
    asyncio.run(rename_orphaned_images())
