from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional
import os

class MongoDB:
    client: Optional[AsyncIOMotorClient] = None
    db = None

db = MongoDB()

async def get_database():
    return db.db

async def connect_to_mongo():
    db_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    db_name = os.getenv("MONGODB_DB_NAME", "mistry_db")
    print(f"Connecting to MongoDB at {db_url}")
    db.client = AsyncIOMotorClient(db_url)
    db.db = db.client[db_name]

async def close_mongo_connection():
    if db.client:
        print("Closing MongoDB connection")
        db.client.close()
