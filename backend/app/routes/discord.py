"""
Discord integration routes for Mistry Game.
Handles guild-session linking and speech summarization.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from typing import Dict, Any, List

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form

from app.core.auth import get_current_user, get_current_user_optional
from app.db.mongodb import get_database
from app.models.discord_models import (
    DiscordGuildLink,
    DiscordLinkRequest,
    DiscordLinkResponse,
    DiscordStatusResponse,
    DiscussionNote,
    DiscussionNoteResponse,
    SummarizeAudioRequest,
    SummarizeAudioResponse,
)
from app.services.speech_summarizer import get_speech_summarizer

router = APIRouter()


# ── Discord Bot Configuration ─────────────────────────────────────────


def get_bot_invite_url() -> str:
    """Generate Discord bot invite URL."""
    client_id = os.getenv("DISCORD_CLIENT_ID", "")
    if not client_id:
        return ""
    # Permissions: Send Messages, Connect, Speak, Use Slash Commands
    permissions = 3147776
    return f"https://discord.com/api/oauth2/authorize?client_id={client_id}&permissions={permissions}&scope=bot%20applications.commands"


# ── Link Management ───────────────────────────────────────────────────


@router.post("/link", response_model=DiscordLinkResponse)
async def link_discord_guild(
    request: DiscordLinkRequest,
    user: Dict[str, Any] = Depends(get_current_user_optional),
):
    """
    Link a Discord guild to a game session.
    Called by the Discord bot when /mystery link is used.
    """
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    # Check if session exists
    session = await db.sessions.find_one({"_id": request.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")

    # Check if guild is already linked to another session
    existing_link = await db.discord_links.find_one({
        "guild_id": request.guild_id,
        "session_id": {"$ne": request.session_id}
    })
    if existing_link:
        # Unlink the old session first
        await db.discord_links.delete_one({"_id": existing_link["_id"]})

    # Create or update link
    link_id = str(uuid.uuid4())
    link = DiscordGuildLink(
        id=link_id,
        guild_id=request.guild_id,
        guild_name=request.guild_name,
        session_id=request.session_id,
        scenario_id=request.scenario_id,
        text_channel_id=request.text_channel_id,
        linked_by=request.linked_by,
        linked_at=datetime.utcnow(),
    )

    link_data = link.model_dump()
    link_data.pop("id", None)
    
    # Upsert the link
    await db.discord_links.update_one(
        {"guild_id": request.guild_id},
        {"$set": link_data, "$setOnInsert": {"_id": link_id}},
        upsert=True,
    )

    # Update session with guild_id
    await db.sessions.update_one(
        {"_id": request.session_id},
        {"$set": {"discord_guild_id": request.guild_id}}
    )

    return DiscordLinkResponse(
        status="linked",
        link_id=link_id,
        session_id=request.session_id,
        guild_name=request.guild_name,
    )


@router.get("/{session_id}/status", response_model=DiscordStatusResponse)
async def get_discord_status(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user_optional),
):
    """Get Discord link status for a game session."""
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    # Find link for this session
    link = await db.discord_links.find_one({"session_id": session_id})

    if not link:
        return DiscordStatusResponse(
            is_linked=False,
            bot_invite_url=get_bot_invite_url(),
        )

    # Count notes for this session
    notes_count = await db.discussion_notes.count_documents({"session_id": session_id})

    return DiscordStatusResponse(
        is_linked=True,
        guild_id=link.get("guild_id"),
        guild_name=link.get("guild_name"),
        is_recording=link.get("is_recording", False),
        notes_count=notes_count,
        bot_invite_url=get_bot_invite_url(),
    )


@router.delete("/{session_id}/unlink")
async def unlink_discord_guild(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user_optional),
):
    """Unlink Discord guild from a game session."""
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    # Delete the link
    result = await db.discord_links.delete_one({"session_id": session_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No Discord link found for this session")

    # Clear guild_id from session
    await db.sessions.update_one(
        {"_id": session_id},
        {"$unset": {"discord_guild_id": ""}}
    )

    return {"status": "unlinked", "session_id": session_id}


# ── Recording State Management ────────────────────────────────────────


@router.post("/{session_id}/recording/start")
async def start_recording(
    session_id: str,
    user_id: str = None,
    voice_channel_id: str = None,
):
    """Mark that recording has started for a session."""
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    result = await db.discord_links.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "is_recording": True,
                "voice_channel_id": voice_channel_id,
                "recording_started_at": datetime.utcnow(),
                "recording_user_id": user_id,
            }
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No Discord link found for this session")

    return {"status": "recording_started", "session_id": session_id}


@router.post("/{session_id}/recording/stop")
async def stop_recording(session_id: str):
    """Mark that recording has stopped for a session."""
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    result = await db.discord_links.update_one(
        {"session_id": session_id},
        {
            "$set": {"is_recording": False},
            "$unset": {
                "voice_channel_id": "",
                "recording_started_at": "",
                "recording_user_id": "",
            },
        },
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="No Discord link found for this session")

    return {"status": "recording_stopped", "session_id": session_id}


# ── Audio Summarization ───────────────────────────────────────────────


@router.post("/{session_id}/summarize", response_model=SummarizeAudioResponse)
async def summarize_audio(
    session_id: str,
    audio: UploadFile = File(...),
    recorded_by: str = Form(None),
    duration_seconds: float = Form(None),
    guild_id: str = Form(None),
):
    """
    Submit audio for summarization and store the resulting notes.
    Called by the Discord bot after recording stops.
    """
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    # Verify session exists
    session = await db.sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Game session not found")

    # Get guild_id from link if not provided
    if not guild_id:
        link = await db.discord_links.find_one({"session_id": session_id})
        guild_id = link.get("guild_id") if link else "unknown"

    # Get speech summarizer
    try:
        summarizer = get_speech_summarizer()
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Read audio bytes
    audio_bytes = await audio.read()

    # Determine mime type from filename
    mime_type = "audio/wav"
    if audio.filename:
        ext = audio.filename.lower().split(".")[-1]
        mime_map = {
            "mp3": "audio/mpeg",
            "wav": "audio/wav",
            "ogg": "audio/ogg",
            "flac": "audio/flac",
            "m4a": "audio/mp4",
            "webm": "audio/webm",
        }
        mime_type = mime_map.get(ext, "audio/wav")

    # Summarize the audio
    try:
        summary = await summarizer.process_audio_bytes(audio_bytes, mime_type)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

    # Store the note
    note_id = str(uuid.uuid4())
    note = DiscussionNote(
        id=note_id,
        session_id=session_id,
        guild_id=guild_id,
        summary=summary,
        recorded_at=datetime.utcnow(),
        duration_seconds=duration_seconds,
        recorded_by=recorded_by,
    )

    await db.discussion_notes.insert_one({
        "_id": note_id,
        **note.model_dump(exclude={"id"}),
    })

    return SummarizeAudioResponse(
        status="summarized",
        note_id=note_id,
        summary=summary,
    )


# ── Notes Retrieval ───────────────────────────────────────────────────


@router.get("/{session_id}/notes", response_model=List[DiscussionNoteResponse])
async def get_discussion_notes(
    session_id: str,
    user: Dict[str, Any] = Depends(get_current_user_optional),
):
    """Get all discussion notes for a game session."""
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    cursor = db.discussion_notes.find({"session_id": session_id}).sort("recorded_at", -1)
    notes = await cursor.to_list(length=100)

    result = []
    for note in notes:
        summary = note.get("summary", {})
        result.append(DiscussionNoteResponse(
            id=note.get("_id"),
            session_id=note.get("session_id"),
            summary=summary.get("summary", ""),
            key_points=summary.get("key_points", []),
            clues=summary.get("clues", []),
            suspects=summary.get("suspects", []),
            items=summary.get("items", []),
            locations=summary.get("locations", []),
            theories=summary.get("theories", []),
            action_items=summary.get("action_items", []),
            unresolved_questions=summary.get("unresolved_questions", []),
            recorded_at=note.get("recorded_at"),
            duration_seconds=note.get("duration_seconds"),
        ))

    return result


@router.get("/{session_id}/notes/{note_id}", response_model=DiscussionNoteResponse)
async def get_discussion_note(
    session_id: str,
    note_id: str,
    user: Dict[str, Any] = Depends(get_current_user_optional),
):
    """Get a specific discussion note."""
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    note = await db.discussion_notes.find_one({
        "_id": note_id,
        "session_id": session_id,
    })

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    summary = note.get("summary", {})
    return DiscussionNoteResponse(
        id=note.get("_id"),
        session_id=note.get("session_id"),
        summary=summary.get("summary", ""),
        key_points=summary.get("key_points", []),
        clues=summary.get("clues", []),
        suspects=summary.get("suspects", []),
        items=summary.get("items", []),
        locations=summary.get("locations", []),
        theories=summary.get("theories", []),
        action_items=summary.get("action_items", []),
        unresolved_questions=summary.get("unresolved_questions", []),
        recorded_at=note.get("recorded_at"),
        duration_seconds=note.get("duration_seconds"),
    )


@router.delete("/{session_id}/notes/{note_id}")
async def delete_discussion_note(
    session_id: str,
    note_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Delete a specific discussion note."""
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    result = await db.discussion_notes.delete_one({
        "_id": note_id,
        "session_id": session_id,
    })

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")

    return {"status": "deleted", "note_id": note_id}


# ── Bot Internal Endpoints ────────────────────────────────────────────


@router.get("/guild/{guild_id}/link")
async def get_guild_link(guild_id: str):
    """Get the current link for a Discord guild. Used by the bot."""
    db = await get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    link = await db.discord_links.find_one({"guild_id": guild_id})

    if not link:
        return {"is_linked": False}

    return {
        "is_linked": True,
        "session_id": link.get("session_id"),
        "scenario_id": link.get("scenario_id"),
        "guild_name": link.get("guild_name"),
        "is_recording": link.get("is_recording", False),
    }
