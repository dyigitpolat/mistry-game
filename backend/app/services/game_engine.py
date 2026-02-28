"""
Game Engine — orchestrates agent calls, state transitions, and phase checks.

All game logic is driven by LLM agents (deepagents SDK) with Langfuse telemetry.
No rule-based fallbacks — every action goes through the Oracle or Character agents.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Optional

import yaml
from dotenv import load_dotenv

from app.models.scenario import Scenario
from app.models.game_state import (
    AccuseRequest,
    AccusationResult,
    ActionRequest,
    ActionResponse,
    GameSession,
    PhaseInfo,
    PlayerState,
)

# Load env for agent initialization
load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")

# ── Langfuse Setup ───────────────────────────────────────────────────
_langfuse_handler = None


def _get_langfuse_handler():
    """Lazy-init Langfuse callback handler for tracing."""
    global _langfuse_handler
    if _langfuse_handler is None:
        try:
            from langfuse.callback import CallbackHandler
            _langfuse_handler = CallbackHandler(
                secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
                public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
                host=os.getenv("LANGFUSE_BASE_URL", "https://cloud.langfuse.com"),
            )
        except Exception as e:
            print(f"⚠️ Langfuse init failed (tracing disabled): {e}")
    return _langfuse_handler


# ── Agent Imports ────────────────────────────────────────────────────
from mistry_agents import LLMRegistry, GamemakerOracle, CharacterAgent, EpiphanyEngine, SceneGenerator


class GameEngine:
    """
    Core game engine. All game logic is driven by GPT-5-mini via deepagents.
    
    Responsibilities:
    - Route natural language input to Oracle/Character/Epiphany agents
    - Track phase progression and auto-advance when objectives are met
    - Handle final accusations against win conditions
    - Maintain conversation history per character
    """

    def __init__(self):
        self.scenarios: Dict[str, Scenario] = {}
        self._load_builtin_scenarios()

        # Initialize agents
        self._oracle: Optional[GamemakerOracle] = None
        self._character_agent: Optional[CharacterAgent] = None
        self._epiphany_engine: Optional[EpiphanyEngine] = None
        self._scene_generator: Optional[SceneGenerator] = None

        self._init_agents()

    def _init_agents(self):
        """Initialize all agent instances from config.yaml."""
        config_path = Path(__file__).parent.parent.parent.parent / "config.yaml"
        if not config_path.exists():
            config_path = Path(__file__).parent.parent / "config.yaml"

        registry = LLMRegistry(str(config_path) if config_path.exists() else None)

        self._oracle = GamemakerOracle(registry)
        self._character_agent = CharacterAgent(registry)
        self._epiphany_engine = EpiphanyEngine(registry)

        # Scene generator (Google Nanobanana) — only if GEMINI_API_KEY is set
        if os.getenv("GEMINI_API_KEY"):
            try:
                self._scene_generator = SceneGenerator()
            except Exception as e:
                print(f"⚠️ Scene generator init failed: {e}")

        print(f"🔮 Agents initialized: Oracle={self._oracle is not None}, "
              f"Character={self._character_agent is not None}, "
              f"Epiphany={self._epiphany_engine is not None}, "
              f"SceneGen={self._scene_generator is not None}")

    def _load_builtin_scenarios(self):
        """Load scenarios from the data/ directory."""
        data_dir = Path(__file__).parent.parent.parent / "data"
        if not data_dir.exists():
            return

        for fpath in data_dir.glob("*.json"):
            try:
                raw = json.loads(fpath.read_text())
                scenario = Scenario.model_validate(raw)
                self.scenarios[fpath.stem] = scenario
            except Exception as e:
                print(f"⚠️  Failed to load scenario {fpath.name}: {e}")

    def load_scenario(self, scenario_id: str) -> Optional[Scenario]:
        """Get a scenario by ID."""
        return self.scenarios.get(scenario_id)

    def _scenario_to_dict(self, scenario: Scenario) -> dict:
        """Convert Pydantic Scenario to dict for agent consumption."""
        return json.loads(scenario.model_dump_json())

    def _player_state_to_dict(self, player: PlayerState) -> dict:
        """Convert PlayerState to dict for agent consumption."""
        return json.loads(player.model_dump_json())

    def _get_current_phase(self, scenario: Scenario, player: PlayerState) -> Optional[dict]:
        """Get the current phase dict."""
        if player.current_phase < len(scenario.phases):
            phase = scenario.phases[player.current_phase]
            return {
                "id": phase.id,
                "name": phase.name,
                "objective": phase.objective,
                "unlocked_locations": phase.unlocked_locations,
                "unlocked_characters": phase.unlocked_characters,
            }
        return None

    def _get_phase_info(self, scenario: Scenario, phase_idx: int) -> Optional[PhaseInfo]:
        """Build a PhaseInfo from a phase index."""
        if phase_idx < len(scenario.phases):
            phase = scenario.phases[phase_idx]
            return PhaseInfo(
                id=phase.id,
                name=phase.name,
                objective=phase.objective,
                unlocked_locations=phase.unlocked_locations,
                unlocked_characters=phase.unlocked_characters,
            )
        return None

    def _get_characters_at_location(
        self, scenario: Scenario, player: PlayerState
    ) -> List[str]:
        """Get characters available at current location in current phase."""
        current_phase = (
            scenario.phases[player.current_phase]
            if player.current_phase < len(scenario.phases)
            else None
        )
        if not current_phase:
            return []

        chars_in_room = []
        for name in current_phase.unlocked_characters:
            char = scenario.characters.get(name)
            if char:
                # Check if character is at player's location in this phase
                phase_loc = char.phase_locations.get(player.current_phase, char.location)
                if phase_loc == player.current_location:
                    chars_in_room.append(name)
        return chars_in_room

    async def process_action(
        self,
        session: GameSession,
        scenario: Scenario,
        action: ActionRequest,
    ) -> ActionResponse:
        """
        Main action dispatcher. All actions routed to LLM agents.
        """
        if action.action_type == "talk":
            response = await self._agent_talk(session, scenario, action)
        elif action.action_type == "present_evidence":
            response = await self._agent_present_evidence(session, scenario, action)
        elif action.action_type == "connect_clues":
            response = await self._agent_connect_clues(session, scenario, action)
        else:
            # All other actions go to the Oracle (free-form NL routing)
            response = await self._agent_oracle_action(session, scenario, action)
            
        # Global phase check
        if not response.phase_advanced:
            if await self._check_phase_advancement(session, scenario):
                response.phase_advanced = True
                new_phase = session.player_state.current_phase + 1
                session.player_state.current_phase = new_phase
                if response.state_updates:
                    response.state_updates.current_phase = new_phase
                else:
                    response.state_updates = session.player_state.model_copy()
                response.new_phase = new_phase
                response.phase_info = self._get_phase_info(scenario, new_phase)
                response.characters_in_room = self._get_characters_at_location(scenario, session.player_state)
                
        return response

    async def process_accusation(
        self,
        session: GameSession,
        scenario: Scenario,
        accusation: AccuseRequest,
    ) -> ActionResponse:
        """
        Handle the final accusation. Check against win_conditions.
        Uses fuzzy matching via the Oracle agent for flexible input.
        """
        wc = scenario.win_conditions
        
        # Use Oracle to evaluate the accusation with flexible matching
        scenario_dict = self._scenario_to_dict(scenario)
        player_dict = self._player_state_to_dict(session.player_state)

        try:
            # Build a prompt for the Oracle to evaluate the accusation
            suspects_str = ", ".join(wc.required_suspect)
            evidence_str = ", ".join(wc.required_evidence)
            motive_str = ", ".join(wc.required_motive)
            
            eval_message = (
                f"The player is making their FINAL ACCUSATION:\n"
                f"- Suspect: {accusation.suspect}\n"
                f"- Weapon/Evidence: {accusation.weapon}\n"
                f"- Motive: {accusation.motive}\n\n"
                f"The ground truth is:\n"
                f"- True Suspect(s): {suspects_str}\n"
                f"- True Evidence: {evidence_str}\n"
                f"- True Motive(s): {motive_str}\n\n"
                f"Evaluate whether each of the player's answers is correct or semantically equivalent "
                f"to the ground truth. Respond with a JSON object:\n"
                f'{{"suspect_correct": true/false, "weapon_correct": true/false, "motive_correct": true/false, '
                f'"narrative": "A dramatic closing narration based on whether they solved it or not"}}'
            )

            agent = self._oracle.create_agent(scenario_dict, player_dict)
            result = agent.invoke({
                "messages": [{"role": "user", "content": eval_message}],
            })
            response_text = result["messages"][-1].content

            try:
                parsed = json.loads(response_text)
                all_correct = (
                    parsed.get("suspect_correct", False)
                    and parsed.get("weapon_correct", False)
                    and parsed.get("motive_correct", False)
                )
                narrative = parsed.get("narrative", "")
            except (json.JSONDecodeError, Exception):
                # Fallback: do exact substring matching
                suspect_ok = any(s.lower() in accusation.suspect.lower() for s in wc.required_suspect) or (accusation.suspect.lower() in suspects_str.lower())
                weapon_ok = any(e.lower() in accusation.weapon.lower() for e in wc.required_evidence) or (accusation.weapon.lower() in evidence_str.lower())
                motive_ok = any(m.lower() in accusation.motive.lower() for m in wc.required_motive) or (accusation.motive.lower() in motive_str.lower())
                all_correct = suspect_ok and weapon_ok and motive_ok
                narrative = response_text

        except Exception as e:
            # Direct string matching as ultimate fallback
            suspects_str = ", ".join(wc.required_suspect)
            evidence_str = ", ".join(wc.required_evidence)
            motive_str = ", ".join(wc.required_motive)
            suspect_ok = any(s.lower() in accusation.suspect.lower() for s in wc.required_suspect) or (accusation.suspect.lower() in suspects_str.lower())
            weapon_ok = any(e.lower() in accusation.weapon.lower() for e in wc.required_evidence) or (accusation.weapon.lower() in evidence_str.lower())
            motive_ok = any(m.lower() in accusation.motive.lower() for m in wc.required_motive) or (accusation.motive.lower() in motive_str.lower())
            all_correct = suspect_ok and weapon_ok and motive_ok
            narrative = (
                "Case solved! You've uncovered the truth." if all_correct
                else "Your accusation doesn't match the evidence. The case remains unsolved."
            )

        if all_correct:
            session.is_complete = True
            session.outcome = "solved"
        
        accusation_result = AccusationResult(
            correct=all_correct,
            narrative=narrative,
            correct_suspect=suspects_str if not all_correct else None,
            correct_weapon=evidence_str if not all_correct else None,
            correct_motive=motive_str if not all_correct else None,
        )

        return ActionResponse(
            narrative=narrative,
            accusation_result=accusation_result,
            characters_in_room=self._get_characters_at_location(scenario, session.player_state),
        )

    async def _check_phase_advancement(self, session: GameSession, scenario: Scenario) -> bool:
        """Silently check if the current phase objective is satisfied."""
        current_phase_idx = session.player_state.current_phase
        if current_phase_idx >= len(scenario.phases) - 1:
            return False
            
        phase = scenario.phases[current_phase_idx]
        
        # Gather recent conversations to help check conversational objectives
        recent_conversations = {}
        for char_name, state in session.character_states.items():
            if state.conversation_history:
                # Include the last 4 messages (2 exchanges)
                recent_conversations[char_name] = state.conversation_history[-4:]

        prompt = f"""Evaluate if the player's current state satisfies this phase objective: '{phase.objective}'
        
        Player's Location: {session.player_state.current_location}
        Player's Inventory: {session.player_state.inventory}
        Player's Clues: {session.player_state.clues}
        Player's Epiphanies: {session.player_state.epiphanies}
        Recent Conversations: {json.dumps(recent_conversations, indent=2)}
        
        Respond ONLY in JSON format: {{"objective_met": true/false}}
        """
        messages = [
            {"role": "system", "content": "You are the game logic evaluator. You MUST respond ONLY with a JSON object containing a single key 'objective_met' with a boolean value."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            result = self._oracle.model.invoke(messages)
            text = result.content
            import re
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                parsed = json.loads(json_match.group())
                return parsed.get("objective_met", False)
            return False
        except Exception:
            return False

    # ═══ AGENT HANDLERS ═══════════════════════════════════════════════

    async def _agent_oracle_action(
        self,
        session: GameSession,
        scenario: Scenario,
        action: ActionRequest,
    ) -> ActionResponse:
        """Process any world action through the Gamemaker Oracle agent."""
        scenario_dict = self._scenario_to_dict(scenario)
        player_dict = self._player_state_to_dict(session.player_state)

        try:
            result = await self._oracle.process_action(
                scenario=scenario_dict,
                player_state=player_dict,
                action_type=action.action_type,
                target=action.target,
                message=action.message,
            )

            # Track what changed
            old_clues = set(session.player_state.clues)
            old_items = set(session.player_state.inventory)
            old_location = session.player_state.current_location

            # Build state updates from oracle response
            state_updates = session.player_state.model_copy()
            if result.new_location:
                state_updates.current_location = result.new_location
            
            for clue in result.found_clues:
                if clue not in state_updates.clues:
                    state_updates.clues.append(clue)
                    
            for item in result.picked_up_items:
                if item not in state_updates.inventory:
                    state_updates.inventory.append(item)
                    
            state_updates.elapsed_minutes += result.time_cost_minutes

            # Detect new clues and items
            new_clues = [c for c in state_updates.clues if c not in old_clues]
            new_items = [i for i in state_updates.inventory if i not in old_items]
            new_location = state_updates.current_location if state_updates.current_location != old_location else None

            # Check phase advancement
            phase_advanced = result.advance_phase
            new_phase = None
            phase_info = None

            if phase_advanced and state_updates.current_phase + 1 < len(scenario.phases):
                new_phase = state_updates.current_phase + 1
                state_updates.current_phase = new_phase
                phase_info = self._get_phase_info(scenario, new_phase)

            # Get characters at current location
            chars_in_room = self._get_characters_at_location(scenario, state_updates)

            return ActionResponse(
                narrative=result.narrative,
                state_updates=state_updates,
                phase_advanced=phase_advanced,
                new_phase=new_phase,
                phase_info=phase_info,
                new_clues=new_clues,
                new_items=new_items,
                new_location=new_location,
                visual_metadata_diff=result.updated_visual_metadata,
                characters_in_room=chars_in_room,
            )

        except Exception as e:
            print(f"❌ Oracle agent error: {e}")
            return ActionResponse(
                narrative=f"The Oracle is momentarily confused... (Error: {e})",
                error=str(e),
                characters_in_room=self._get_characters_at_location(scenario, session.player_state),
            )

    async def _agent_talk(
        self,
        session: GameSession,
        scenario: Scenario,
        action: ActionRequest,
    ) -> ActionResponse:
        """Talk to a character via the Character Agent."""
        char_name = action.target
        if char_name not in scenario.characters:
            return ActionResponse(
                narrative=f"There's nobody called '{char_name}' here.",
                characters_in_room=self._get_characters_at_location(scenario, session.player_state),
            )

        scenario_dict = self._scenario_to_dict(scenario)
        player_dict = self._player_state_to_dict(session.player_state)
        character_dict = scenario_dict["characters"][char_name]

        # Include conversation history for continuity
        char_state = session.character_states.get(char_name)
        conversation_history = char_state.conversation_history if char_state else []

        try:
            result = await self._character_agent.talk(
                character=character_dict,
                char_name=char_name,
                scenario_title=scenario.title,
                player_state=player_dict,
                message=action.message,
                conversation_history=conversation_history,
            )

            # Update suspicion meter
            if char_state and result.suspicion_change:
                char_state.suspicion_meter = max(
                    0, min(100, char_state.suspicion_meter + result.suspicion_change)
                )

            # Update conversation history
            if char_state:
                char_state.conversation_history.append(
                    {"role": "user", "content": action.message}
                )
                char_state.conversation_history.append(
                    {"role": "assistant", "content": result.dialogue}
                )

            # Track if broken
            if char_state and result.is_broken:
                char_state.is_broken = True

            # Add revealed clues to player state
            old_clues = set(session.player_state.clues)
            state_updates = None
            new_clues = []
            if result.revealed_clues:
                new_clues = [c for c in result.revealed_clues if c not in old_clues]
                if new_clues:
                    updated_clues = session.player_state.clues + new_clues
                    state_updates = session.player_state.model_copy(
                        update={"clues": updated_clues}
                    )

            narrative_text = f"*{result.action_narrative}*\n\n**{char_name}**: {result.dialogue}" if getattr(result, "action_narrative", None) else f"**{char_name}**: {result.dialogue}"
            
            return ActionResponse(
                narrative=narrative_text,
                state_updates=state_updates,
                character_state_updates={char_name: char_state} if char_state else {},
                phase_advanced=False,
                new_clues=new_clues,
                characters_in_room=self._get_characters_at_location(scenario, session.player_state),
            )

        except Exception as e:
            print(f"❌ Character agent error: {e}")
            return ActionResponse(
                narrative=f"**{char_name}** stares at you blankly... (Error: {e})",
                error=str(e),
                characters_in_room=self._get_characters_at_location(scenario, session.player_state),
            )

    async def _agent_present_evidence(
        self,
        session: GameSession,
        scenario: Scenario,
        action: ActionRequest,
    ) -> ActionResponse:
        """Present evidence to a character via the Contradiction Engine."""
        char_name = action.target
        if char_name not in scenario.characters:
            return ActionResponse(
                narrative=f"There's nobody called '{char_name}' here.",
                characters_in_room=self._get_characters_at_location(scenario, session.player_state),
            )

        scenario_dict = self._scenario_to_dict(scenario)
        player_dict = self._player_state_to_dict(session.player_state)
        character_dict = scenario_dict["characters"][char_name]

        # Include conversation history
        char_state = session.character_states.get(char_name)
        conversation_history = char_state.conversation_history if char_state else []

        try:
            result = await self._character_agent.present_evidence(
                character=character_dict,
                char_name=char_name,
                scenario_title=scenario.title,
                player_state=player_dict,
                evidence=action.evidence,
                conversation_history=conversation_history,
            )

            # Update suspicion and broken state
            if char_state:
                char_state.suspicion_meter = max(
                    0, min(100, char_state.suspicion_meter + result.suspicion_change)
                )
                if result.is_broken:
                    char_state.is_broken = True

                # Update conversation history
                evidence_str = ", ".join(action.evidence)
                char_state.conversation_history.append(
                    {"role": "user", "content": f"[Present Evidence: {evidence_str}]"}
                )
                char_state.conversation_history.append(
                    {"role": "assistant", "content": result.dialogue}
                )

            old_clues = set(session.player_state.clues)
            state_updates = None
            new_clues = []
            if result.revealed_clues:
                new_clues = [c for c in result.revealed_clues if c not in old_clues]
                if new_clues:
                    state_updates = session.player_state.model_copy(
                        update={"clues": session.player_state.clues + new_clues}
                    )

            narrative_text = f"*{result.action_narrative}*\n\n**{char_name}**: {result.dialogue}" if getattr(result, "action_narrative", None) else f"**{char_name}**: {result.dialogue}"
            
            return ActionResponse(
                narrative=narrative_text,
                state_updates=state_updates,
                character_state_updates={char_name: char_state} if char_state else {},
                character_reaction=result.dialogue,
                new_clues=new_clues,
                characters_in_room=self._get_characters_at_location(scenario, session.player_state),
            )

        except Exception as e:
            print(f"❌ Evidence presentation error: {e}")
            return ActionResponse(
                narrative=f"**{char_name}** refuses to engage with the evidence... (Error: {e})",
                error=str(e),
                characters_in_room=self._get_characters_at_location(scenario, session.player_state),
            )

    async def _agent_connect_clues(
        self,
        session: GameSession,
        scenario: Scenario,
        action: ActionRequest,
    ) -> ActionResponse:
        """Connect clues on the Red String Board via the Epiphany Engine."""
        if self._epiphany_engine is None:
            return ActionResponse(
                narrative="Epiphany Engine not available.",
                error="Epiphany engine not initialized",
                characters_in_room=self._get_characters_at_location(scenario, session.player_state),
            )

        scenario_dict = self._scenario_to_dict(scenario)
        player_dict = self._player_state_to_dict(session.player_state)

        try:
            result = await self._epiphany_engine.evaluate_connection(
                scenario=scenario_dict,
                player_state=player_dict,
                connected_items=action.evidence,
                player_reasoning=action.message,
            )

            state_updates = None
            new_clues = []
            if result.is_valid_connection and result.epiphany:
                if result.epiphany not in session.player_state.epiphanies:
                    updated_epiphanies = session.player_state.epiphanies + [result.epiphany]
                    state_updates = session.player_state.model_copy(
                        update={"epiphanies": updated_epiphanies}
                    )
                    new_clues = [result.epiphany]

            return ActionResponse(
                narrative=result.narrative,
                state_updates=state_updates,
                new_clues=new_clues,
                characters_in_room=self._get_characters_at_location(scenario, session.player_state),
            )

        except Exception as e:
            print(f"❌ Epiphany engine error: {e}")
            return ActionResponse(
                narrative=f"The connections elude you... (Error: {e})",
                error=str(e),
                characters_in_room=self._get_characters_at_location(scenario, session.player_state),
            )
