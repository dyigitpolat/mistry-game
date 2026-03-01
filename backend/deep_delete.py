import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def deep_search():
    from motor.motor_asyncio import AsyncIOMotorClient
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    print("--- Searching 'scenarios' collection ---")
    # Search by title, victim, author, or ID
    query = {
        "$or": [
            {"title": {"$regex": "asdasd", "$options": "i"}},
            {"_id": {"$regex": "asdasd", "$options": "i"}},
            {"victim": {"$regex": "Silas Greaves", "$options": "i"}},
            {"author": {"$regex": "AI Weaver", "$options": "i"}}
        ]
    }
    
    cursor = db["scenarios"].find(query)
    scenarios = await cursor.to_list(length=100)
    for s in scenarios:
        print(f"FOUND SCENARIO: ID={s['_id']} | Title={s.get('title')} | Victim={s.get('victim')} | Author={s.get('author')}")
        # Delete if found
        res = await db["scenarios"].delete_one({"_id": s["_id"]})
        print(f"  Deleted: {res.deleted_count}")

    print("\n--- Searching 'game_sessions' collection ---")
    session_cursor = db["game_sessions"].find({"scenario_id": {"$regex": "asdasd", "$options": "i"}})
    sessions = await session_cursor.to_list(length=100)
    for sess in sessions:
        print(f"FOUND SESSION: ID={sess['_id']} | ScenarioID={sess.get('scenario_id')}")
        res = await db["game_sessions"].delete_one({"_id": sess["_id"]})
        print(f"  Deleted: {res.deleted_count}")

if __name__ == "__main__":
    asyncio.run(deep_search())
