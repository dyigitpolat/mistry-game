"""
Voice cog - Voice channel recording and summarization.

Uses py-cord's voice recording capabilities to capture audio,
then sends it to Mistral's Voxtral for speech-to-text summarization.
"""

import asyncio
import io
import logging
import os
import subprocess
import tempfile
import time
from typing import Dict

import aiohttp
import discord
from discord.ext import commands

logger = logging.getLogger("mistry_bot.voice")


class VoiceRecording(commands.Cog):
    """Voice recording functionality for mystery discussions."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.config = bot.config
        self.active_recordings: Dict[int, dict] = {}  # guild_id -> recording state

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

    async def _convert_ogg_to_wav(self, ogg_data: bytes) -> bytes | None:
        """Convert OGG audio to WAV using ffmpeg."""
        try:
            # Create temp files for conversion
            with tempfile.NamedTemporaryFile(suffix=".ogg", delete=False) as ogg_file:
                ogg_file.write(ogg_data)
                ogg_path = ogg_file.name

            wav_path = ogg_path.replace(".ogg", ".wav")

            # Run ffmpeg conversion
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    [
                        "ffmpeg", "-y", "-i", ogg_path,
                        "-acodec", "pcm_s16le",
                        "-ar", "16000",  # 16kHz sample rate for speech
                        "-ac", "1",  # Mono
                        wav_path
                    ],
                    capture_output=True,
                    timeout=30,
                )
            )

            if result.returncode != 0:
                logger.error(f"ffmpeg conversion failed: {result.stderr.decode()}")
                return None

            # Read the converted WAV
            with open(wav_path, "rb") as wav_file:
                wav_data = wav_file.read()

            # Cleanup temp files
            os.unlink(ogg_path)
            os.unlink(wav_path)

            return wav_data

        except Exception as e:
            logger.error(f"Audio conversion error: {e}")
            return None

    async def start_recording_impl(self, ctx: discord.ApplicationContext):
        """Start recording voice in the user's channel."""
        guild_id = ctx.guild_id

        # Check if already recording
        if guild_id in self.active_recordings:
            await ctx.respond(
                "Already recording! Use `/mystery stop` to finish.",
                ephemeral=True,
            )
            return

        # Check if user is in a voice channel
        if not ctx.author.voice:
            await ctx.respond(
                "You need to be in a voice channel to start recording.",
                ephemeral=True,
            )
            return

        # Check if linked to a session
        try:
            link_result = await self._api_request(
                "GET",
                f"/discord/guild/{guild_id}/link",
            )
            if not link_result.get("is_linked"):
                await ctx.respond(
                    "This server is not linked to a game session.\n"
                    "Use `/mystery link <session_id>` first.",
                    ephemeral=True,
                )
                return
        except Exception as e:
            logger.error(f"Failed to check link status: {e}")
            await ctx.respond(
                f"Failed to check link status: {str(e)}",
                ephemeral=True,
            )
            return

        await ctx.defer()

        voice_channel = ctx.author.voice.channel

        try:
            # Connect to voice channel
            voice_client = await voice_channel.connect()

            # Store recording state
            self.active_recordings[guild_id] = {
                "voice_client": voice_client,
                "channel": ctx.channel,
                "user_id": str(ctx.author.id),
                "session_id": link_result.get("session_id"),
                "start_time": time.time(),
                "ctx": ctx,
            }

            # Start recording with OGGSink (uses opus natively, avoids decoding issues)
            voice_client.start_recording(
                discord.sinks.OGGSink(),
                self._recording_finished_callback,
                ctx.channel,
                sync_start=True,
            )

            # Notify API that recording started
            try:
                await self._api_request(
                    "POST",
                    f"/discord/{link_result.get('session_id')}/recording/start",
                    json={
                        "user_id": str(ctx.author.id),
                        "voice_channel_id": str(voice_channel.id),
                    },
                )
            except Exception as e:
                logger.warning(f"Failed to notify API of recording start: {e}")

            embed = discord.Embed(
                title="🎙️ Recording Started",
                description=f"Now recording in **{voice_channel.name}**",
                color=discord.Color.red(),
            )
            embed.add_field(
                name="Instructions",
                value=(
                    "1. Discuss the mystery with your group\n"
                    "2. Speak clearly for best transcription\n"
                    "3. Use `/mystery stop` when done\n\n"
                    "**Voxtral AI will transcribe and summarize your discussion!**"
                ),
                inline=False,
            )
            embed.set_footer(text="🔴 Recording in progress...")

            await ctx.followup.send(embed=embed)

        except discord.ClientException as e:
            logger.error(f"Failed to connect to voice: {e}")
            await ctx.followup.send(
                f"Failed to connect to voice channel: {str(e)}",
                ephemeral=True,
            )
        except Exception as e:
            logger.error(f"Failed to start recording: {e}")
            await ctx.followup.send(
                f"Failed to start recording: {str(e)}",
                ephemeral=True,
            )

    async def stop_recording_impl(self, ctx: discord.ApplicationContext):
        """Stop recording and process with Voxtral."""
        guild_id = ctx.guild_id

        # Check if recording
        if guild_id not in self.active_recordings:
            await ctx.respond(
                "Not currently recording. Use `/mystery record` to start.",
                ephemeral=True,
            )
            return

        await ctx.defer()

        recording = self.active_recordings.get(guild_id)
        if not recording:
            await ctx.followup.send("Recording state not found.", ephemeral=True)
            return

        voice_client = recording["voice_client"]

        try:
            embed = discord.Embed(
                title="⏹️ Recording Stopped",
                description="Processing your discussion with Voxtral AI...",
                color=discord.Color.blue(),
            )
            await ctx.followup.send(embed=embed)

            # Stop recording in a thread to avoid blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, voice_client.stop_recording)

        except Exception as e:
            logger.error(f"Failed to stop recording: {e}")
            # Try to clean up anyway
            self.active_recordings.pop(guild_id, None)
            try:
                await voice_client.disconnect()
            except:
                pass
            await ctx.channel.send(
                f"⚠️ Error stopping recording: {str(e)}\nPlease try `/mystery record` again.",
            )

    async def _recording_finished_callback(
        self, sink: discord.sinks.WaveSink, channel: discord.TextChannel, *args
    ):
        """Called when recording is stopped. Process audio with Voxtral."""
        guild_id = channel.guild.id
        logger.info(f"Recording finished for guild {guild_id}")

        # Get recording state
        recording = self.active_recordings.pop(guild_id, None)
        if not recording:
            logger.warning("Recording state not found in callback")
            return

        session_id = recording["session_id"]
        start_time = recording["start_time"]
        duration = time.time() - start_time
        voice_client = recording["voice_client"]

        try:
            # Disconnect from voice
            await voice_client.disconnect()
        except Exception as e:
            logger.warning(f"Error disconnecting: {e}")

        # Notify API that recording stopped
        try:
            await self._api_request(
                "POST",
                f"/discord/{session_id}/recording/stop",
            )
        except Exception as e:
            logger.warning(f"Failed to notify API of recording stop: {e}")

        # Check if we have any audio
        if not sink.audio_data:
            embed = discord.Embed(
                title="No Audio Captured",
                description="No speech was detected during the recording.",
                color=discord.Color.orange(),
            )
            await channel.send(embed=embed)
            return

        # Process audio
        processing_msg = await channel.send(
            embed=discord.Embed(
                title="🔄 Processing Audio...",
                description="Sending to Voxtral AI for transcription and analysis...",
                color=discord.Color.blue(),
            )
        )

        try:
            # Combine all user audio streams into one
            # For now, we'll use the longest/first audio stream
            audio_data = None
            for user_id, audio in sink.audio_data.items():
                audio.file.seek(0)
                user_audio = audio.file.read()
                if audio_data is None or len(user_audio) > len(audio_data):
                    audio_data = user_audio

            if not audio_data or len(audio_data) < 1000:
                await processing_msg.delete()
                embed = discord.Embed(
                    title="Recording Too Short",
                    description="The recording was too short or quiet to process.",
                    color=discord.Color.orange(),
                )
                await channel.send(embed=embed)
                return

            logger.info(f"Audio captured: {len(audio_data)} bytes from {len(sink.audio_data)} users")

            # Convert OGG to WAV using ffmpeg (Voxtral only accepts mp3/wav)
            wav_data = await self._convert_ogg_to_wav(audio_data)
            if not wav_data:
                await processing_msg.delete()
                embed = discord.Embed(
                    title="Audio Conversion Failed",
                    description="Failed to convert audio format. Make sure ffmpeg is installed.",
                    color=discord.Color.orange(),
                )
                await channel.send(embed=embed)
                return

            logger.info(f"Converted to WAV: {len(wav_data)} bytes")

            # Send to API for summarization with Voxtral
            form = aiohttp.FormData()
            form.add_field(
                "audio",
                wav_data,
                filename="recording.wav",
                content_type="audio/wav",
            )
            form.add_field("recorded_by", recording["user_id"])
            form.add_field("duration_seconds", str(duration))
            form.add_field("guild_id", str(guild_id))

            result = await self._api_request(
                "POST",
                f"/discord/{session_id}/summarize",
                data=form,
            )

            await processing_msg.delete()

            # Display the summary
            summary = result.get("summary", {})

            embed = discord.Embed(
                title="🎯 Discussion Summary",
                description=summary.get("summary", "No summary generated"),
                color=discord.Color.purple(),
            )

            # Show transcript if available (for debugging)
            transcript = summary.get("transcript")
            if transcript and transcript != "Could not transcribe - audio unclear":
                transcript_preview = transcript[:300] + "..." if len(transcript) > 300 else transcript
                embed.add_field(name="📝 Transcript", value=transcript_preview, inline=False)

            # Key points
            key_points = summary.get("key_points", [])
            if key_points:
                points_text = "\n".join(f"• {p}" for p in key_points[:5])
                embed.add_field(name="📌 Key Points", value=points_text, inline=False)

            # Clues
            clues = summary.get("clues", [])
            if clues:
                clues_text = "\n".join(
                    f"• **{c.get('name')}** [{c.get('significance', '?')}]\n  {c.get('description', '')[:60]}"
                    for c in clues[:3]
                )
                embed.add_field(name=f"🔍 Clues ({len(clues)})", value=clues_text, inline=False)

            # Suspects
            suspects = summary.get("suspects", [])
            if suspects:
                suspects_text = "\n".join(
                    f"• **{s.get('name')}** - {s.get('suspicion_level', 'unknown')} suspicion"
                    for s in suspects[:3]
                )
                embed.add_field(name=f"👤 Suspects ({len(suspects)})", value=suspects_text, inline=True)

            # Theories
            theories = summary.get("theories", [])
            if theories:
                theories_text = "\n".join(
                    f"• {t.get('theory', '')[:80]}"
                    for t in theories[:2]
                )
                embed.add_field(name=f"💡 Theories ({len(theories)})", value=theories_text, inline=False)

            # Action items
            action_items = summary.get("action_items", [])
            if action_items:
                actions_text = "\n".join(f"• {a}" for a in action_items[:3])
                embed.add_field(name="📋 Next Steps", value=actions_text, inline=False)

            embed.set_footer(
                text=f"Duration: {int(duration)}s | Processed by Voxtral AI | View full notes in game"
            )

            await channel.send(embed=embed)

        except Exception as e:
            logger.exception(f"Failed to process recording: {e}")
            await processing_msg.delete()
            embed = discord.Embed(
                title="❌ Processing Failed",
                description=f"Failed to process the recording: {str(e)}",
                color=discord.Color.red(),
            )
            embed.add_field(
                name="Alternative",
                value="You can manually add notes with `/mystery addnote <your notes>`",
                inline=False,
            )
            await channel.send(embed=embed)

    @commands.Cog.listener()
    async def on_voice_state_update(
        self,
        member: discord.Member,
        before: discord.VoiceState,
        after: discord.VoiceState,
    ):
        """Handle voice state changes."""
        guild_id = member.guild.id

        # Check if bot was disconnected while recording
        if member.id == self.bot.user.id and guild_id in self.active_recordings:
            if before.channel and not after.channel:
                recording = self.active_recordings.pop(guild_id, None)
                if recording:
                    logger.warning(f"Bot disconnected from voice in guild {guild_id}")
                    try:
                        await self._api_request(
                            "POST",
                            f"/discord/{recording['session_id']}/recording/stop",
                        )
                    except Exception:
                        pass


def setup(bot: commands.Bot):
    """Add the cog to the bot."""
    bot.add_cog(VoiceRecording(bot))
