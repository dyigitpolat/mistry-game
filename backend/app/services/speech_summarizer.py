"""
Speech Summarizer Service for Mistry Game.
Uses Mistral's Voxtral Small model to process audio and generate structured notes.

Ported from speech_summarizer.ipynb with async support for FastAPI.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import re
import tempfile
from pathlib import Path
from typing import Optional

from mistralai import Mistral

from app.models.discord_models import DiscussionSummary

logger = logging.getLogger("mistry.speech_summarizer")


class VoxtralSummarizer:
    """
    Summarizes mystery game discussions using Mistral's Voxtral Small model.
    Voxtral can directly process audio and generate structured summaries.
    """

    def __init__(self, api_key: Optional[str] = None, model: str = "voxtral-small-latest"):
        """
        Initialize the Voxtral summarizer.

        Args:
            api_key: Mistral API key (falls back to MISTRAL_API_KEY env var)
            model: Voxtral model to use (default: voxtral-small-latest)
        """
        self.api_key = api_key or os.getenv("MISTRAL_API_KEY")
        if not self.api_key:
            raise ValueError("MISTRAL_API_KEY not found. Set it in .env or pass api_key parameter.")

        self.client = Mistral(api_key=self.api_key)
        self.model = model

    def _encode_audio(self, audio_path: str) -> str:
        """Encode audio file to base64."""
        with open(audio_path, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")

    def _encode_audio_bytes(self, audio_bytes: bytes) -> str:
        """Encode audio bytes to base64."""
        return base64.b64encode(audio_bytes).decode("utf-8")

    def _get_audio_mime_type(self, audio_path: str) -> str:
        """Get MIME type based on file extension."""
        ext = Path(audio_path).suffix.lower()
        mime_types = {
            ".wav": "audio/wav",
            ".mp3": "audio/mpeg",
            ".flac": "audio/flac",
            ".ogg": "audio/ogg",
            ".m4a": "audio/mp4",
            ".webm": "audio/webm",
        }
        return mime_types.get(ext, "audio/wav")

    def _extract_json(self, text: str) -> dict:
        """Extract JSON from LLM response."""
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try markdown code block
        code_block = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if code_block:
            try:
                return json.loads(code_block.group(1).strip())
            except json.JSONDecodeError:
                pass

        # Try to find JSON object
        json_match = re.search(r"\{[\s\S]*\}", text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        raise ValueError(f"Could not extract JSON from response:\n{text[:500]}...")

    def _get_system_prompt(self) -> str:
        """Get the system prompt for summarization."""
        return """You are a transcription and note-taking assistant for mystery game discussions.

IMPORTANT: You MUST first TRANSCRIBE exactly what is spoken in the audio. Do NOT make up or imagine content.

Step 1: Listen carefully to the audio and transcribe what the speakers actually say.
Step 2: Based ONLY on what was actually said, extract structured notes.

If you cannot hear or understand the audio clearly, say so in the summary. Do NOT invent fictional content.

Based on the ACTUAL TRANSCRIPTION, extract:
1. A summary of what was ACTUALLY discussed (not fictional content)
2. Key points that were ACTUALLY mentioned
3. Any CLUES the speakers mentioned
4. Any SUSPECTS the speakers discussed
5. Any ITEMS the speakers talked about
6. Any LOCATIONS mentioned
7. Any THEORIES the speakers proposed
8. Action items they mentioned
9. Questions they raised

Return a JSON object with this exact structure:
{
  "transcript": "The exact words spoken in the audio (transcription)",
  "summary": "Brief summary of what was ACTUALLY discussed in the audio",
  "key_points": ["actual point 1", "actual point 2", ...],
  "clues": [
    {"name": "clue name mentioned", "description": "what they said about it", "significance": "high/medium/low/unknown"}
  ],
  "suspects": [
    {"name": "suspect name mentioned", "motive": "motive they discussed or null", "alibi": "alibi mentioned or null", "suspicion_level": "high/medium/low/unknown", "notes": "what they said"}
  ],
  "items": [
    {"name": "item mentioned", "relevance": "why they said it matters", "location_found": "where they said it was found or null"}
  ],
  "locations": [
    {"name": "location mentioned", "significance": "why they said it matters", "events": ["what they said happened"]}
  ],
  "theories": [
    {"theory": "theory they proposed", "supporting_evidence": ["evidence they mentioned"], "counter_evidence": ["counter points mentioned"], "proposed_by": null}
  ],
  "action_items": ["next step they mentioned"],
  "unresolved_questions": ["question they raised"]
}

If the audio is unclear or you can't understand it, return:
{
  "transcript": "Could not transcribe - audio unclear",
  "summary": "Could not clearly transcribe the audio",
  "key_points": [],
  "clues": [],
  "suspects": [],
  "items": [],
  "locations": [],
  "theories": [],
  "action_items": [],
  "unresolved_questions": ["Audio was unclear"]
}

Remember: ONLY include information that was ACTUALLY SPOKEN in the audio. Do NOT make up fictional mysteries.
Respond with ONLY the JSON object, no other text."""

    async def summarize_audio_file(self, audio_path: str) -> DiscussionSummary:
        """
        Summarize a discussion from an audio file.

        Args:
            audio_path: Path to the audio file (WAV, MP3, etc.)

        Returns:
            DiscussionSummary with structured notes
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        # Encode audio to base64
        audio_data = self._encode_audio(audio_path)
        mime_type = self._get_audio_mime_type(audio_path)

        # Create data URL for audio
        audio_data_url = f"data:{mime_type};base64,{audio_data}"

        # Create message with audio content
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "input_audio", "input_audio": audio_data_url},
                    {"type": "text", "text": self._get_system_prompt()},
                ],
            }
        ]

        logger.info(f"Sending audio to Voxtral (size: {len(audio_data)} bytes, mime: {mime_type})")
        response = self.client.chat.complete(model=self.model, messages=messages)
        content = response.choices[0].message.content
        logger.info(f"Voxtral raw response: {content[:500]}...")

        result = self._extract_json(content)
        return DiscussionSummary.model_validate(result)

    async def summarize_audio_bytes(
        self, audio_bytes: bytes, mime_type: str = "audio/wav"
    ) -> DiscussionSummary:
        """
        Summarize a discussion from audio bytes.

        Args:
            audio_bytes: Raw audio data
            mime_type: MIME type of the audio

        Returns:
            DiscussionSummary with structured notes
        """
        # Encode audio to base64
        audio_data = self._encode_audio_bytes(audio_bytes)

        # Create data URL for audio
        audio_data_url = f"data:{mime_type};base64,{audio_data}"

        # Create message with audio content
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "input_audio", "input_audio": audio_data_url},
                    {"type": "text", "text": self._get_system_prompt()},
                ],
            }
        ]

        logger.info(f"Sending audio bytes to Voxtral (size: {len(audio_bytes)} bytes, mime: {mime_type})")
        response = self.client.chat.complete(model=self.model, messages=messages)
        content = response.choices[0].message.content
        logger.info(f"Voxtral raw response: {content[:500]}...")

        result = self._extract_json(content)
        return DiscussionSummary.model_validate(result)

    async def summarize_audio_url(self, audio_url: str) -> DiscussionSummary:
        """
        Summarize a discussion from an audio URL.

        Args:
            audio_url: URL to the audio file

        Returns:
            DiscussionSummary with structured notes
        """
        # For URLs, use the URL directly
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "input_audio", "input_audio": audio_url},
                    {"type": "text", "text": self._get_system_prompt()},
                ],
            }
        ]

        response = self.client.chat.complete(model=self.model, messages=messages)
        content = response.choices[0].message.content

        result = self._extract_json(content)
        return DiscussionSummary.model_validate(result)


class SpeechSummarizer:
    """
    Complete pipeline for summarizing mystery game discussions from audio.
    Uses Voxtral Small to directly process audio and generate structured notes.

    Usage:
        summarizer = SpeechSummarizer()
        notes = await summarizer.process_audio_bytes(audio_bytes)
    """

    _instance: Optional["SpeechSummarizer"] = None

    def __init__(
        self,
        model: str = "voxtral-small-latest",
        api_key: Optional[str] = None,
    ):
        """
        Initialize the speech summarizer pipeline.

        Args:
            model: Voxtral model to use (default: voxtral-small-latest)
            api_key: Optional Mistral API key
        """
        self.voxtral = VoxtralSummarizer(api_key=api_key, model=model)
        SpeechSummarizer._instance = self

    @classmethod
    def get_instance(cls) -> Optional["SpeechSummarizer"]:
        """Get the singleton instance."""
        return cls._instance

    @classmethod
    def initialize(cls, api_key: Optional[str] = None) -> "SpeechSummarizer":
        """Initialize the singleton instance."""
        if cls._instance is None:
            cls._instance = cls(api_key=api_key)
        return cls._instance

    async def process_audio_file(self, audio_path: str) -> DiscussionSummary:
        """
        Process an audio file and generate structured notes.

        Args:
            audio_path: Path to audio file

        Returns:
            DiscussionSummary with structured notes
        """
        return await self.voxtral.summarize_audio_file(audio_path)

    async def process_audio_bytes(
        self, audio_bytes: bytes, mime_type: str = "audio/wav"
    ) -> DiscussionSummary:
        """
        Process audio bytes and generate structured notes.

        Args:
            audio_bytes: Raw audio data
            mime_type: MIME type of the audio

        Returns:
            DiscussionSummary with structured notes
        """
        # If it's plain text (from Discord text summary), process as text
        if mime_type == "text/plain":
            return await self.process_text_summary(audio_bytes.decode("utf-8"))
        return await self.voxtral.summarize_audio_bytes(audio_bytes, mime_type)

    async def process_text_summary(self, text: str) -> DiscussionSummary:
        """
        Process a text summary and structure it using Mistral.

        Args:
            text: Raw text summary from user

        Returns:
            DiscussionSummary with structured notes
        """
        from mistralai import Mistral

        client = Mistral(api_key=self.voxtral.api_key)

        prompt = f"""You are an expert note-taker for mystery game discussions.
Analyze this discussion summary and extract structured notes.

DISCUSSION SUMMARY:
{text}

Return a JSON object with this exact structure:
{{
  "summary": "Brief narrative summary of the discussion",
  "key_points": ["point 1", "point 2", ...],
  "clues": [
    {{"name": "clue name", "description": "what was discussed", "significance": "high/medium/low/unknown"}}
  ],
  "suspects": [
    {{"name": "name", "motive": "suspected motive or null", "alibi": "alibi or null", "suspicion_level": "high/medium/low/unknown", "notes": "observations"}}
  ],
  "items": [
    {{"name": "item name", "relevance": "why it matters", "location_found": "where found or null"}}
  ],
  "locations": [
    {{"name": "location", "significance": "why it matters", "events": ["what happened here"]}}
  ],
  "theories": [
    {{"theory": "the theory", "supporting_evidence": ["evidence for"], "counter_evidence": ["evidence against"], "proposed_by": null}}
  ],
  "action_items": ["next step 1", "next step 2"],
  "unresolved_questions": ["question 1", "question 2"]
}}

Be thorough - extract everything that could be relevant to solving the mystery.
If some categories have no relevant information, use empty arrays.
Respond with ONLY the JSON object, no other text."""

        response = client.chat.complete(
            model="mistral-small-latest",
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.choices[0].message.content

        result = self.voxtral._extract_json(content)
        return DiscussionSummary.model_validate(result)

    async def process_audio_url(self, audio_url: str) -> DiscussionSummary:
        """
        Process an audio URL and generate structured notes.

        Args:
            audio_url: URL to the audio file

        Returns:
            DiscussionSummary with structured notes
        """
        return await self.voxtral.summarize_audio_url(audio_url)

    async def save_temp_audio(self, audio_bytes: bytes, suffix: str = ".wav") -> str:
        """
        Save audio bytes to a temporary file.

        Args:
            audio_bytes: Raw audio data
            suffix: File extension

        Returns:
            Path to temporary file
        """
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as f:
            f.write(audio_bytes)
            return f.name


def get_speech_summarizer() -> SpeechSummarizer:
    """
    Get or create the speech summarizer instance.
    Raises if MISTRAL_API_KEY is not set.
    """
    instance = SpeechSummarizer.get_instance()
    if instance is None:
        api_key = os.getenv("MISTRAL_API_KEY")
        if not api_key:
            raise ValueError("MISTRAL_API_KEY not configured")
        instance = SpeechSummarizer.initialize(api_key=api_key)
    return instance
