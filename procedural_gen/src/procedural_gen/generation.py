"""End-to-end story generation using an LLM and a Jinja2 prompt."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Protocol

from jinja2 import Environment, FileSystemLoader


class LLMProtocol(Protocol):
    """Protocol for LLM clients used by the generator."""

    def complete(self, prompt: str, *, system: str | None = None) -> str: ...


# Directory containing .j2 prompt files (next to this module)
_PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
_DEFAULT_PROMPT_NAME = "whodunnit.j2"


def _get_env() -> Environment:
    """Jinja2 environment for prompt templates (no autoescape for plain text)."""
    return Environment(
        loader=FileSystemLoader(_PROMPTS_DIR),
        autoescape=False,
    )


def _render_prompt(template_name: str, **kwargs: object) -> str:
    """Render a prompt from a .j2 template with optional variables."""
    env = _get_env()
    template = env.get_template(template_name)
    return template.render(**kwargs)

def _extract_json(text: str) -> dict:
    """Parse JSON from LLM response, stripping optional markdown code fence."""
    raw = text.strip()
    # Strip ```json ... ``` or ``` ... ``` if present
    match = re.search(r"^```(?:json)?\s*\n?(.*?)\n?```\s*$", raw, re.DOTALL)
    if match:
        raw = match.group(1).strip()
    return json.loads(raw)


def generate_story(
    llm: LLMProtocol,
    *,
    prompt_template: str = _DEFAULT_PROMPT_NAME,
    system: str | None = None,
    **template_vars: object,
) -> dict:
    """Generate a whodunnit story using the given LLM and prompt template.

    Args:
        llm: Any object with a `complete(prompt: str, *, system: str | None = None) -> str` method
            (e.g. OpenAILLM from src.llm).
        prompt_template: Name of the .j2 file under procedural_gen/prompts/ (e.g. "whodunnit.j2").
        system: Optional system/developer instruction for the LLM.
        **template_vars: Variables to pass to the Jinja2 template (for future customization).

    Returns:
        A dict with keys: title, culprits, characters, locations, clues, items, text.
    """
    prompt = _render_prompt(prompt_template, **template_vars)
    raw = llm.complete(prompt, system=system)
    out = _extract_json(raw)
    # LLM prompt asks for "story"; we expose it as "text" in output.json
    required = ("title", "culprits", "characters", "locations", "clues", "items", "story")
    missing = [k for k in required if k not in out]
    if missing:
        raise ValueError(
            f"LLM response must be a JSON object with {required!r} keys; missing: {missing}"
        )
    story_text = out.get("text") or out["story"]
    return {
        "title": str(out["title"]),
        "culprits": [str(x) for x in out["culprits"]],
        "characters": [str(x) for x in out["characters"]],
        "locations": [str(x) for x in out["locations"]],
        "clues": [str(x) for x in out["clues"]],
        "items": [str(x) for x in out["items"]],
        "text": str(story_text),
    }
