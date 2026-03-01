import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def final_cleanup():
    uri = os.getenv("MONGODB_URI")
    client = AsyncIOMotorClient(uri)
    db = client["mistry"]
    
    # 1. Delete the schema file entry
    await db["scenarios"].delete_one({"_id": "training_data_incremental_55"})
    
    # 2. Delete any scenario with title "Scenario" or victim "None"
    await db["scenarios"].delete_many({"title": "Scenario"})
    
    # 3. Double check asdasd
    await db["scenarios"].delete_many({"title": {"$regex": "asdasd", "$options": "i"}})
    
    print("DB Cleanup complete.")

if __name__ == "__main__":
    asyncio.run(final_cleanup())
