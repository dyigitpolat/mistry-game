"""
Character Agent — Per-NPC agent with the Contradiction Engine.

Each character gets their own deepagent instance with persona, secrets,
and conditional behavior triggers.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from jinja2 import Template
from deepagents import create_deep_agent
from pydantic import BaseModel, Field

from mistry_agents.llm_registry import LLMRegistry
from mistry_agents.prompts import CHARACTER_SYSTEM_PROMPT


# ─── Response Schema ─────────────────────────────────────────────────

class CharacterResponse(BaseModel):
    """Structured response from a Character Agent."""
    dialogue: str = Field(..., description="In-character spoken response.")
    action_narrative: Optional[str] = Field(None, alias="actionNarrative", description="Optional physical action description in third person.")
    suspicion_change: int = Field(0, description="Change to suspicion meter (+/- value).")
    is_broken: bool = Field(False, description="True if alibi has been shattered.")
    revealed_clues: List[str] = Field(default_factory=list, description="New clues revealed by this interaction.")


# ─── Character Agent ─────────────────────────────────────────────────

class CharacterAgent:
    """
    Per-NPC Character Agent.

    Handles:
    - Dialogue generation based on persona
    - Behavior Dependency Graph evaluation (no tools)
    - Suspicion meter management
    - Alibi breaking / confession triggers
    """

    def __init__(self, registry: LLMRegistry):
        self.registry = registry
        self.model = registry.get_agent_model("character_agent")

    def _build_system_prompt(
        self,
        character: Dict[str, Any],
        scenario_title: str,
        player_state: Dict[str, Any],
        conversation_history: List[Dict[str, str]] = None,
    ) -> str:
        """Render the character system prompt with persona and state context."""
        template = Template(CHARACTER_SYSTEM_PROMPT)
        
        # Filter conditional behaviors by current phase
        current_phase = player_state.get("current_phase", 0)
        active_behaviors = [
            b for b in character.get("conditional_behaviors", [])
            if current_phase in b.get("applicable_phases", [])
        ]
        
        return template.render(
            scenario_title=scenario_title,
            character_name=character.get("name", "Unknown"),
            character_role=character.get("role", ""),
            character_location=character.get("location", ""),
            character_type=character.get("type", "suspect"),
            character_persona=character.get("persona", ""),
            character_secret=character.get("secret", ""),
            character_abilities=character.get("abilities", ""),
            is_broken=character.get("is_broken", False),
            knowledge_about_others_json=json.dumps(character.get("knowledge_about_others", {})),
            conditional_behaviors_json=json.dumps(active_behaviors, indent=2),
            player_inventory=player_state.get("inventory", []),
            player_clues=player_state.get("clues", []),
            player_epiphanies=player_state.get("epiphanies", []),
            suspicion_meter=character.get("suspicion_meter", 0),
            conversation_history=conversation_history or [],
        )

    def create_agent(
        self,
        character: Dict[str, Any],
        scenario_title: str,
        player_state: Dict[str, Any],
        conversation_history: List[Dict[str, str]] = None,
    ):
        """Create a fresh Character Agent instance for a specific NPC."""
        system_prompt = self._build_system_prompt(
            character, scenario_title, player_state, conversation_history
        )

        return create_deep_agent(
            model=self.model,
            system_prompt=system_prompt,
        )

    def _parse_response(self, response_text: str) -> CharacterResponse:
        """Parse the agent response, handling both clean JSON and mixed text."""
        response_text = response_text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        try:
            parsed = json.loads(response_text, strict=False)
            return CharacterResponse.model_validate(parsed)
        except (json.JSONDecodeError, Exception):
            pass

        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            try:
                parsed = json.loads(json_match.group(), strict=False)
                return CharacterResponse.model_validate(parsed)
            except Exception:
                pass

        return CharacterResponse(
            dialogue=response_text,
            suspicion_change=0,
            is_broken=False,
        )

    async def talk(
        self,
        character: Dict[str, Any],
        char_name: str,
        scenario_title: str,
        player_state: Dict[str, Any],
        message: str,
        conversation_history: List[Dict[str, str]] = None,
    ) -> CharacterResponse:
        """Handle a conversation turn with this character."""
        char_with_name = {**character, "name": char_name}
        agent = self.create_agent(
            char_with_name, scenario_title, player_state, conversation_history
        )

        result = agent.invoke({
            "messages": [{"role": "user", "content": message}],
        })

        response_text = result["messages"][-1].content
        return self._parse_response(response_text)

    async def present_evidence(
        self,
        character: Dict[str, Any],
        char_name: str,
        scenario_title: str,
        player_state: Dict[str, Any],
        evidence: List[str],
        conversation_history: List[Dict[str, str]] = None,
    ) -> CharacterResponse:
        """Present evidence to a character and trigger the behavior graph."""
        char_with_name = {**character, "name": char_name}
        agent = self.create_agent(
            char_with_name, scenario_title, player_state, conversation_history
        )

        evidence_str = ", ".join(evidence)
        message = (
            f"Presenting Evidence/Fact: [{evidence_str}]\n\n"
            f"Evaluate your behavior dependency graph based on this input and my current knowledge."
        )

        result = agent.invoke({
            "messages": [{"role": "user", "content": message}],
        })

        response_text = result["messages"][-1].content
        return self._parse_response(response_text)
