import json
import os
from pathlib import Path

def migrate_scenario(data):
    # 1. Handle locations (legacy game_world or partially migrated)
    if "game_world" in data:
        legacy_locations = data["game_world"].get("locations", {})
        if "locations" not in data:
            data["locations"] = {}
        
        for loc_id, loc_data in legacy_locations.items():
            if loc_id not in data["locations"]:
                # Initial migration from game_world
                setting = loc_data.get("setting", "")
                legacy_connections = loc_data.get("connections", [])
                new_connections = []
                for conn in legacy_connections:
                    st = conn.get("state", "open")
                    if st == "unlocked": st = "open"
                    if st not in ["open", "closed", "locked", "locked from inside"]:
                        st = "open"
                        
                    new_connections.append({
                        "target_location": conn.get("location_id", ""),
                        "mechanism": "door",
                        "state": st
                    })
                
                visual_metadata = {
                    "setting": setting,
                    "connections": new_connections,
                    "surfaces_and_containers": []
                }
                
                legacy_objects = loc_data.get("objects", [])
                items = []
                for obj in legacy_objects:
                    if obj.get("category") == "item":
                        items.append(obj.get("name", obj.get("id")))
                
                data["locations"][loc_id] = {
                    "description": loc_data.get("description", ""),
                    "items": items,
                    "clues": loc_data.get("clues", []),
                    "base_ascii": "",
                    "visual_metadata": visual_metadata
                }
    
    # 2. Fix existing locations (idempotent fix for enum values)
    if "locations" in data:
        for loc_id, loc_data in data["locations"].items():
            if "visual_metadata" in loc_data:
                vm = loc_data["visual_metadata"]
                if "connections" in vm:
                    for conn in vm["connections"]:
                        if conn.get("state") == "unlocked":
                            conn["state"] = "open"
                        if conn.get("state") not in ["open", "closed", "locked", "locked from inside"]:
                            conn["state"] = "open"

    # 3. Fix characters
    if "characters" in data:
        to_delete = []
        for char_id, char_data in data["characters"].items():
            # Check if it's a real character or a misplaced conditional
            if "type" not in char_data and "role" not in char_data:
                to_delete.append(char_id)
                continue

            if "phase_locations" in char_data:
                pl = char_data["phase_locations"]
                new_pl = {}
                for k, v in pl.items():
                    try:
                        new_pl[int(k)] = v
                    except ValueError:
                        pass
                char_data["phase_locations"] = new_pl
            
            if "type" in char_data:
                char_data["type"] = char_data["type"].lower()
                if char_data["type"] not in ["suspect", "assistant"]:
                    char_data["type"] = "suspect"
            
            if "suspicion_meter" not in char_data: char_data["suspicion_meter"] = 0
            if "flight_risk" not in char_data: char_data["flight_risk"] = 0
            if "conditional_behaviors" not in char_data: char_data["conditional_behaviors"] = []
        
        for char_id in to_delete:
            del data["characters"][char_id]

    # 4. Global defaults
    if "author" not in data or not data["author"]: data["author"] = "AI Weaver"
    if "difficulty" not in data: data["difficulty"] = "medium"
    if "visibility" not in data: data["visibility"] = "public"
    if "win_conditions" in data:
        wc = data["win_conditions"]
        if "required_suspect" not in wc: wc["required_suspect"] = []
    
    if "phases" in data:
        for phase in data["phases"]:
            if "id" not in phase: phase["id"] = 0
            if "name" not in phase: phase["name"] = "Phase"
            if "objective" not in phase: phase["objective"] = "Complete investigation."
            if "unlocked_locations" not in phase: phase["unlocked_locations"] = []
            if "unlocked_characters" not in phase: phase["unlocked_characters"] = []

    return data

def main():
    new_data_path = Path("/Users/aishiknagar/Desktop/mistry-game-main/backend/data/new_data")
    files = list(new_data_path.glob("*.json"))
    for f in files:
        try:
            with open(f, "r") as file: data = json.load(file)
            migrated = migrate_scenario(data)
            with open(f, "w") as file: json.dump(migrated, file, indent=2, ensure_ascii=False)
        except Exception as e: print(f"Failed to migrate {f.name}: {e}")

if __name__ == "__main__":
    main()
