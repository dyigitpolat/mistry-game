from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from datetime import datetime
import uuid

from app.core.auth import get_current_user_optional, get_current_user
from app.db.mongodb import get_database
from app.models.db_models import DBInteraction

router = APIRouter()

class GlobalLeaderboardEntry(BaseModel):
    user_id: str
    user_name: str
    user_image: Optional[str] = None
    cases_solved: int
    total_time_mins: float
    elo: int
    rank_title: str

class LeaderboardEntry(BaseModel):
    user_name: str
    user_image: Optional[str] = None
    elapsed_minutes: float
    solved_at: datetime

class Comment(BaseModel):
    id: str
    user_name: str
    user_image: Optional[str] = None
    content: str
    created_at: datetime

class ScenarioStats(BaseModel):
    total_plays: int
    clear_rate: float
    total_likes: int
    user_has_liked: bool

@router.get("/{scenario_id}", response_model=ScenarioStats)
async def get_scenario_stats(scenario_id: str, user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)):
    """Aggregate total plays, clear rate, and likes for a scenario."""
    db = await get_database()
    if db is None:
        return ScenarioStats(total_plays=0, clear_rate=0.0, total_likes=0, user_has_liked=False)

    # 1. Total Plays & Clears
    session_cursor = db["game_sessions"].find({"scenario_id": scenario_id})
    sessions = await session_cursor.to_list(length=None)
    
    total_plays = len(sessions)
    clears = sum(1 for s in sessions if s.get("is_complete") and s.get("outcome") == "solved")
    clear_rate = round((clears / total_plays) * 100) if total_plays > 0 else 0.0

    # 2. Total Likes
    total_likes = await db["interactions"].count_documents({"scenario_id": scenario_id, "type": "like"})

    # 3. User Has Liked?
    user_has_liked = False
    if user:
        user_like = await db["interactions"].find_one({
            "scenario_id": scenario_id,
            "type": "like",
            "user_id": user["id"]
        })
        user_has_liked = user_like is not None

    return ScenarioStats(
        total_plays=total_plays,
        clear_rate=clear_rate,
        total_likes=total_likes,
        user_has_liked=user_has_liked
    )

@router.get("/{scenario_id}/leaderboard", response_model=List[LeaderboardEntry])
async def get_leaderboard(scenario_id: str):
    """Get the top 10 fastest solvers for a scenario based on in-game elapsed_minutes."""
    db = await get_database()
    if db is None:
        return []

    # Find completed sessions representing a solve
    pipeline = [
        {"$match": {"scenario_id": scenario_id, "is_complete": True, "outcome": "solved"}},
        {"$sort": {"player_state.elapsed_minutes": 1}},
        {"$limit": 10},
        # Join with users collection
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_details"
            }
        },
        {"$unwind": {"path": "$user_details", "preserveNullAndEmptyArrays": True}}
    ]

    cursor = db["game_sessions"].aggregate(pipeline)
    results = await cursor.to_list(length=10)

    entries = []
    for doc in results:
        ud = doc.get("user_details", {})
        entries.append(LeaderboardEntry(
            user_name=ud.get("name") or "Anonymous Detective",
            user_image=ud.get("image"),
            elapsed_minutes=doc.get("player_state", {}).get("elapsed_minutes", 0),
            solved_at=doc.get("updated_at")
        ))

    return entries

@router.get("/leaderboard/global", response_model=List[GlobalLeaderboardEntry])
async def get_global_leaderboard():
    """Get the top detectives based on difficulty-weighted scores."""
    db = await get_database()
    if db is None:
        return []

    # Aggregate sessions joined with scenarios for difficulty
    pipeline = [
        {"$match": {"is_complete": True, "outcome": "solved"}},
        {
            "$lookup": {
                "from": "scenarios",
                "localField": "scenario_id",
                "foreignField": "_id",
                "as": "scenario"
            }
        },
        {"$unwind": "$scenario"},
        {
            "$project": {
                "user_id": 1,
                "player_state.elapsed_minutes": 1,
                "score": {
                    "$switch": {
                        "branches": [
                            {"case": {"$eq": ["$scenario.difficulty", "hard"]}, "then": 500},
                            {"case": {"$eq": ["$scenario.difficulty", "medium"]}, "then": 250}
                        ],
                        "default": 100
                    }
                }
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "cases_solved": {"$sum": 1},
                "total_time": {"$sum": "$player_state.elapsed_minutes"},
                "total_points": {"$sum": "$score"}
            }
        },
        {"$sort": {"total_points": -1, "total_time": 1}},
        {"$limit": 50},
        {
            "$lookup": {
                "from": "users",
                "localField": "_id",
                "foreignField": "_id",
                "as": "user_details"
            }
        },
        {"$unwind": "$user_details"}
    ]

    cursor = db["game_sessions"].aggregate(pipeline)
    results = await cursor.to_list(length=50)

    entries = []
    for doc in results:
        ud = doc.get("user_details", {})
        cases = doc.get("cases_solved", 0)
        points = doc.get("total_points", 0)
        
        # Rank Title Logic
        title = "Junior Detective"
        if cases >= 10: title = "Senior Inspector"
        elif cases >= 5: title = "Detective Sergeant"
        elif cases >= 1: title = "Constable"

        entries.append(GlobalLeaderboardEntry(
            user_id=doc["_id"],
            user_name=ud.get("name", "Unknown Detective"),
            user_image=ud.get("image"),
            cases_solved=cases,
            total_time_mins=doc.get("total_time", 0.0),
            elo=1000 + points,
            rank_title=title
        ))

    return entries

@router.get("/leaderboard/friends", response_model=List[GlobalLeaderboardEntry])
async def get_friends_leaderboard(user: Dict[str, Any] = Depends(get_current_user)):
    """Get the leaderboard filtered to user's friends and themselves."""
    db = await get_database()
    if db is None:
        return []

    # Get friend IDs
    friend_cursor = db["friendships"].find({
        "user_id": user["id"],
        "status": "accepted"
    })
    friendships = await friend_cursor.to_list(length=100)
    friend_ids = [f["friend_id"] for f in friendships]
    
    # Fallback for demo if the user has no friends yet (matches profile.py)
    if not friend_ids:
        friend_ids = ["dummy_1", "dummy_2", "dummy_3", "dummy_4", "dummy_5", "dummy_6", "dummy_7", "dummy_8", "dummy_9", "dummy_10"]
        
    # Include self
    relevant_ids = friend_ids + [user["id"]]

    # Same pipeline but with $match on user_id
    pipeline = [
        {"$match": {"user_id": {"$in": relevant_ids}, "is_complete": True, "outcome": "solved"}},
        {
            "$lookup": {
                "from": "scenarios",
                "localField": "scenario_id",
                "foreignField": "_id",
                "as": "scenario"
            }
        },
        {"$unwind": "$scenario"},
        {
            "$project": {
                "user_id": 1,
                "player_state.elapsed_minutes": 1,
                "score": {
                    "$switch": {
                        "branches": [
                            {"case": {"$eq": ["$scenario.difficulty", "hard"]}, "then": 500},
                            {"case": {"$eq": ["$scenario.difficulty", "medium"]}, "then": 250}
                        ],
                        "default": 100
                    }
                }
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "cases_solved": {"$sum": 1},
                "total_time": {"$sum": "$player_state.elapsed_minutes"},
                "total_points": {"$sum": "$score"}
            }
        },
        {"$sort": {"total_points": -1, "total_time": 1}},
        {
            "$lookup": {
                "from": "users",
                "localField": "_id",
                "foreignField": "_id",
                "as": "user_details"
            }
        },
        {"$unwind": "$user_details"}
    ]

    cursor = db["game_sessions"].aggregate(pipeline)
    results = await cursor.to_list(length=100)

    entries = []
    for doc in results:
        ud = doc.get("user_details", {})
        cases = doc.get("cases_solved", 0)
        points = doc.get("total_points", 0)
        
        # Rank Title Logic
        title = "Junior Detective"
        if cases >= 10: title = "Senior Inspector"
        elif cases >= 5: title = "Detective Sergeant"
        elif cases >= 1: title = "Constable"

        entries.append(GlobalLeaderboardEntry(
            user_id=doc["_id"],
            user_name=ud.get("name", "Unknown Detective"),
            user_image=ud.get("image"),
            cases_solved=cases,
            total_time_mins=doc.get("total_time", 0.0),
            elo=1000 + points,
            rank_title=title
        ))

    return entries

@router.get("/{scenario_id}/comments", response_model=List[Comment])
async def get_comments(scenario_id: str):
    """Get all discussion comments for a scenario."""
    db = await get_database()
    if db is None:
        return []

    pipeline = [
        {"$match": {"scenario_id": scenario_id, "type": "comment"}},
        {"$sort": {"created_at": -1}},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_details"
            }
        },
        {"$unwind": {"path": "$user_details", "preserveNullAndEmptyArrays": True}}
    ]
    
    cursor = db["interactions"].aggregate(pipeline)
    docs = await cursor.to_list(length=100)

    comments = []
    for doc in docs:
        ud = doc.get("user_details", {})
        comments.append(Comment(
            id=doc.get("_id"),
            user_name=ud.get("name") or "Anonymous Detective",
            user_image=ud.get("image"),
            content=doc.get("content", ""),
            created_at=doc.get("created_at")
        ))
    return comments

class InteractRequest(BaseModel):
    type: str # 'like' | 'comment'
    content: Optional[str] = None

@router.post("/{scenario_id}/interact")
async def post_interaction(scenario_id: str, req: InteractRequest, user: Dict[str, Any] = Depends(get_current_user)):
    """Like a scenario or post a comment."""
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    # If it's a like, toggle logic
    if req.type == "like":
        existing = await db["interactions"].find_one({
            "scenario_id": scenario_id,
            "user_id": user["id"],
            "type": "like"
        })
        if existing:
            await db["interactions"].delete_one({"_id": existing["_id"]})
            return {"status": "unliked"}
        else:
            interaction = DBInteraction(
                _id=str(uuid.uuid4()),
                scenario_id=scenario_id,
                user_id=user["id"],
                type="like"
            )
            doc = interaction.model_dump(by_alias=True)
            await db["interactions"].insert_one(doc)
            return {"status": "liked"}

    elif req.type == "comment":
        if not req.content or not req.content.strip():
            raise HTTPException(status_code=400, detail="Comment cannot be empty")
        
        interaction = DBInteraction(
            _id=str(uuid.uuid4()),
            scenario_id=scenario_id,
            user_id=user["id"],
            type="comment",
            content=req.content.strip()
        )
        doc = interaction.model_dump(by_alias=True)
        await db["interactions"].insert_one(doc)
        return {"status": "comment_posted"}
    
    raise HTTPException(status_code=400, detail="Invalid interaction type")
