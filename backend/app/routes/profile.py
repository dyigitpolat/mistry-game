from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

from app.core.auth import get_current_user
from app.db.mongodb import get_database
from app.services.game_engine import GameEngine

_engine = GameEngine()

router = APIRouter()

class UserCaseHistoryEntry(BaseModel):
    scenario_id: str
    scenario_title: str
    outcome: str
    rank: str  # S, A, B, C
    elapsed_minutes: float
    clues_found: int
    total_clues: int
    solved_at: datetime

class Badge(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    unlocked: bool = False
    unlocked_at: Optional[datetime] = None

class UserProfileStats(BaseModel):
    name: str
    id: str
    title: str = "Junior Detective"
    elo: int = 1500
    cases_solved: int = 0
    field_time_hours: int = 0
    avg_accuracy: int = 0
    top_assistant: str = "Watson AI"
    case_history: List[UserCaseHistoryEntry] = Field(default_factory=list)
    badges: List[Badge] = Field(default_factory=list)
    skills: Dict[str, int] = {
        "Observation": 50,
        "Interrogation": 50,
        "Forensics": 50
    }

class FriendActivity(BaseModel):
    user_name: str
    user_image: Optional[str] = None
    action: str  # "Started", "Solved", "Discovered Clue"
    scenario_title: str
    time_ago: str
    timestamp: datetime

@router.get("/stats", response_model=UserProfileStats)
async def get_profile_stats(user: Dict[str, Any] = Depends(get_current_user)):
    """Aggregate all-time stats and history for the current user."""
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    # 1. Fetch User Details
    user_doc = await db["users"].find_one({"_id": user["id"]})
    user_name = user_doc.get("name", "Detective") if user_doc else "Detective"

    # 2. Fetch All Sessions for User
    sessions_cursor = db["game_sessions"].find({"user_id": user["id"]}).sort("updated_at", -1)
    sessions = await sessions_cursor.to_list(length=100)

    # 3. Calculate Stats
    cases_solved = sum(1 for s in sessions if s.get("is_complete") and s.get("outcome") == "solved")
    total_minutes = sum(s.get("player_state", {}).get("elapsed_minutes", 0) for s in sessions)
    field_time_hours = int(total_minutes / 60)

    # 4. Construct Case History
    case_history = []
    total_accuracy_pct = 0
    solved_count_for_accuracy = 0

    for s in sessions:
        if not s.get("is_complete"):
            continue

        sid = s.get("scenario_id")
        scenario = _engine.scenarios.get(sid)
        if not scenario:
            continue

        clues_found = len(s.get("player_state", {}).get("clues", []))
        # Determine total clues available in scenario via game_world.locations
        total_clues = sum(len(loc.clues) for loc in scenario.game_world.locations.values())
        
        accuracy = (clues_found / total_clues * 100) if total_clues > 0 else 100
        if s.get("outcome") == "solved":
            total_accuracy_pct += accuracy
            solved_count_for_accuracy += 1

        # Naive Rank Logic
        rank = "S"
        if accuracy < 70: rank = "C"
        elif accuracy < 85: rank = "B"
        elif accuracy < 95: rank = "A"

        case_history.append(UserCaseHistoryEntry(
            scenario_id=sid,
            scenario_title=scenario.title,
            outcome=s.get("outcome", "unknown"),
            rank=rank,
            elapsed_minutes=s.get("player_state", {}).get("elapsed_minutes", 0),
            clues_found=clues_found,
            total_clues=total_clues,
            solved_at=s.get("updated_at") or datetime.utcnow()
        ))

    avg_accuracy = int(total_accuracy_pct / solved_count_for_accuracy) if solved_count_for_accuracy > 0 else 0

    # 5. Determine Title
    title = "Junior Detective"
    if cases_solved >= 10: title = "Senior Inspector"
    elif cases_solved >= 5: title = "Detective Sergeant"
    elif cases_solved >= 1: title = "Constable"

    # 6. Mock Badges & Skills (Logic can be expanded)
    badges = [
        Badge(id="sherlock", name="Sherlock Award", description="Solved a hard case under 60m", icon="detector", unlocked=cases_solved > 0),
        Badge(id="eagle", name="Eagle Eye", description="Found all clues in 5 cases", icon="search", unlocked=avg_accuracy > 90),
        Badge(id="polygraph", name="Polygraph", description="Broke 10 suspects", icon="record_voice_over", unlocked=len(sessions) > 5)
    ]

    return UserProfileStats(
        name=user_name,
        id=user["id"],
        title=title,
        elo=1500 + (cases_solved * 50),
        cases_solved=cases_solved,
        field_time_hours=field_time_hours,
        avg_accuracy=avg_accuracy,
        case_history=case_history[:10], # Last 10 cases
        badges=badges,
        skills={
            "Observation": min(100, 50 + cases_solved * 5),
            "Interrogation": min(100, 40 + cases_solved * 10),
            "Forensics": min(100, 60 + cases_solved * 3)
        }
    )

@router.get("/friends/activity", response_model=List[FriendActivity])
async def get_friends_activity(user: Dict[str, Any] = Depends(get_current_user)):
    """Get a feed of recent activities from the user's friends."""
    db = await get_database()
    if db is None:
        return []

    # 1. Get friend IDs
    friend_docs = await db["friendships"].find({
        "user_id": user["id"],
        "status": "accepted"
    }).to_list(length=100)
    
    friend_ids = [f["friend_id"] for f in friend_docs]
    if not friend_ids:
        # Fallback for demo if the user has no friends yet
        # Let's show some global activity from dummy users instead
        friend_ids = ["dummy_1", "dummy_2", "dummy_3", "dummy_4", "dummy_5", "dummy_6", "dummy_7", "dummy_8", "dummy_9", "dummy_10"]

    # 2. Get latest sessions for these friends
    pipeline = [
        {"$match": {"user_id": {"$in": friend_ids}}},
        {"$sort": {"updated_at": -1}},
        {"$limit": 20},
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "_id",
                "as": "user_details"
            }
        },
        {"$unwind": "$user_details"}
    ]

    cursor = db["game_sessions"].aggregate(pipeline)
    sessions = await cursor.to_list(length=20)

    activity_feed = []
    for s in sessions:
        ud = s.get("user_details", {})
        sid = s.get("scenario_id")
        scenario = _engine.scenarios.get(sid)
        scenario_title = scenario.title if scenario else "Unknown Case"
        
        action = "Solving"
        if s.get("is_complete"):
            action = "Solved" if s.get("outcome") == "solved" else "Closed"
        elif s.get("player_state", {}).get("elapsed_minutes", 0) < 5:
            action = "Started"

        # Calculate time ago (fuzzy)
        delta = datetime.utcnow() - s.get("updated_at")
        if delta.days > 0:
            time_ago = f"{delta.days}d ago"
        elif delta.seconds > 3600:
            time_ago = f"{delta.seconds // 3600}h ago"
        elif delta.seconds > 60:
            time_ago = f"{delta.seconds // 60}m ago"
        else:
            time_ago = "Just now"

        activity_feed.append(FriendActivity(
            user_name=ud.get("name", "Detective"),
            user_image=ud.get("image"),
            action=action,
            scenario_title=scenario_title,
            time_ago=time_ago,
            timestamp=s.get("updated_at")
        ))

    return activity_feed
