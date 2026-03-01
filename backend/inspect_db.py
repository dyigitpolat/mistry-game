import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def list_collections():
    from motor.motor_asyncio import AsyncIOMotorClient
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    cols = await db.list_collection_names()
    print("Collections:", cols)
    
    for col in cols:
        count = await db[col].count_documents({})
        print(f"  {col}: {count} docs")

if __name__ == "__main__":
    asyncio.run(list_collections())
