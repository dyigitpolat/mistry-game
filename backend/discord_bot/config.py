"""
Configuration for the Mistry Discord bot.
"""

import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv


@dataclass
class BotConfig:
    """Bot configuration loaded from environment variables."""

    token: str
    client_id: str
    api_base_url: str
    frontend_url: str
    guild_id: Optional[str] = None  # For development - restrict to single guild

    @classmethod
    def from_env(cls) -> "BotConfig":
        """Load configuration from environment variables."""
        load_dotenv()

        token = os.getenv("DISCORD_BOT_TOKEN")
        if not token:
            raise ValueError("DISCORD_BOT_TOKEN not set")

        client_id = os.getenv("DISCORD_CLIENT_ID") or os.getenv("NEXT_PUBLIC_DISCORD_CLIENT_ID")
        if not client_id:
            raise ValueError("DISCORD_CLIENT_ID or NEXT_PUBLIC_DISCORD_CLIENT_ID not set")

        return cls(
            token=token,
            client_id=client_id,
            api_base_url=os.getenv("API_BASE_URL", "http://localhost:8000"),
            frontend_url=os.getenv("FRONTEND_URL", "http://localhost:3000"),
            guild_id=os.getenv("DISCORD_DEV_GUILD_ID"),  # Optional
        )


def get_config() -> BotConfig:
    """Get the bot configuration."""
    return BotConfig.from_env()
