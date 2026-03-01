"""
Mistry Discord Bot - Main entry point.

Run with: python -m discord_bot.bot
"""

import asyncio
import logging
import sys
from pathlib import Path

import discord
from discord.ext import commands

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from discord_bot.config import get_config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger("mistry_bot")

# Load Opus library for voice
def load_opus():
    """Load the Opus library for voice support."""
    opus_paths = [
        '/opt/homebrew/lib/libopus.dylib',  # Apple Silicon Homebrew
        '/usr/local/lib/libopus.dylib',      # Intel Homebrew
        '/opt/homebrew/lib/libopus.0.dylib',
        '/usr/local/lib/libopus.0.dylib',
        'libopus.so.0',                       # Linux
        'libopus.so',
        'opus',
    ]

    for path in opus_paths:
        try:
            discord.opus.load_opus(path)
            logger.info(f"Loaded Opus from: {path}")
            return True
        except Exception:
            continue

    logger.warning("Could not load Opus library. Voice recording may not work.")
    return False

# Try to load Opus at module load time
load_opus()


class MistryBot(commands.Bot):
    """Main bot class for Mistry mystery game integration."""

    def __init__(self, config):
        intents = discord.Intents.default()
        intents.message_content = True
        intents.voice_states = True
        intents.guilds = True

        # For py-cord, we can set debug_guilds for instant command sync
        debug_guilds = [int(config.guild_id)] if config.guild_id else None

        super().__init__(
            command_prefix="!",
            intents=intents,
            description="Mistry - Collaborative Mystery Game Bot",
            debug_guilds=debug_guilds,  # py-cord: instant sync to these guilds
        )

        self.config = config
        self.logger = logger

    async def on_ready(self):
        """Called when the bot is ready."""
        logger.info(f"Logged in as {self.user} (ID: {self.user.id})")
        logger.info(f"Connected to {len(self.guilds)} guilds")
        logger.info(f"API Base URL: {self.config.api_base_url}")
        logger.info(f"Frontend URL: {self.config.frontend_url}")

        # List registered commands
        logger.info(f"Registered slash commands: {[cmd.name for cmd in self.pending_application_commands]}")

        # Set presence
        activity = discord.Activity(
            type=discord.ActivityType.watching,
            name="mystery discussions | /mystery",
        )
        await self.change_presence(activity=activity)

    async def on_guild_join(self, guild: discord.Guild):
        """Called when the bot joins a new guild."""
        logger.info(f"Joined guild: {guild.name} (ID: {guild.id})")

        for channel in guild.text_channels:
            if channel.permissions_for(guild.me).send_messages:
                embed = discord.Embed(
                    title="Welcome to Mistry!",
                    description=(
                        "I help groups collaboratively solve mystery games by "
                        "recording and summarizing your voice discussions.\n\n"
                        "**Quick Start:**\n"
                        "1. Start a game at the Mistry website\n"
                        "2. Use `/mystery link <session_id>` to connect this server\n"
                        "3. Join a voice channel and use `/mystery record`\n"
                        "4. Discuss the mystery, then `/mystery stop` to get notes!"
                    ),
                    color=discord.Color.purple(),
                )
                embed.set_footer(text="Use /mystery help for all commands")
                await channel.send(embed=embed)
                break


# Create bot instance globally so cogs can register commands
config = None
bot = None


def create_bot():
    global config, bot
    config = get_config()
    bot = MistryBot(config)
    return bot


async def main():
    """Main entry point."""
    try:
        bot = create_bot()
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        logger.error("Make sure DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are set in .env")
        return

    # Load cogs
    bot.load_extension("discord_bot.cogs.mystery")
    bot.load_extension("discord_bot.cogs.voice")

    try:
        await bot.start(config.token)
    except discord.LoginFailure:
        logger.error("Invalid bot token. Check DISCORD_BOT_TOKEN in .env")
    except Exception as e:
        logger.exception(f"Bot crashed: {e}")
    finally:
        await bot.close()


if __name__ == "__main__":
    asyncio.run(main())
