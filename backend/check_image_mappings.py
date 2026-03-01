import json
import os
from pathlib import Path

def sanitize_id(title):
    return title.lower().replace(' ', '_').replace('?', '').replace('!', '').replace(':', '').replace('-', '_').replace('__', '_').strip('_')

def check_mappings():
    data_dir = Path("/Users/aishiknagar/Desktop/mistry-game-main/backend/data/new_data")
    scenes_dir = Path("/Users/aishiknagar/Desktop/mistry-game-main/backend/data/scenes")
    
    scenarios = data_dir.glob("*.json")
    results = []
    
    for s_path in scenarios:
        with open(s_path, "r") as f:
            try:
                data = json.load(f)
                title = data.get("title", "")
                sid = sanitize_id(title)
                hero_name = f"{sid}_hero.png"
                exists = (scenes_dir / hero_name).exists()
                results.append({
                    "file": s_path.name,
                    "title": title,
                    "sanitized": sid,
                    "hero_exists": exists
                })
            except:
                pass
                
    for res in sorted(results, key=lambda x: x["hero_exists"], reverse=True):
        status = "✅" if res["hero_exists"] else "❌"
        print(f"{status} {res['file']} -> {res['title']} ({res['hero_exists']})")

if __name__ == "__main__":
    check_mappings()
