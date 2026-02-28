import redis.asyncio as redis
from typing import Optional
import os

class RedisCache:
    client: Optional[redis.Redis] = None

cache = RedisCache()

async def get_redis():
    return cache.client

async def connect_to_redis():
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    print(f"Connecting to Redis at {redis_url}")
    cache.client = redis.from_url(redis_url, encoding="utf-8", decode_responses=True)

async def close_redis_connection():
    if cache.client:
        print("Closing Redis connection")
        await cache.client.close()
