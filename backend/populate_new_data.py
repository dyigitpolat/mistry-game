
import asyncio
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict

# Add current dir to sys.path
SCRIPT_DIR = Path(__file__).parent.resolve()
sys.path.insert(0, str(SCRIPT_DIR))
sys.path.insert(0, str(SCRIPT_DIR.parent / "agent"))

from app.db.mongodb import get_database
from app.models.scenario import Scenario, Location, VisualMetadata, Connection, SurfaceOrContainer, SceneObject
from mistry_agents.scene_generator import SceneGenerator
from dotenv import load_dotenv

load_dotenv(SCRIPT_DIR.parent / ".env")
load_dotenv(SCRIPT_DIR.parent / "procedural_gen" / ".env")

def sanitize_id(title: str) -> str:
    slug = title.lower().strip()
    slug = slug.replace("'", "").replace('"', "")
    slug = "_".join(slug.split())
    slug = "".join(c for c in slug if c.isalnum() or c == "_")
    return slug

def transform_scenario(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Transform the incremental training data format to the Scenario model format."""
    
    # 1. Transform Locations
    raw_locations = raw.get("game_world", {}).get("locations", {})
    transformed_locations = {}
    
    for loc_key, loc_val in raw_locations.items():
        # Convert ascii_map list to string
        base_ascii = "\n".join(loc_val.get("ascii_map", []))
        
        # Build VisualMetadata
        connections = []
        for conn in loc_val.get("connections", []):
            connections.append({
                "target_location": conn.get("location_id"),
                "mechanism": "door", # Default since not in raw
                "state": "open" if conn.get("state") == "unlocked" else "locked"
            })
            
        surfaces = []
        for obj in loc_val.get("objects", []):
            if obj.get("category") in ["surface", "container"]:
                surfaces.append({
                    "id": obj.get("id"),
                    "type": obj.get("category"),
                    "spatial_relationship": "in the room", # Default
                    "objects": [
                        {"item_id": inner.get("id"), "visibility": "visible"} 
                        for inner in obj.get("contains", [])
                    ]
                })
        
        # Get items and clues
        items = [obj.get("id") for obj in loc_val.get("objects", []) if obj.get("category") == "item"]
        clues = loc_val.get("clues", [])

        transformed_locations[loc_key] = {
            "description": loc_val.get("description", ""),
            "items": items,
            "clues": clues,
            "base_ascii": base_ascii,
            "visual_metadata": {
                "setting": loc_val.get("setting", ""),
                "connections": connections,
                "surfaces_and_containers": surfaces
            }
        }

    # 2. Transform Characters
    raw_characters = raw.get("characters", {})
    if not raw_characters:
        raw_characters = {}
        
    transformed_characters = {}
    for char_id, char_val in raw_characters.items():
        # Ensure phase_locations keys are ints
        phase_locs = {int(k): v for k, v in char_val.get("phase_locations", {}).items()}
        
        c_type = char_val.get("type", "suspect").lower()
        if c_type not in ["suspect", "assistant"]:
            c_type = "suspect" # Fallback for 'victim' or other types
            
        transformed_characters[char_id] = {
            "type": c_type,
            "role": char_val.get("role", "Mysterious Figure"),
            "location": char_val.get("location", next(iter(transformed_locations.keys())) if transformed_locations else ""),
            "phase_locations": phase_locs,
            "persona": char_val.get("persona", "A quiet individual."),
            "knowledge_about_others": char_val.get("knowledge_about_others", {}),
            "secret": char_val.get("secret", ""),
            "abilities": char_val.get("abilities", ""),
            "conditional_behaviors": char_val.get("conditional_behaviors", []),
            "suspicion_meter": char_val.get("suspicion_meter", 0),
            "flight_risk": char_val.get("flight_risk", 0)
        }

    # 3. Final Scenario Object
    phases = raw.get("phases") or []
    # Fix missing unlocked_characters in phases
    for p in phases:
        if "unlocked_characters" not in p:
            p["unlocked_characters"] = []
        if "unlocked_locations" not in p:
            p["unlocked_locations"] = []

    win_conditions = raw.get("win_conditions") or {
        "required_evidence": [],
        "required_suspect": [],
        "required_motive": []
    }

    return {
        "title": raw.get("title", "Untitled Case"),
        "author": "AI Weaver",
        "description": raw.get("description", ""),
        "victim": raw.get("victim", "Unknown"),
        "intro_narrative": raw.get("intro_narrative", ""),
        "time_limit_minutes": raw.get("time_limit_minutes", 180),
        "start_time": raw.get("start_time", "1900-01-01T12:00:00"),
        "win_conditions": win_conditions,
        "phases": phases,
        "locations": transformed_locations,
        "characters": transformed_characters,
        "difficulty": "medium",
        "visibility": "public"
    }

async def process_all():
    # Explicitly load mongo URL
    mongo_url = os.getenv("MONGODB_URI")
    if not mongo_url:
        print("❌ MONGODB_URI not found in environment")
        return
        
    db_name = os.getenv("MONGODB_DB_NAME", "mistry")
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(mongo_url)
    db = client.get_default_database()
    
    try:
        await db.command("ping")
        print(f"✅ Connected to MongoDB at {mongo_url}")
    except Exception as e:
        print(f"❌ Could not connect to database: {e}")
        return

    data_dir = SCRIPT_DIR / "data" / "new_data"
    generator = SceneGenerator()
    
    files = sorted(list(data_dir.glob("*.json")))
    print(f"📂 Found {len(files)} files to process.")

    for i, file_path in enumerate(files):
        print(f"\n[{i+1}/{len(files)}] Processing {file_path.name}...")
        try:
            with open(file_path, "r") as f:
                raw_data = json.load(f)
            
            # Transform and Validate
            scenario_dict = transform_scenario(raw_data)
            scenario = Scenario.model_validate(scenario_dict)
            
            # DB ID
            scenario_id = sanitize_id(scenario.title)
            scenario_data = json.loads(scenario.model_dump_json())
            scenario_data["_id"] = scenario_id
            
            # Upsert
            await db["scenarios"].replace_one({"_id": scenario_id}, scenario_data, upsert=True)
            print(f"  ✅ Saved to DB: {scenario_id}")

            # Generate Hero Banner
            await generator.generate_hero_banner(
                scenario.title, 
                scenario.description, 
                scenario.victim, 
                scenario.intro_narrative, 
                scenario_id
            )
            
            # Generate Scenes
            print(f"  🖼️ Generating scene images for {len(scenario.locations)} locations...")
            await generator.generate_all_scenes(scenario.model_dump()["locations"], scenario_id)
            
        except Exception as e:
            print(f"  ❌ Failed to process {file_path.name}: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(process_all())
