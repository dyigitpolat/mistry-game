import asyncio
import os
import json
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def restore_scenarios():
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    new_data_path = Path("/Users/aishiknagar/Desktop/mistry-game-main/backend/data/new_data")
    json_files = list(new_data_path.glob("*.json"))
    
    print(f"Found {len(json_files)} files to restore.")
    restored = 0
    for f in json_files:
        with open(f, "r") as file:
            data = json.load(file)
            # Ensure _id is handled correctly
            if "id" in data and "_id" not in data:
                data["_id"] = data["id"]
            
            # Use upsert to avoid duplicates
            id_val = f.stem # fallback to filename if ID not in JSON
            if "_id" in data:
                id_val = data["_id"]
            elif "id" in data:
                id_val = data["id"]
                data["_id"] = id_val
            
            # Check if this is the "asdasd" case before restoring!
            if str(data.get("title", "")).lower() == "asdasd" or "asdasd" in str(id_val).lower():
                print(f"SKIPPING 'asdasd' case found in file: {f}")
                continue
                
            res = await db["scenarios"].update_one(
                {"_id": id_val},
                {"$set": data},
                upsert=True
            )
            restored += 1
            
    print(f"Restored {restored} scenarios.")

if __name__ == "__main__":
    asyncio.run(restore_scenarios())
