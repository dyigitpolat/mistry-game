"""
Gamemaker Oracle Agent — Phase progression, world action evaluation, visual metadata mutation.

Uses deepagents create_deep_agent with custom tools.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from jinja2 import Template
from deepagents import create_deep_agent
from pydantic import BaseModel, Field

from mistry_agents.llm_registry import LLMRegistry
from mistry_agents.prompts import ORACLE_SYSTEM_PROMPT


# ─── Tool Schemas ────────────────────────────────────────────────────

class OracleResponse(BaseModel):
    """Structured response from the Oracle agent."""
    narrative: str = Field(..., description="Descriptive narrative text for the player.")
    new_location: Optional[str] = Field(None, description="Location the player moved to, or null.")
    found_clues: List[str] = Field(default_factory=list, description="New clues discovered.")
    picked_up_items: List[str] = Field(default_factory=list, description="New items taken.")
    items_remaining_in_room: List[str] = Field(default_factory=list, description="Leftover items.")
    time_cost_minutes: float = Field(5.0, description="In-game time cost of this action.")
    updated_visual_metadata: Optional[Dict[str, Any]] = Field(None, description="Updated room objects/connections state.")
    advance_phase: bool = Field(False, description="Whether to advance to the next phase.")


# ─── Oracle Agent ────────────────────────────────────────────────────

class GamemakerOracle:
    """
    The Gamemaker Oracle — omniscient game master agent.

    Responsibilities:
    - Evaluate world actions (move, search, examine, take)
    - Check phase completion conditions
    - Mutate visual metadata after item interactions
    - Control narrative pacing
    """

    def __init__(self, registry: LLMRegistry):
        self.registry = registry
        self.model = registry.get_agent_model("gamemaker_oracle")

    def _build_system_prompt(
        self,
        scenario: Dict[str, Any],
        player_state: Dict[str, Any],
    ) -> str:
        """Render the Oracle system prompt with scenario and state context."""
        template = Template(ORACLE_SYSTEM_PROMPT)

        phases = scenario.get("phases", [])
        current_phase_id = player_state.get("current_phase", 0)
        current_phase = phases[current_phase_id] if current_phase_id < len(phases) else {}

        current_loc_name = player_state.get("current_location", "")
        locations = scenario.get("locations", {})
        current_location_data = locations.get(current_loc_name, {})

        # Build room data from the new schema
        # - setting: atmospheric description of the room
        # - objects: list of GameObjects (surfaces, containers, items)
        # - connections: list of Connection objects with location_id and state
        room_setting = current_location_data.get("setting", "")
        room_objects = current_location_data.get("objects", [])
        room_connections = current_location_data.get("connections", [])

        return template.render(
            scenario_title=scenario.get("title", "Unknown"),
            current_phase_name=current_phase.get("name", "Unknown"),
            current_phase_id=current_phase_id,
            current_phase_objective=current_phase.get("objective", ""),
            player_location=current_loc_name,
            player_epiphanies=player_state.get("epiphanies", []),
            elapsed_minutes=player_state.get("elapsed_minutes", 0),
            time_limit=scenario.get("time_limit_minutes", 180),
            unlocked_locations=current_phase.get("unlocked_locations", []),
            current_room_setting=room_setting,
            current_room_objects=json.dumps(room_objects, indent=2),
            current_room_connections=json.dumps(room_connections, indent=2),
        )

    def create_agent(
        self,
        scenario: Dict[str, Any],
        player_state: Dict[str, Any],
    ):
        """Create a fresh Oracle agent instance with current context."""
        system_prompt = self._build_system_prompt(scenario, player_state)

        return create_deep_agent(
            model=self.model,
            system_prompt=system_prompt,
        )

    async def process_action(
        self,
        scenario: Dict[str, Any],
        player_state: Dict[str, Any],
        action_type: str,
        target: str,
        message: str = "",
    ) -> OracleResponse:
        """Process a player action through the Oracle agent."""
        agent = self.create_agent(scenario, player_state)

        # Build natural language message for the agent
        user_message = message if message else f"The player wants to '{action_type}' targeting '{target}'."
        user_message += f"\n\nPlayer's Current Inventory: {player_state.get('inventory', [])}"
        user_message += f"\nPlayer's Current Clues: {player_state.get('clues', [])}"

        result = agent.invoke({
            "messages": [{"role": "user", "content": user_message}],
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
            return OracleResponse.model_validate(parsed)
        except (json.JSONDecodeError, Exception):
            import re
            json_match = re.search(r'\{[\s\S]*\}', response_text)
            if json_match:
                try:
                    parsed = json.loads(json_match.group(), strict=False)
                    return OracleResponse.model_validate(parsed)
                except Exception:
                    pass
            
            return OracleResponse(
                narrative=response_text,
                advance_phase=False,
                time_cost_minutes=5.0,
            )
