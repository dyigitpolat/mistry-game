import asyncio
import os
import re
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def debug_crooked():
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    s = await db["scenarios"].find_one({"_id": "the_crooked_man"})
    if not s:
        print("the_crooked_man not found in DB!")
        
        # maybe another ID?
        curs = db["scenarios"].find({"title": {"$regex": "Crooked", "$options": "i"}})
        async for c in curs:
            print(f"Found: _id={c['_id']}, title='{c.get('title')}'")
        return
        
    print(f"Found _id={s['_id']}, title='{s.get('title')}'")
    
if __name__ == "__main__":
    asyncio.run(debug_crooked())
