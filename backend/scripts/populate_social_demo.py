import asyncio
import random
import uuid
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
from app.services.game_engine import GameEngine

# Configuration
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "mistry_db")

SCENARIOS = [
    "the_crooked_man",
    "another_phd_bites_the_dust",
    "game_graph_Find_the_Woman",
    "game_graph_The_Hunter's_Lodge_Case",
    "game_graph_The_Red-Headed_League",
    "game_graph_The_Sturgis_Wager:_A_Detective_Story",
    "game_graph_Whose_Body?_A_Lord_Peter_Wimsey_Novel"
]

DUMMY_USERS = [
    {"_id": "dummy_1", "name": "Sherlock Holmes", "email": "sherlock@221b.com", "image": "https://images.unsplash.com/photo-1580128660010-fd027e1e587a?q=80&w=2070&auto=format&fit=crop"},
    {"_id": "dummy_2", "name": "Hercule Poirot", "email": "poirot@belgium.com", "image": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1974&auto=format&fit=crop"},
    {"_id": "dummy_3", "name": "Jane Marple", "email": "marple@stmarymead.com", "image": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1976&auto=format&fit=crop"},
    {"_id": "dummy_4", "name": "Benoit Blanc", "email": "blanc@knivesout.com", "image": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1974&auto=format&fit=crop"},
    {"_id": "dummy_5", "name": "Nancy Drew", "email": "nancy@riverheights.com", "image": "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=2070&auto=format&fit=crop"},
    {"_id": "dummy_6", "name": "Dick Tracy", "email": "tracy@citypd.com", "image": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=2070&auto=format&fit=crop"},
    {"_id": "dummy_7", "name": "Veronica Mars", "email": "veronica@neptune.com", "image": "https://images.unsplash.com/photo-1554151228-14d9def656e4?q=80&w=1972&auto=format&fit=crop"},
    {"_id": "dummy_8", "name": "Columbo", "email": "columbo@lapd.com", "image": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=1974&auto=format&fit=crop"},
    {"_id": "dummy_9", "name": "Cormoran Strike", "email": "strike@london.com", "image": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=1974&auto=format&fit=crop"},
    {"_id": "dummy_10", "name": "Lisbeth Salander", "email": "lisbeth@hacking.se", "image": "https://images.unsplash.com/photo-1548142813-c348350df52b?q=80&w=1978&auto=format&fit=crop"}
]

async def populate():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    print(f"--- Populating {DB_NAME} ---")

    # 0. Sync Scenarios from GameEngine
    engine = GameEngine()
    scenario_docs = []
    for sid, scenario in engine.scenarios.items():
        doc = json.loads(scenario.model_dump_json())
        doc["id"] = sid # Ensure it has the ID expected by stats.py
        scenario_docs.append(doc)
    
    if scenario_docs:
        await db["scenarios"].delete_many({})
        await db["scenarios"].insert_many(scenario_docs)
        print(f"Synced {len(scenario_docs)} scenarios from GameEngine.")

    # 1. Clear existing dummy data if necessary (to avoid duplicates if re-run)
    dummy_ids = [u["_id"] for u in DUMMY_USERS]
    await db["users"].delete_many({"_id": {"$in": dummy_ids}})
    await db["game_sessions"].delete_many({"user_id": {"$in": dummy_ids}})
    await db["friendships"].delete_many({"$or": [{"user_id": {"$in": dummy_ids}}, {"friend_id": {"$in": dummy_ids}}]})

    # 2. Insert Users
    await db["users"].insert_many(DUMMY_USERS)
    print(f"Inserted {len(DUMMY_USERS)} dummy users.")

    # 3. Create Game Sessions (Solved and In-Progress)
    available_scenario_ids = list(engine.scenarios.keys())
    sessions = []
    for user in DUMMY_USERS:
        # Each user has solved between 3 and 7 cases
        num_solved = min(len(available_scenario_ids), random.randint(3, 7))
        solved_scenarios = random.sample(available_scenario_ids, num_solved)
        
        for sid in solved_scenarios:
            elapsed = random.uniform(15, 120)  # 15 to 120 minutes
            updated_at = datetime.utcnow() - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
            
            sessions.append({
                "_id": str(uuid.uuid4()),
                "user_id": user["_id"],
                "scenario_id": sid,
                "player_state": {
                    "current_location": "hallway",
                    "inventory": ["magnifying_glass"],
                    "clues": ["clue_1", "clue_2"],
                    "elapsed_minutes": elapsed,
                    "current_phase": 4 # Assuming 4 is late game
                },
                "character_states": {},
                "is_complete": True,
                "outcome": "solved",
                "created_at": updated_at - timedelta(hours=2),
                "updated_at": updated_at
            })
            
        # Maybe 1 in-progress case
        if random.random() > 0.5:
            remaining_ids = [s for s in available_scenario_ids if s not in solved_scenarios]
            if remaining_ids:
                sid = random.choice(remaining_ids)
                sessions.append({
                    "_id": str(uuid.uuid4()),
                    "user_id": user["_id"],
                    "scenario_id": sid,
                    "player_state": {
                        "current_location": "entry",
                        "inventory": [],
                        "clues": ["initial_fact"],
                        "elapsed_minutes": random.uniform(5, 20),
                        "current_phase": 1
                    },
                    "character_states": {},
                    "is_complete": False,
                    "outcome": None,
                    "created_at": datetime.utcnow() - timedelta(minutes=random.randint(10, 60)),
                    "updated_at": datetime.utcnow()
                })

    if sessions:
        await db["game_sessions"].insert_many(sessions)
        print(f"Inserted {len(sessions)} game sessions.")

    # 4. Create Friendships (Mutual)
    friendships = []
    for i, user in enumerate(DUMMY_USERS):
        # Connect to 3 next users in the list to create a chain/web
        for offset in [1, 2, 3]:
            friend_idx = (i + offset) % len(DUMMY_USERS)
            friend = DUMMY_USERS[friend_idx]
            
            # Mutual friendship
            fid = f"friend_{user['_id']}_{friend['_id']}"
            friendships.append({
                "_id": fid,
                "user_id": user["_id"],
                "friend_id": friend["_id"],
                "status": "accepted",
                "created_at": datetime.utcnow() - timedelta(days=40)
            })
            
            fid_reverse = f"friend_{friend['_id']}_{user['_id']}"
            friendships.append({
                "_id": fid_reverse,
                "user_id": friend["_id"],
                "friend_id": user["_id"],
                "status": "accepted",
                "created_at": datetime.utcnow() - timedelta(days=40)
            })

    if friendships:
        await db["friendships"].insert_many(friendships)
        print(f"Inserted {len(friendships)} friendship records.")

    # 5. Connect Friendships to the "Primary" User if we can find one
    # Let's try to find a real user in the DB (non-dummy)
    real_user = await db["users"].find_one({"_id": {"$nin": dummy_ids}})
    if real_user:
        print(f"Found real user: {real_user['name']} ({real_user['_id']}). Connecting to dummy friends...")
        user_id = real_user["_id"]
        extra_friendships = []
        # Connect to first 5 dummy users
        for i in range(5):
            friend = DUMMY_USERS[i]
            extra_friendships.append({
                "_id": f"friend_{user_id}_{friend['_id']}",
                "user_id": user_id,
                "friend_id": friend["_id"],
                "status": "accepted",
                "created_at": datetime.utcnow()
            })
            extra_friendships.append({
                "_id": f"friend_{friend['_id']}_{user_id}",
                "user_id": friend["_id"],
                "friend_id": user_id,
                "status": "accepted",
                "created_at": datetime.utcnow()
            })
        await db["friendships"].insert_many(extra_friendships)
        print(f"Connected {real_user['name']} to {len(extra_friendships)//2} friends.")
    else:
        print("No real user found in database. Skipping mutual friends for current user.")

    print("--- Done ---")
    client.close()

if __name__ == "__main__":
    asyncio.run(populate())
