from fastapi import HTTPException, Security, Depends
from fastapi.security.api_key import APIKeyHeader
from typing import Dict, Any, Optional

API_KEY_NAME = "x-user-id"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=True)

async def get_current_user(user_id: str = Security(api_key_header)) -> Dict[str, Any]:
    """
    Validates that the x-user-id header is present. 
    This header is securely populated by the Next.js API Proxy from the Next-Auth session.
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    return {"id": user_id}

async def get_current_user_optional(user_id: str = Security(APIKeyHeader(name=API_KEY_NAME, auto_error=False))) -> Optional[Dict[str, Any]]:
    """
    Like get_current_user, but returns None if not authenticated instead of throwing 401.
    """
    if not user_id:
        return None
    return {"id": user_id}
