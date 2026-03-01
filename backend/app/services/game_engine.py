"""
Game Engine — orchestrates agent calls, state transitions, and phase checks.

All game logic is driven by LLM agents (deepagents SDK) with Langfuse telemetry.
No rule-based fallbacks — every action goes through the Oracle or Character agents.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
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

    _shared_instance: Optional["GameEngine"] = None

    def __init__(self):
        self.scenarios: Dict[str, Scenario] = {}
        # Mapping: scenario_id -> {original_name: display_name}
        self._display_names: Dict[str, Dict[str, str]] = {}
        self._load_builtin_scenarios()

        # Initialize agents
        self._oracle: Optional[GamemakerOracle] = None
        self._character_agent: Optional[CharacterAgent] = None
        self._epiphany_engine: Optional[EpiphanyEngine] = None
        self._scene_generator: Optional[SceneGenerator] = None

        self._init_agents()

        GameEngine._shared_instance = self

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
                self._normalize_scenario_payload(raw)
                scenario = Scenario.model_validate(raw)
                self.scenarios[fpath.stem] = scenario
            except Exception as e:
                print(f"⚠️  Failed to load scenario {fpath.name}: {e}")

    @staticmethod
    def _normalize_scenario_payload(raw: dict) -> None:
        """Transform legacy JSON payloads into the current Pydantic schema format.

        Handles two legacy patterns:
        1. Flat ``locations`` at the top level (wraps into ``game_world``).
        2. Per-location ``visual_metadata`` / ``items`` / ``base_ascii`` fields
           that need to be unpacked into the new top-level ``setting``,
           ``connections``, and ``objects`` fields.
        """
        if "game_world" not in raw and "locations" in raw:
            raw["game_world"] = {"locations": raw.pop("locations")}

        locations = raw.get("game_world", {}).get("locations", {})
        for loc_id, loc_data in locations.items():
            if "name" not in loc_data or not loc_data.get("name"):
                loc_data["name"] = loc_id.replace("_", " ").title()
            GameEngine._normalize_location(loc_data)

        # Ensure every connection is bidirectional
        GameEngine._ensure_bidirectional_connections(locations)

        # Populate Location.people from scenario characters
        GameEngine._populate_people(raw, locations)

    @staticmethod
    def _normalize_location(loc: dict) -> None:
        """Normalise a single legacy location dict in-place."""
        vm = loc.get("visual_metadata", {})

        # ── setting ────────────────────────────────────────────────
        if "setting" not in loc and "setting" in vm:
            loc["setting"] = vm["setting"]
        if "setting" not in loc:
            loc["setting"] = loc.get("description", "")

        # ── connections ────────────────────────────────────────────
        if "connections" not in loc or not loc["connections"]:
            new_conns = []
            for c in vm.get("connections", []):
                state_raw = (c.get("state") or "").lower()
                state = "locked" if "lock" in state_raw else "unlocked"
                new_conns.append({
                    "location_id": c.get("target_location", c.get("targetLocation", "")),
                    "state": state,
                })
            loc["connections"] = new_conns

        # ── objects (from surfaces_and_containers + loose items) ───
        if "objects" not in loc or not loc["objects"]:
            objects: List[dict] = []

            for sc in vm.get("surfaces_and_containers", []):
                sc_type = sc.get("type", "surface")
                category = sc_type if sc_type in ("surface", "container") else "surface"
                contained: List[dict] = []
                for child in sc.get("objects", []):
                    item_name = child.get("item_id") or child.get("itemId", "unknown")
                    vis = child.get("visibility", "visible")
                    hid = child.get("hidden_by") or child.get("hiddenBy")
                    desc = f"Visibility: {vis}"
                    if hid:
                        desc += f". Hidden by: {hid}"
                    contained.append({
                        "id": item_name.lower().replace(" ", "_"),
                        "category": "item",
                        "name": item_name,
                        "description": desc,
                        "notes": "",
                    })

                objects.append({
                    "id": sc.get("id", "").lower().replace(" ", "_"),
                    "category": category,
                    "name": sc.get("id", ""),
                    "description": sc.get("spatial_relationship", sc.get("spatialRelationship", "")),
                    "notes": "",
                    "state": "closed" if category == "container" else None,
                    "contains": contained or None,
                })

            for item_name in loc.get("items", []):
                if isinstance(item_name, str):
                    objects.append({
                        "id": item_name.lower().replace(" ", "_"),
                        "category": "item",
                        "name": item_name,
                        "description": f"A loose item: {item_name}",
                        "notes": "",
                    })

            loc["objects"] = objects

        # ── cleanup legacy fields ─────────────────────────────────
        loc.pop("visual_metadata", None)
        loc.pop("items", None)
        loc.pop("base_ascii", None)

    @staticmethod
    def _ensure_bidirectional_connections(locations: dict) -> None:
        """For every A→B connection, ensure B→A also exists."""
        for loc_id, loc_data in locations.items():
            for conn in loc_data.get("connections", []):
                target_id = conn.get("location_id", "")
                if not target_id or target_id not in locations:
                    continue
                target_conns = locations[target_id].get("connections", [])
                has_reverse = any(
                    c.get("location_id") == loc_id for c in target_conns
                )
                if not has_reverse:
                    target_conns.append({
                        "location_id": loc_id,
                        "state": conn.get("state", "unlocked"),
                    })
                    locations[target_id]["connections"] = target_conns

    @staticmethod
    def _populate_people(raw: dict, locations: dict) -> None:
        """Inject Person entries into locations from scenario.characters."""
        characters = raw.get("characters", {})
        for char_name, char_data in characters.items():
            if not isinstance(char_data, dict):
                continue
            phase_locs = char_data.get("phase_locations", {})
            default_loc = char_data.get("location", "")
            # Use first phase location, falling back to default location
            start_loc = (
                phase_locs.get("1")
                or phase_locs.get(1)
                or default_loc
            )
            if not start_loc or start_loc not in locations:
                continue
            existing_people = locations[start_loc].setdefault("people", [])
            already_present = any(
                p.get("name") == char_name for p in existing_people
            )
            if already_present:
                continue
            existing_people.append({
                "id": char_name.lower().replace(" ", "_").replace('"', ""),
                "name": char_name,
                "description": char_data.get("persona", char_data.get("role", "")),
                "notes": char_data.get("secret", ""),
                "state": "alive",
            })

    def load_scenario(self, scenario_id: str) -> Optional[Scenario]:
        """Get a scenario by ID."""
        return self.scenarios.get(scenario_id)

    async def load_scenarios_from_db(self):
        """Load all scenarios stored in MongoDB into memory."""
        from app.db.mongodb import get_database
        db = await get_database()
        if db is None:
            return
        
        try:
            cursor = db["scenarios"].find({})
            count = 0
            async for doc in cursor:
                _id = doc.get("_id")
                sid = str(_id) if _id else doc.get("title", "").lower().replace(" ", "_")
                doc.pop("_id", None)
                try:
                    self._normalize_scenario_payload(doc)
                    scenario = Scenario.model_validate(doc)
                    if sid not in self.scenarios:
                        self.scenarios[sid] = scenario
                        count += 1
                except Exception as e:
                    print(f"⚠️ Failed to load DB scenario {sid}: {e}")
            print(f"🔮 GameEngine: Loaded {count} new scenarios from DB")
        except Exception as e:
            print(f"⚠️ Failed to load scenarios from MongoDB: {e}")

    def _scenario_to_dict(self, scenario: Scenario) -> dict:
        """Convert Pydantic Scenario to dict for agent consumption.

        Note: We flatten game_world.locations to just 'locations' for backward
        compatibility with agent prompts that expect scenario['locations'].
        """
        data = json.loads(scenario.model_dump_json())
        # Flatten game_world.locations to top-level 'locations' for agents
        if 'game_world' in data and 'locations' in data['game_world']:
            data['locations'] = data['game_world']['locations']
        return data

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

    # ═══ DISPLAY NAME SIMPLIFICATION ══════════════════════════════════

    def _ensure_display_names(self, scenario_id: str) -> Dict[str, str]:
        """Lazily generate and cache display names for a scenario on first use."""
        if scenario_id in self._display_names:
            return self._display_names[scenario_id]

        scenario = self.scenarios.get(scenario_id)
        if not scenario:
            self._display_names[scenario_id] = {}
            return {}

        try:
            mapping = self._generate_display_names(scenario)
        except Exception as e:
            print(f"⚠️ Display name generation failed for {scenario_id}: {e}")
            mapping = {}

        self._display_names[scenario_id] = mapping
        return mapping

    def _generate_display_names(self, scenario: Scenario) -> Dict[str, str]:
        """Use an LLM to simplify all entity names in a scenario.

        Returns a mapping {original_name: simplified_name} for locations,
        characters, objects, and items whose names need shortening.
        Names that are already short are kept as-is.
        """
        all_names: Dict[str, list[str]] = {
            "locations": [],
            "characters": list(scenario.characters.keys()),
            "objects": [],
            "items": [],
        }
        for loc_id, loc in scenario.game_world.locations.items():
            all_names["locations"].append(loc.name or loc_id)
            for obj in loc.objects:
                all_names["objects"].append(obj.name)
                if obj.contains:
                    for child in obj.contains:
                        all_names["items"].append(child.name)
            for person in loc.people:
                if person.name not in all_names["characters"]:
                    all_names["characters"].append(person.name)

        # Only send names that are long enough to benefit from simplification
        THRESHOLD = 30
        names_to_simplify: list[str] = []
        for category_names in all_names.values():
            for n in category_names:
                if len(n) > THRESHOLD and n not in names_to_simplify:
                    names_to_simplify.append(n)

        if not names_to_simplify:
            return {}

        if not self._oracle:
            return {}

        prompt = (
            "You are a game UI name shortener. Given these verbose entity names from "
            "a detective game scenario, produce a concise display name (max 30 chars) "
            "for each. Keep names recognizable. For locations, keep the key landmark. "
            "For people, use their first name or shortest alias.\n\n"
            f"Names:\n{json.dumps(names_to_simplify, indent=2)}\n\n"
            "Return ONLY a JSON object mapping each original name to its simplified version.\n"
            'Example: {"Very Long Location Name (with details)": "Short Name"}'
        )

        try:
            result = self._oracle.model.invoke([
                {"role": "system", "content": "You simplify game entity names. Respond ONLY with a JSON object."},
                {"role": "user", "content": prompt},
            ])
            json_match = re.search(r"\{[\s\S]*\}", result.content)
            if json_match:
                parsed = json.loads(json_match.group())
                mapping: Dict[str, str] = {}
                for original, simplified in parsed.items():
                    if isinstance(simplified, str) and simplified.strip():
                        mapping[original] = simplified.strip()
                print(f"📝 Display names generated: {len(mapping)} simplifications")
                return mapping
        except Exception as e:
            print(f"⚠️ Display name generation LLM call failed: {e}")

        return {}

    def get_display_name(self, scenario_id: str, original: str) -> str:
        """Get the simplified display name for an entity, or the original."""
        names = self._ensure_display_names(scenario_id)
        return names.get(original, original)

    def apply_display_names(self, scenario_id: str, names: list[str]) -> list[str]:
        """Apply display name mapping to a list of names."""
        name_map = self._ensure_display_names(scenario_id)
        if not name_map:
            return names
        return [name_map.get(n, n) for n in names]

    # ═══ CANONICAL NAME MAPPING ════════════════════════════════════════

    def _collect_canonical_names(self, scenario: Scenario, scenario_id: str | None = None) -> dict:
        """Collect all canonical entity names from the scenario.

        Also includes display-name aliases so the LLM can match either form.
        """
        items: set[str] = set()
        location_names: list[str] = []
        objects: set[str] = set()

        for loc_id, loc in scenario.game_world.locations.items():
            location_names.append(loc.name or loc_id)
            for obj in loc.objects:
                objects.add(obj.name)
                if obj.category.value == "item":
                    items.add(obj.name)
                if obj.contains:
                    for child in obj.contains:
                        items.add(child.name)

        characters = list(scenario.characters.keys())

        # Add display-name aliases so canonical matching works both ways
        display_map = self._ensure_display_names(scenario_id) if scenario_id else {}
        all_loc_targets = list(location_names)
        all_char_targets = list(characters)
        all_item_targets = sorted(items)
        for orig, disp in display_map.items():
            if orig in location_names and disp not in all_loc_targets:
                all_loc_targets.append(disp)
            elif orig in characters and disp not in all_char_targets:
                all_char_targets.append(disp)
            elif orig in items and disp not in all_item_targets:
                all_item_targets.append(disp)

        return {
            "items": all_item_targets,
            "locations": all_loc_targets,
            "characters": all_char_targets,
            "objects": sorted(objects),
        }

    async def _canonicalize_names(
        self, names: list[str], canonical_names: list[str], category: str
    ) -> tuple[dict[str, str], list[str]]:
        """Map names to canonical equivalents. Returns (mapping, new_names).

        ``new_names`` contains entries the LLM mapped to ``null`` (truly new entities).
        """
        if not names or not canonical_names:
            return {}, list(names or [])

        mapping: dict[str, str] = {}
        remaining: list[str] = []
        canonical_lower = {c.lower().strip(): c for c in canonical_names}

        for name in names:
            if name in canonical_names:
                mapping[name] = name
            elif name.lower().strip() in canonical_lower:
                mapping[name] = canonical_lower[name.lower().strip()]
            else:
                remaining.append(name)

        if not remaining:
            return mapping, []

        prompt = (
            f"Map each {category} name to its closest canonical equivalent.\n\n"
            f"Canonical names: {json.dumps(canonical_names)}\n"
            f"Names to map: {json.dumps(remaining)}\n\n"
            f"Return ONLY a JSON object mapping each input name to the best "
            f"canonical match. If no reasonable match exists (i.e. it is a genuinely "
            f"new entity), map to null.\n"
            f'Example: {{"some name": "Canonical Name", "brand new thing": null}}'
        )

        new_names: list[str] = []
        try:
            messages = [
                {"role": "system", "content": (
                    "You are an entity name resolver for a detective game. Map "
                    "variant names to canonical equivalents. If the name refers "
                    "to something genuinely new (not in the list), map to null. "
                    "Respond ONLY with a JSON object."
                )},
                {"role": "user", "content": prompt},
            ]
            # Run synchronous LLM call in a thread so asyncio.gather
            # can parallelize multiple categories concurrently
            result = await asyncio.to_thread(self._oracle.model.invoke, messages)
            json_match = re.search(r"\{[\s\S]*\}", result.content)
            if json_match:
                parsed = json.loads(json_match.group())
                for name, canonical in parsed.items():
                    if canonical and canonical in canonical_names:
                        mapping[name] = canonical
                    elif canonical is None:
                        new_names.append(name)
        except Exception as e:
            print(f"⚠️ Canonical name mapping failed for {category}: {e}")

        return mapping, new_names

    async def _canonicalize_oracle_result(
        self, result: any, scenario: Scenario, scenario_id: str
    ) -> list[str]:
        """Post-process Oracle result to replace non-canonical names in-place.

        Runs independent category mappings in parallel via asyncio.gather.
        Returns a list of entity names the LLM flagged as genuinely new.
        """
        canonical = self._collect_canonical_names(scenario, scenario_id)

        # Build tasks for categories that need mapping
        tasks: dict[str, asyncio.Task] = {}
        if result.picked_up_items:
            tasks["items"] = self._canonicalize_names(
                result.picked_up_items, canonical["items"], "item"
            )
        if result.new_location:
            tasks["location"] = self._canonicalize_names(
                [result.new_location], canonical["locations"], "location"
            )
        if result.found_clues:
            tasks["clues"] = self._canonicalize_names(
                result.found_clues,
                canonical["items"] + canonical["characters"],
                "clue/entity",
            )

        if not tasks:
            return []

        # Run all mapping calls concurrently
        keys = list(tasks.keys())
        results_list = await asyncio.gather(*tasks.values(), return_exceptions=True)
        resolved = dict(zip(keys, results_list))

        all_new: list[str] = []

        if "items" in resolved and not isinstance(resolved["items"], Exception):
            item_map, new_items = resolved["items"]
            result.picked_up_items = [
                item_map.get(i, i) for i in result.picked_up_items
            ]
            all_new.extend(new_items)

        if "location" in resolved and not isinstance(resolved["location"], Exception):
            loc_map, _ = resolved["location"]
            result.new_location = loc_map.get(
                result.new_location, result.new_location
            )

        if "clues" in resolved and not isinstance(resolved["clues"], Exception):
            clue_map, new_clues = resolved["clues"]
            result.found_clues = [
                clue_map.get(c, c) for c in result.found_clues
            ]
            all_new.extend(new_clues)

        return all_new

    async def _generate_new_entity_sprites(
        self,
        new_entity_names: list[str],
        narrative_context: str,
        scenario_id: str,
    ) -> Optional[Dict[str, Dict]]:
        """Generate sprite images for newly introduced entities.

        Returns {artifact_key: {"content": base64_png, "mime_type": "image/png"}}.
        """
        if not new_entity_names:
            return None

        from src_py.api.dependencies import get_world_service
        from src_py.domain.rendering import (
            RenderRequest,
            SubjectType,
            RenderProfile,
        )

        service = get_world_service()
        requests: list[RenderRequest] = []

        for name in new_entity_names:
            safe_id = name.lower().replace(" ", "_").replace('"', "")
            key = f"new:{scenario_id}:{safe_id}"
            description = f"{name} — {narrative_context[:200]}"
            requests.append(
                RenderRequest(
                    key=key,
                    subject_type=SubjectType.WORLD_ITEM,
                    subject_id=safe_id,
                    state="default",
                    description=description,
                )
            )

        if not requests:
            return None

        try:
            profile = RenderProfile()
            artifacts, _, _ = await service._artifacts.render_many(requests, profile)
            result: Dict[str, Dict] = {}
            for art_key, artifact in artifacts.items():
                result[art_key] = {
                    "content": artifact.content,
                    "mime_type": artifact.mime_type,
                }
            return result if result else None
        except Exception as e:
            print(f"⚠️ New entity sprite generation failed: {e}")
            return None

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

            # Canonicalize entity names returned by Oracle
            new_entities: list[str] = []
            try:
                new_entities = await self._canonicalize_oracle_result(
                    result, scenario, session.scenario_id,
                )
            except Exception as e:
                print(f"⚠️ Canonical mapping step skipped: {e}")

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

            # Apply display names to response fields
            sid = session.scenario_id
            display_map = self._ensure_display_names(sid)
            if display_map:
                if new_location:
                    new_location = display_map.get(new_location, new_location)
                new_items = self.apply_display_names(sid, new_items)
                new_clues = self.apply_display_names(sid, new_clues)
                chars_in_room = self.apply_display_names(sid, chars_in_room)
                if state_updates.current_location:
                    state_updates.current_location = display_map.get(
                        state_updates.current_location, state_updates.current_location,
                    )

            # Generate sprites for genuinely new entities
            new_entity_artifacts = None
            if new_entities:
                try:
                    new_entity_artifacts = await self._generate_new_entity_sprites(
                        new_entities, result.narrative, session.scenario_id,
                    )
                except Exception as e:
                    print(f"⚠️ New entity sprite generation skipped: {e}")

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
                display_name_map=display_map if display_map else None,
                new_entity_artifacts=new_entity_artifacts,
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
