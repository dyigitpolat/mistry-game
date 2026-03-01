import asyncio
import os
import json
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def inspect():
    from motor.motor_asyncio import AsyncIOMotorClient
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    doc = await db["scenarios"].find_one({"_id": "scenario"})
    if doc:
        print(json.dumps(doc, indent=2))
    else:
        print("Scenario 'scenario' not found.")

if __name__ == "__main__":
    asyncio.run(inspect())
