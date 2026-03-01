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
    db_url = os.getenv("MONGODB_URI", "mongodb://localhost:27017/mistry")
    print(f"Connecting to MongoDB at {db_url}")
    db.client = AsyncIOMotorClient(db_url)
    # Motor/PyMongo will use the DB name from the URI if get_default_database() is used
    db.db = db.client.get_default_database() if "/localhost" not in db_url or "/" in db_url.split("://")[1] else db.client["mistry_db"]
    
    # Simpler fallback:
    if not db.db.name or db.db.name == "admin":
        db_name = os.getenv("MONGODB_DB_NAME", "mistry")
        db.db = db.client[db_name]

async def close_mongo_connection():
    if db.client:
        print("Closing MongoDB connection")
        db.client.close()
