"""
Game Graph Generator

Converts mystery novels into structured game graphs using LLM-based extraction
and generation. Uses OpenAI GPT-5.2 for generation.

Usage:
    from game_graph_generator import GameGraphGenerator

    generator = GameGraphGenerator()
    game_graph = generator.generate_from_file("story.json")
    generator.save_graph(game_graph, "output.json")

The main CLI (cli.main) runs story generation then builds the graph from
data/output/output.json and saves to data/graphs/graph.json.
"""

import json
import os
import re
from enum import Enum
from typing import List, Optional, Dict, Literal
from dataclasses import dataclass

from pydantic import BaseModel, Field
from openai import OpenAI
from dotenv import load_dotenv


# =============================================================================
# Pydantic Schemas
# =============================================================================

class ExtractedEntities(BaseModel):
    """Key information extracted from a mystery novel."""

    title: str = Field(default="Unknown", description="Title of the story")
    culprits: List[str] = Field(default_factory=list, description="Name of the culprits/perpetrator")
    locations: List[str] = Field(default_factory=list)
    characters: List[str] = Field(default_factory=list)
    clues: List[str] = Field(default_factory=list)
    items: List[str] = Field(default_factory=list)


class VisibilityState(str, Enum):
    VISIBLE = "visible"
    PARTIALLY_HIDDEN = "partially hidden"
    HIDDEN = "hidden"


class CharacterType(str, Enum):
    SUSPECT = "suspect"
    ASSISTANT = "assistant"


class ConnectionState(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    LOCKED = "locked"
    LOCKED_FROM_INSIDE = "locked from inside"


class SceneObject(BaseModel):
    item_id: str = Field(..., description="The unique identifier or name of the item.")
    visibility: VisibilityState = Field(..., description="How visible the object is initially.")
    hidden_by: Optional[str] = Field(None, description="What is concealing it if hidden.")


class SurfaceOrContainer(BaseModel):
    id: str = Field(..., description="Name of the furniture or area.")
    type: Literal["surface", "container"] = Field(..., description="Whether items rest ON it or INSIDE it.")
    spatial_relationship: str = Field(..., description="Where it is located in the room.")
    objects: List[SceneObject] = Field(default_factory=list)


class Connection(BaseModel):
    target_location: str = Field(..., description="The name of the connected Location.")
    mechanism: str = Field(..., description="The physical boundary (e.g., 'Heavy Oak Door').")
    state: ConnectionState = Field(..., description="The current traversal state.")


class VisualMetadata(BaseModel):
    setting: str = Field(..., description="Atmospheric description of the room's aesthetic.")
    connections: List[Connection] = Field(default_factory=list)
    surfaces_and_containers: List[SurfaceOrContainer] = Field(default_factory=list)


class Location(BaseModel):
    description: str = Field(..., description="Text provided to player when entering.")
    items: List[str] = Field(default_factory=list, description="Pick-upable inventory items.")
    clues: List[str] = Field(default_factory=list, description="Intangible deductions.")
    base_ascii: str = Field(..., description="6-8 line ASCII art representing room layout.")
    visual_metadata: VisualMetadata


class ConditionalBehavior(BaseModel):
    applicable_phases: List[int]
    required_evidence: List[str] = Field(default_factory=list)
    required_knowledge: List[str] = Field(default_factory=list)
    reaction: str = Field(..., description="Reaction if conditions met.")
    leads_to_break: bool = Field(False, description="Forces confession if True.")


class Character(BaseModel):
    type: CharacterType
    role: str
    location: str
    phase_locations: Dict[int, str]
    persona: str = Field(..., description="Tone and speech patterns.")
    knowledge_about_others: Dict[str, str] = Field(default_factory=dict)
    secret: str = Field("", description="Mandatory for suspects.")
    abilities: str = Field("", description="Mandatory for assistants.")
    conditional_behaviors: List[ConditionalBehavior] = Field(default_factory=list)
    suspicion_meter: int = Field(0, ge=0, le=100)
    flight_risk: int = Field(0, ge=0, le=100)


class Phase(BaseModel):
    id: int
    name: str
    objective: str
    unlocked_locations: List[str]
    unlocked_characters: List[str]


class WinConditions(BaseModel):
    required_evidence: List[str] = Field(..., description="Item(s) evidence required to win.")
    required_suspect: List[str] = Field(..., description="culprit(s) required to win.")
    required_motive: List[str] = Field(..., description="Motive(s) required to win.")


class Scenario(BaseModel):
    title: str
    victim: str
    intro_narrative: str
    time_limit_minutes: int = 180
    start_time: str
    win_conditions: WinConditions
    phases: List[Phase]
    locations: Dict[str, Location]
    characters: Dict[str, Character]


# =============================================================================
# Coverage Results
# =============================================================================

@dataclass
class CoverageStats:
    """Statistics for entity coverage in generated graph."""
    expected: int
    found: int

    @property
    def coverage(self) -> float:
        return self.found / max(self.expected, 1) * 100

    @property
    def is_sufficient(self) -> bool:
        return self.coverage >= 80


@dataclass
class CoverageReport:
    """Complete coverage report for all entity types."""
    locations: CoverageStats
    characters: CoverageStats
    clues: CoverageStats
    items: CoverageStats

    def print_report(self):
        """Print coverage report to console."""
        print("\n--- Entity Coverage ---")
        for name in ['locations', 'characters', 'clues', 'items']:
            stats = getattr(self, name)
            status = "✓" if stats.is_sufficient else "⚠"
            print(f"  {status} {name.capitalize()}: {stats.found}/{stats.expected} ({stats.coverage:.0f}%)")


# =============================================================================
# Main Generator Class
# =============================================================================

class GameGraphGenerator:
    """
    Generates mystery game graphs from novel text using LLM-based extraction.
    Uses OpenAI GPT-5.2 with 32000 output tokens.

    Attributes:
        client: The initialized OpenAI client
    """

    DEFAULT_MODEL = "gpt-5.2"
    DEFAULT_MAX_TOKENS = 32000

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the GameGraphGenerator.

        Args:
            api_key: Optional API key (falls back to OPENAI_KEY environment variable)
        """
        load_dotenv()
        self.client = self._init_client(api_key)

    def _init_client(self, api_key: Optional[str] = None) -> OpenAI:
        """Initialize the OpenAI client."""
        key = api_key or os.getenv("OPENAI_KEY")
        if not key:
            raise ValueError("OPENAI_KEY not found. Set it in .env or pass api_key parameter.")
        return OpenAI(api_key=key)

    @staticmethod
    def _extract_json(text: str) -> dict:
        """Extract JSON from LLM response, handling markdown code blocks."""
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try markdown code block
        code_block_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
        if code_block_match:
            try:
                return json.loads(code_block_match.group(1).strip())
            except json.JSONDecodeError:
                pass

        # Try to find JSON object pattern
        json_match = re.search(r'\{[\s\S]*\}', text)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        raise ValueError(f"Could not extract valid JSON from response:\n{text[:500]}...")

    def _call_llm(self, messages: List[dict], max_tokens: int = 32000) -> str:
        """Make an LLM API call and return the response content."""
        response = self.client.chat.completions.create(
            model=self.DEFAULT_MODEL,
            messages=messages,
            max_completion_tokens=max_tokens,
            response_format={"type": "json_object"}
        )
        return response.choices[0].message.content

    def extract_entities(self, story_data: dict, verbose: bool = True) -> ExtractedEntities:
        """
        Extract key entities from a mystery story.

        Args:
            story_data: Dict with 'title' and 'text' keys
            verbose: Whether to print progress

        Returns:
            ExtractedEntities object containing all extracted information
        """
        text = story_data['text']
        title = story_data.get('title', 'Unknown')

        if verbose:
            print(f"Extracting entities from: {title}")
            print(f"Model: {self.DEFAULT_MODEL}")
            print("-" * 50)

        system_prompt = """You are an expert literary analyst specializing in mystery novels. Your task is to extract STORY-RELEVANT information that is essential to the mystery plot.

Extract ONLY entities that are MEANINGFUL to the storyline:

1. LOCATIONS: Only places where significant events occur or that are relevant to solving the mystery. Skip passing mentions or background locations.
2. CHARACTERS: Only characters who play a role in the mystery - suspects, witnesses, investigators, victims. Skip unnamed background characters or those merely mentioned in passing.
3. CLUES: Only evidence, observations, or deductions that actually help solve the mystery. Focus on clues that point to the culprits, establish alibis, or reveal motives.
4. ITEMS: Only physical objects that are relevant to the crime or investigation - murder weapons, evidence, key documents. Skip generic furniture or mundane objects.

Return a JSON object:
{
  "title": "story title",
  "culprits": "name of the perpetrator/guilty party",
  "locations": ["list only PLOT-RELEVANT locations - typically 5-10"],
  "characters": ["list only STORY-SIGNIFICANT characters - typically 5-10"],
  "clues": ["list only MYSTERY-SOLVING clues - typically 5-10"],
  "items": ["list only INVESTIGATION-RELEVANT items - typically 5-10"]
}

Be selective. Quality over quantity - include only what matters for the mystery."""

        user_prompt = f"""Extract STORY-RELEVANT information from this mystery story. Focus on what's important for the mystery plot.

TITLE: {title}

STORY:
{text}

Remember: Extract ONLY locations where key events happen, characters who matter to the plot, clues that help solve the mystery, and items relevant to the investigation. Be selective - typically 5-10 entries per category."""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        content = self._call_llm(messages, max_tokens=4000)
        result = self._extract_json(content)
        validated = ExtractedEntities.model_validate(result)

        if verbose:
            print("Entity extraction complete!")
            print(f"  Found: {len(validated.locations)} locations, {len(validated.characters)} characters, "
                  f"{len(validated.clues)} clues, {len(validated.items)} items")

        return validated

    def _get_system_prompt(self, schema: dict, entities: ExtractedEntities) -> str:
        """Generate the system prompt for game graph generation."""
        locations_list = "\n".join([f"  {i+1}. {loc}" for i, loc in enumerate(entities.locations)])
        characters_list = "\n".join([f"  {i+1}. {char}" for i, char in enumerate(entities.characters)])
        clues_list = "\n".join([f"  {i+1}. {clue}" for i, clue in enumerate(entities.clues)])
        items_list = "\n".join([f"  {i+1}. {item}" for i, item in enumerate(entities.items)])

        return f"""You are an expert Mystery Game Narrative Designer. Transform a mystery novel into a Game State Graph JSON.

CRITICAL REQUIREMENTS - You MUST include ALL of these extracted entities:

=== TITLE ===
{entities.title}

=== culprits (use as required_suspect in win_conditions) ===
{entities.culprits}

=== LOCATIONS (create a game location for EACH of these) ===
{locations_list}

=== CHARACTERS (include ALL of these as game characters) ===
{characters_list}

=== CLUES (distribute ALL across locations - each location should have clues) ===
{clues_list}

=== ITEMS (distribute ALL across locations - place in items or surfaces_and_containers) ===
{items_list}

INSTRUCTIONS:
1. Create a Location entry for EVERY extracted location above
2. Create a Character entry for EVERY extracted character above
3. Place EVERY extracted clue in some location's "clues" array
4. Place EVERY extracted item in some location's "items" array or in surfaces_and_containers
5. Design 3-4 phases that unlock locations/characters progressively
6. Set the culprits as required_suspect in win_conditions
7. Create 6-8 line ASCII maps for each location

VALIDATION CHECKLIST (ensure all are met):
- Number of locations in output >= {len(entities.locations)}
- Number of characters in output >= {len(entities.characters)}
- All {len(entities.clues)} clues appear somewhere in locations
- All {len(entities.items)} items appear somewhere in locations

Respond with ONLY valid JSON matching this schema:
{json.dumps(schema, indent=2)}"""

    def _get_user_prompt(self, story_data: dict, entities: ExtractedEntities) -> str:
        """Generate the user prompt for game graph generation."""
        return f"""Generate a complete Game State Graph JSON for this mystery.

MANDATORY ENTITY COUNTS TO INCLUDE:
- Locations: {len(entities.locations)} (create all of them)
- Characters: {len(entities.characters)} (include all of them)
- Clues: {len(entities.clues)} (place all in various locations)
- Items: {len(entities.items)} (place all in various locations)

ORIGINAL STORY FOR CONTEXT AND ATMOSPHERE:
{story_data['text']}

Generate the Scenario JSON. Ensure EVERY extracted entity appears in the output. Output ONLY valid JSON."""

    def validate_coverage(self, game_graph: dict, entities: ExtractedEntities) -> CoverageReport:
        """
        Check how well the game graph covers the extracted entities.

        Args:
            game_graph: The generated game graph
            entities: The extracted entities to compare against

        Returns:
            CoverageReport with statistics for each entity type
        """
        graph_locations = list(game_graph.get('locations', {}).keys())
        graph_characters = list(game_graph.get('characters', {}).keys())

        graph_clues = []
        graph_items = []
        for loc_data in game_graph.get('locations', {}).values():
            graph_clues.extend(loc_data.get('clues', []))
            graph_items.extend(loc_data.get('items', []))
            visual_meta = loc_data.get('visual_metadata', {})
            for surface in visual_meta.get('surfaces_and_containers', []):
                for obj in surface.get('objects', []):
                    if obj.get('item_id'):
                        graph_items.append(obj['item_id'])

        return CoverageReport(
            locations=CoverageStats(len(entities.locations), len(graph_locations)),
            characters=CoverageStats(len(entities.characters), len(graph_characters)),
            clues=CoverageStats(len(entities.clues), len(graph_clues)),
            items=CoverageStats(len(entities.items), len(graph_items))
        )

    def _has_preextracted_entities(self, story_data: dict) -> bool:
        """Check if the story data already contains extracted entities."""
        required_fields = ['culprits', 'locations', 'characters', 'clues', 'items']
        for field in required_fields:
            if field not in story_data or not story_data[field]:
                return False
        return True

    def _get_entities_from_data(self, story_data: dict) -> ExtractedEntities:
        """Create ExtractedEntities from pre-extracted data in story_data."""
        return ExtractedEntities(
            title=story_data.get('title', 'Unknown'),
            culprits=story_data.get('culprits', 'Unknown'),
            locations=story_data.get('locations', []),
            characters=story_data.get('characters', []),
            clues=story_data.get('clues', []),
            items=story_data.get('items', [])
        )

    def generate_graph(
        self,
        story_data: dict,
        entities: Optional[ExtractedEntities] = None,
        verbose: bool = True
    ) -> dict:
        """
        Generate a game graph from story data.

        Args:
            story_data: Dict with 'title' and 'text' keys. Can optionally include
                        pre-extracted entities: 'culprits', 'locations', 'characters',
                        'clues', 'items'. If these are present, extraction is skipped.
            entities: Optional pre-extracted entities (will extract if not provided
                      and not in story_data)
            verbose: Whether to print progress

        Returns:
            The generated game graph as a dictionary
        """
        # Determine entities source
        if entities is not None:
            if verbose:
                print("Using provided entities")
        elif self._has_preextracted_entities(story_data):
            if verbose:
                print("Using pre-extracted entities from input JSON")
            entities = self._get_entities_from_data(story_data)
        else:
            if verbose:
                print("No pre-extracted entities found, extracting from text...")
            entities = self.extract_entities(story_data, verbose=verbose)

        if verbose:
            print(f"\nGenerating game graph for: {story_data.get('title', 'Unknown')}")
            print(f"Story length: {len(story_data['text']):,} characters")
            print(f"Model: {self.DEFAULT_MODEL}")
            print(f"Target: {len(entities.locations)} locations, {len(entities.characters)} characters, "
                  f"{len(entities.clues)} clues, {len(entities.items)} items")
            print("-" * 50)

        schema = Scenario.model_json_schema()
        system_prompt = self._get_system_prompt(schema, entities)
        user_prompt = self._get_user_prompt(story_data, entities)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]

        content = self._call_llm(messages, max_tokens=32000)

        if verbose:
            print(f"Response received ({len(content):,} chars)")

        result = self._extract_json(content)
        validated = Scenario.model_validate(result)
        game_graph = validated.model_dump()

        if verbose:
            print("Schema validation passed!")
            coverage = self.validate_coverage(game_graph, entities)
            coverage.print_report()

        return game_graph

    def generate_from_file(
        self,
        input_path: str,
        verbose: bool = True
    ) -> dict:
        """
        Generate a game graph from a JSON file containing story data.

        Args:
            input_path: Path to JSON file with 'title' and 'text' keys
            verbose: Whether to print progress

        Returns:
            The generated game graph as a dictionary
        """
        with open(input_path, 'r') as f:
            story_data = json.load(f)

        if verbose:
            print(f"Loaded story: {story_data.get('title', 'Unknown')}")
            print(f"Text length: {len(story_data.get('text', '')):,} characters")

        return self.generate_graph(story_data, verbose=verbose)

    @staticmethod
    def save_graph(game_graph: dict, output_path: str):
        """
        Save a game graph to a JSON file.

        Args:
            game_graph: The game graph dictionary to save
            output_path: Path to save the JSON file
        """
        with open(output_path, 'w') as f:
            json.dump(game_graph, f, indent=2)
        print(f"Game graph saved to: {output_path}")

    def generate_and_save(
        self,
        input_path: str,
        verbose: bool = True
    ) -> dict:
        """
        Generate a game graph from a file and save it.

        Args:
            input_path: Path to input JSON file
            verbose: Whether to print progress

        Returns:
            The generated game graph
        """
        game_graph = self.generate_from_file(input_path, verbose=verbose)

        # Auto-generate output path from title
        title = game_graph.get('title', 'unknown').replace(' ', '_')
        output_path = f"game_graph_{title}.json"

        self.save_graph(game_graph, output_path)

        if verbose:
            print(f"\nSummary:")
            print(f"  Locations: {len(game_graph.get('locations', {}))}")
            print(f"  Characters: {len(game_graph.get('characters', {}))}")
            print(f"  Phases: {len(game_graph.get('phases', []))}")

        return game_graph
