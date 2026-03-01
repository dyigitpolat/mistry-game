import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def cleanup_sessions():
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    # Delete sessions where scenario_id contains asdasd or title is asdasd
    res = await db["game_sessions"].delete_many({
        "$or": [
            {"scenario_id": {"$regex": "asdasd", "$options": "i"}},
            {"scenario_id": "asdasd"}
        ]
    })
    print(f"Deleted {res.deleted_count} stale game sessions.")

if __name__ == "__main__":
    asyncio.run(cleanup_sessions())
