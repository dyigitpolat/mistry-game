from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class DBUser(BaseModel):
    id: str = Field(alias="_id")
    name: Optional[str] = None
    email: str
    image: Optional[str] = None

class DBGameSession(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    scenario_id: str
    player_state: Dict[str, Any]
    character_states: Dict[str, Any]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class DBInteraction(BaseModel):
    id: str = Field(alias="_id")
    scenario_id: str
    user_id: str
    type: str # "like" or "comment"
    content: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
