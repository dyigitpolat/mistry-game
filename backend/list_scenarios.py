import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def list_all():
    from motor.motor_asyncio import AsyncIOMotorClient
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    cursor = db["scenarios"].find({})
    scenarios = await cursor.to_list(length=100)
    for s in scenarios:
        print(f"ID={s['_id']} | Title={s.get('title')} | Victim={s.get('victim')} | Author={s.get('author')}")

if __name__ == "__main__":
    asyncio.run(list_all())
