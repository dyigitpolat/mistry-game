"""
Epiphany Engine Agent — Evaluates the Red String Board / deduction connections.

Grants "Knowledge" tokens when the player makes valid logical connections
between clues and evidence.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

from jinja2 import Template
from deepagents import create_deep_agent
from pydantic import BaseModel, Field

from mistry_agents.llm_registry import LLMRegistry
from mistry_agents.prompts import EPIPHANY_SYSTEM_PROMPT


# ─── Response Schema ─────────────────────────────────────────────────

class EpiphanyResponse(BaseModel):
    """Structured response from the Epiphany Engine."""
    is_valid_connection: bool = Field(..., description="Whether the proposed connection is logically valid.")
    epiphany: Optional[str] = Field(None, description="The insight granted if valid.")
    reasoning: str = Field("", description="Brief explanation of the evaluation.")
    narrative: str = Field("", description="Atmospheric description of the moment.")


# ─── Epiphany Engine ─────────────────────────────────────────────────

class EpiphanyEngine:
    """
    Evaluates player deductions on the Red String Board.

    When the player connects clues/items in a logically valid way,
    grants Epiphany tokens (knowledge) that can be used to unlock
    conditional behaviors on characters.
    """

    def __init__(self, registry: LLMRegistry):
        self.registry = registry
        self.model = registry.get_agent_model("epiphany_engine")

    def _build_system_prompt(
        self,
        scenario: Dict[str, Any],
        player_state: Dict[str, Any],
    ) -> str:
        """Render the Epiphany Engine system prompt."""
        template = Template(EPIPHANY_SYSTEM_PROMPT)
        return template.render(
            scenario_title=scenario.get("title", "Unknown"),
            player_inventory=player_state.get("inventory", []),
            player_clues=player_state.get("clues", []),
            player_epiphanies=player_state.get("epiphanies", []),
            win_conditions=scenario.get("win_conditions", {}),
            characters=scenario.get("characters", {}),
        )

    def create_agent(
        self,
        scenario: Dict[str, Any],
        player_state: Dict[str, Any],
    ):
        """Create an Epiphany Engine agent instance."""
        system_prompt = self._build_system_prompt(scenario, player_state)

        return create_deep_agent(
            model=self.model,
            system_prompt=system_prompt,
        )

    async def evaluate_connection(
        self,
        scenario: Dict[str, Any],
        player_state: Dict[str, Any],
        connected_items: List[str],
        player_reasoning: str = "",
    ) -> EpiphanyResponse:
        """
        Evaluate a proposed connection between clues/items on the deduction board.

        Args:
            scenario: Full scenario data
            player_state: Current player state dict
            connected_items: List of clue/item names the player is connecting
            player_reasoning: Optional player explanation of the connection

        Returns:
            EpiphanyResponse with validity, granted epiphany, and narrative
        """
        agent = self.create_agent(scenario, player_state)

        items_str = ", ".join(f'"{item}"' for item in connected_items)
        message = f"The player is connecting these clues/items: [{items_str}]"
        if player_reasoning:
            message += f"\n\nPlayer's reasoning: {player_reasoning}"
        message += "\n\nEvaluate this connection against the ground truth."

        result = agent.invoke({
            "messages": [{"role": "user", "content": message}],
        })

        response_text = result["messages"][-1].content.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        elif response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        try:
            parsed = json.loads(response_text, strict=False)
            return EpiphanyResponse.model_validate(parsed)
        except (json.JSONDecodeError, Exception):
            # Try to extract JSON from mixed text
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                try:
                    parsed = json.loads(json_match.group(), strict=False)
                    return EpiphanyResponse.model_validate(parsed)
                except Exception:
                    pass

            return EpiphanyResponse(
                is_valid_connection=False,
                reasoning="Could not parse agent response.",
                narrative=response_text,
            )
