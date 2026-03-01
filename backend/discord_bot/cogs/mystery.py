"""
Mystery cog - Game session linking and notes commands.

Uses py-cord's slash command decorators.
"""

import logging
from typing import Optional

import aiohttp
import discord
from discord.ext import commands
from discord.commands import slash_command, SlashCommandGroup, option

logger = logging.getLogger("mistry_bot.mystery")


class MysteryCommands(commands.Cog):
    """Commands for managing mystery game sessions."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.config = bot.config

    async def _api_request(
        self,
        method: str,
        path: str,
        json: dict = None,
        data: aiohttp.FormData = None,
    ) -> dict:
        """Make a request to the Mistry API."""
        url = f"{self.config.api_base_url}{path}"
        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, json=json, data=data) as resp:
                if resp.status >= 400:
                    error = await resp.text()
                    raise Exception(f"API error {resp.status}: {error}")
                return await resp.json()

    # Create slash command group
    mystery = SlashCommandGroup("mystery", "Mistry mystery game commands")

    @mystery.command(name="help", description="Show help for Mistry bot commands")
    async def help_command(self, ctx: discord.ApplicationContext):
        """Show help message."""
        embed = discord.Embed(
            title="Mistry Bot Commands",
            description="Collaborate on mystery games with voice discussions!",
            color=discord.Color.purple(),
        )

        embed.add_field(
            name="/mystery link <session_id>",
            value="Link this server to a game session",
            inline=False,
        )
        embed.add_field(
            name="/mystery status",
            value="Show current link status and game info",
            inline=False,
        )
        embed.add_field(
            name="/mystery record",
            value="Join voice and start recording your discussion",
            inline=False,
        )
        embed.add_field(
            name="/mystery stop",
            value="Stop recording and summarize the discussion",
            inline=False,
        )
        embed.add_field(
            name="/mystery notes",
            value="Show all discussion notes for this session",
            inline=False,
        )
        embed.add_field(
            name="/mystery unlink",
            value="Unlink this server from the game session",
            inline=False,
        )

        embed.set_footer(text=f"Play at {self.config.frontend_url}")
        await ctx.respond(embed=embed)

    @mystery.command(name="link", description="Link this server to a game session")
    @option("session_id", description="The game session ID (copy from game header)", required=True)
    async def link_command(self, ctx: discord.ApplicationContext, session_id: str):
        """Link this guild to a game session."""
        await ctx.defer()

        try:
            result = await self._api_request(
                "POST",
                "/discord/link",
                json={
                    "guild_id": str(ctx.guild_id),
                    "guild_name": ctx.guild.name,
                    "session_id": session_id,
                    "scenario_id": "",
                    "text_channel_id": str(ctx.channel_id),
                    "linked_by": str(ctx.author.id),
                },
            )

            embed = discord.Embed(
                title="✅ Session Linked!",
                description=f"This server is now linked to game session\n`{session_id}`",
                color=discord.Color.green(),
            )
            embed.add_field(
                name="Next Steps",
                value=(
                    "1. Join a voice channel\n"
                    "2. Use `/mystery record` to start recording\n"
                    "3. Discuss the mystery!\n"
                    "4. Use `/mystery stop` when done"
                ),
                inline=False,
            )
            embed.add_field(
                name="Game Link",
                value=f"{self.config.frontend_url}/game/{session_id}",
                inline=False,
            )

            await ctx.followup.send(embed=embed)

        except Exception as e:
            logger.error(f"Failed to link session: {e}")
            await ctx.followup.send(
                f"❌ Failed to link session: {str(e)}\n"
                "Make sure the session ID is correct.",
                ephemeral=True,
            )

    @mystery.command(name="status", description="Show current link status")
    async def status_command(self, ctx: discord.ApplicationContext):
        """Show current link status."""
        await ctx.defer()

        try:
            result = await self._api_request(
                "GET",
                f"/discord/guild/{ctx.guild_id}/link",
            )

            if not result.get("is_linked"):
                embed = discord.Embed(
                    title="Not Linked",
                    description="This server is not linked to any game session.",
                    color=discord.Color.orange(),
                )
                embed.add_field(
                    name="Get Started",
                    value=(
                        f"1. Start a game at {self.config.frontend_url}\n"
                        "2. Copy the session ID from the game header\n"
                        "3. Use `/mystery link <session_id>`"
                    ),
                    inline=False,
                )
            else:
                embed = discord.Embed(
                    title="✅ Session Status",
                    color=discord.Color.green(),
                )
                embed.add_field(
                    name="Session ID",
                    value=f"`{result.get('session_id')}`",
                    inline=True,
                )
                embed.add_field(
                    name="Recording",
                    value="🔴 Yes" if result.get("is_recording") else "⚪ No",
                    inline=True,
                )
                embed.add_field(
                    name="Game Link",
                    value=f"{self.config.frontend_url}/game/{result.get('session_id')}",
                    inline=False,
                )

            await ctx.followup.send(embed=embed)

        except Exception as e:
            logger.error(f"Failed to get status: {e}")
            await ctx.followup.send(
                f"❌ Failed to get status: {str(e)}",
                ephemeral=True,
            )

    @mystery.command(name="notes", description="Show all discussion notes")
    async def notes_command(self, ctx: discord.ApplicationContext):
        """Show all discussion notes."""
        await ctx.defer()

        try:
            link_result = await self._api_request(
                "GET",
                f"/discord/guild/{ctx.guild_id}/link",
            )

            if not link_result.get("is_linked"):
                await ctx.followup.send(
                    "This server is not linked to any game session.",
                    ephemeral=True,
                )
                return

            session_id = link_result.get("session_id")
            notes = await self._api_request(
                "GET",
                f"/discord/{session_id}/notes",
            )

            if not notes:
                embed = discord.Embed(
                    title="No Notes Yet",
                    description="Start a recording to capture your discussion!",
                    color=discord.Color.blue(),
                )
                embed.add_field(
                    name="How to Record",
                    value=(
                        "1. Join a voice channel\n"
                        "2. Use `/mystery record`\n"
                        "3. Discuss the mystery\n"
                        "4. Use `/mystery stop`"
                    ),
                    inline=False,
                )
            else:
                embed = discord.Embed(
                    title=f"📝 Discussion Notes ({len(notes)} total)",
                    color=discord.Color.purple(),
                )

                for i, note in enumerate(notes[:5], 1):
                    summary = note.get("summary", "No summary")
                    if len(summary) > 200:
                        summary = summary[:200] + "..."

                    clues = note.get("clues", [])
                    suspects = note.get("suspects", [])
                    theories = note.get("theories", [])

                    details = []
                    if clues:
                        details.append(f"🔍 {len(clues)} clues")
                    if suspects:
                        details.append(f"👤 {len(suspects)} suspects")
                    if theories:
                        details.append(f"💡 {len(theories)} theories")

                    field_value = f"{summary}\n*{', '.join(details) if details else 'No details'}*"
                    embed.add_field(
                        name=f"Note #{i}",
                        value=field_value,
                        inline=False,
                    )

                if len(notes) > 5:
                    embed.set_footer(text=f"Showing 5 of {len(notes)} notes")

            await ctx.followup.send(embed=embed)

        except Exception as e:
            logger.error(f"Failed to get notes: {e}")
            await ctx.followup.send(
                f"❌ Failed to get notes: {str(e)}",
                ephemeral=True,
            )

    @mystery.command(name="record", description="Start recording voice discussion")
    async def record_command(self, ctx: discord.ApplicationContext):
        """Start recording - delegates to voice cog."""
        voice_cog = self.bot.get_cog("VoiceRecording")
        if voice_cog:
            await voice_cog.start_recording_impl(ctx)
        else:
            await ctx.respond(
                "Voice recording is not available.",
                ephemeral=True,
            )

    @mystery.command(name="stop", description="Stop recording and summarize")
    async def stop_command(self, ctx: discord.ApplicationContext):
        """Stop recording - delegates to voice cog."""
        voice_cog = self.bot.get_cog("VoiceRecording")
        if voice_cog:
            await voice_cog.stop_recording_impl(ctx)
        else:
            await ctx.respond(
                "Voice recording is not available.",
                ephemeral=True,
            )

    @mystery.command(name="unlink", description="Unlink from game session")
    async def unlink_command(self, ctx: discord.ApplicationContext):
        """Unlink this guild from the game session."""
        await ctx.defer()

        try:
            link_result = await self._api_request(
                "GET",
                f"/discord/guild/{ctx.guild_id}/link",
            )

            if not link_result.get("is_linked"):
                await ctx.followup.send(
                    "This server is not linked to any game session.",
                    ephemeral=True,
                )
                return

            session_id = link_result.get("session_id")

            await self._api_request(
                "DELETE",
                f"/discord/{session_id}/unlink",
            )

            embed = discord.Embed(
                title="🔓 Session Unlinked",
                description="This server is no longer linked to a game session.",
                color=discord.Color.orange(),
            )
            embed.add_field(
                name="Note",
                value="Your discussion notes are still saved in the game.",
                inline=False,
            )

            await ctx.followup.send(embed=embed)

        except Exception as e:
            logger.error(f"Failed to unlink: {e}")
            await ctx.followup.send(
                f"❌ Failed to unlink: {str(e)}",
                ephemeral=True,
            )

    @mystery.command(name="addnote", description="Manually add a discussion note")
    @option("note", description="Your discussion summary or notes", required=True)
    async def addnote_command(self, ctx: discord.ApplicationContext, note: str):
        """Manually add a note without recording."""
        await ctx.defer()

        try:
            link_result = await self._api_request(
                "GET",
                f"/discord/guild/{ctx.guild_id}/link",
            )

            if not link_result.get("is_linked"):
                await ctx.followup.send(
                    "This server is not linked to any game session.\n"
                    "Use `/mystery link <session_id>` first.",
                    ephemeral=True,
                )
                return

            session_id = link_result.get("session_id")

            form = aiohttp.FormData()
            form.add_field(
                "audio",
                note.encode("utf-8"),
                filename="transcription.txt",
                content_type="text/plain",
            )
            form.add_field("recorded_by", str(ctx.author.id))
            form.add_field("duration_seconds", "0")
            form.add_field("guild_id", str(ctx.guild_id))

            result = await self._api_request(
                "POST",
                f"/discord/{session_id}/summarize",
                data=form,
            )

            summary = result.get("summary", {})
            embed = discord.Embed(
                title="✅ Note Added!",
                description=summary.get("summary", note[:500]),
                color=discord.Color.purple(),
            )

            clues = summary.get("clues", [])
            if clues:
                embed.add_field(
                    name=f"🔍 Clues Extracted ({len(clues)})",
                    value="\n".join(f"• {c.get('name')}" for c in clues[:3]),
                    inline=True,
                )

            suspects = summary.get("suspects", [])
            if suspects:
                embed.add_field(
                    name=f"👤 Suspects ({len(suspects)})",
                    value="\n".join(f"• {s.get('name')}" for s in suspects[:3]),
                    inline=True,
                )

            await ctx.followup.send(embed=embed)

        except Exception as e:
            logger.error(f"Failed to add note: {e}")
            await ctx.followup.send(
                f"❌ Failed to add note: {str(e)}",
                ephemeral=True,
            )


def setup(bot: commands.Bot):
    """Add the cog to the bot."""
    bot.add_cog(MysteryCommands(bot))
