# Agentic Engine Specification & Schema

---

This document defines the core architecture and data structures for the Mistry Multi-Agent Detective Engine. It is divided into two parts: the strict Pydantic schema used for dataset ingestion/knowledge graph construction, and the C4 architecture diagrams detailing the agent interactions.

## Part 1: Pydantic Data Schema (Knowledge Graph)

This schema is used by the Dataset Parser LLM to convert unstructured narrative text into a highly structured, machine-readable format. It serves as the immutable "Ground Truth" for the game session.

```
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Literal
from enum import Enum

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
    item_id: str = Field(..., description="The unique identifier or name of the item (e.g., 'Wooden Club').")
    visibility: VisibilityState = Field(..., description="How visible the object is to the player initially.")
    hidden_by: Optional[str] = Field(None, description="If hidden or partially hidden, what is concealing it (e.g., 'Inside the drawer', 'Under the rug').")

class SurfaceOrContainer(BaseModel):
    id: str = Field(..., description="Name of the furniture or area (e.g., 'Oak Desk', 'Fireplace Mantle').")
    type: Literal["surface", "container"] = Field(..., description="Whether items rest ON it (surface) or INSIDE it (container).")
    spatial_relationship: str = Field(..., description="Where it is located in the room (e.g., 'In the center', 'Against the North wall').")
    objects: List[SceneObject] = Field(default_factory=list, description="Items currently located on/in this surface/container.")

class Connection(BaseModel):
    target_location: str = Field(..., description="The name of the connected Location.")
    mechanism: str = Field(..., description="The physical boundary (e.g., 'Heavy Oak Door', 'French Windows', 'Gravel Path').")
    state: ConnectionState = Field(..., description="The current traversal state of this connection.")

class VisualMetadata(BaseModel):
    """Hierarchical visual representation used for 3D scene reconstruction or Image Generation."""
    setting: str = Field(..., description="A rich, atmospheric description of the room's overall aesthetic and lighting.")
    connections: List[Connection] = Field(default_factory=list, description="All physical exits and routes to other rooms.")
    surfaces_and_containers: List[SurfaceOrContainer] = Field(default_factory=list, description="The spatial layout of furniture and objects.")

class Location(BaseModel):
    description: str = Field(..., description="The text description provided to the player when they enter or look around.")
    items: List[str] = Field(default_factory=list, description="Physical inventory items that can be picked up here.")
    clues: List[str] = Field(default_factory=list, description="Intangible deductions or observations that can be found here.")
    base_ascii: str = Field(..., description="A 6-8 line string containing ASCII art representing the room layout.")
    visual_metadata: VisualMetadata = Field(..., description="The structured spatial data for this room.")

class ConditionalBehavior(BaseModel):
    """Atomic triggers evaluated by the Character Agent to determine dynamic responses."""
    applicable_phases: List[int] = Field(..., description="List of Phase IDs where this behavior is active.")
    required_evidence: List[str] = Field(default_factory=list, description="Physical items the player MUST have in their inventory to trigger this.")
    required_knowledge: List[str] = Field(default_factory=list, description="Clues or Epiphanies the player MUST have in their notebook to trigger this.")
    reaction: str = Field(..., description="How the character reacts if the conditions are met.")
    leads_to_break: bool = Field(False, description="If True, meeting this condition completely shatters their alibi, forcing a confession.")

class Character(BaseModel):
    type: CharacterType = Field(..., description="Whether this character is a suspect (has secrets) or an assistant (helps the player).")
    role: str = Field(..., description="Their relationship to the narrative (e.g., 'The Jealous Widow', 'Medical Examiner').")
    location: str = Field(..., description="Their starting location.")
    phase_locations: Dict[int, str] = Field(..., description="Map of Phase ID to Location name. Dictates where they move as the story progresses.")
    persona: str = Field(..., description="Instructions on how the LLM should roleplay their tone, speech patterns, and demeanor.")
    knowledge_about_others: Dict[str, str] = Field(default_factory=dict, description="What they willingly share about specific topics or people.")
    secret: str = Field("", description="The hidden truth they are protecting (Mandatory for suspects).")
    abilities: str = Field("", description="Mechanical ways the character can assist the investigation (Mandatory for assistants).")
    conditional_behaviors: List[ConditionalBehavior] = Field(default_factory=list, description="The dependency graph of triggers that alter their behavior based on player knowledge.")
    suspicion_meter: int = Field(0, ge=0, le=100, description="Initial tension/defensiveness. If it reaches 100, they lock up and refuse to speak.")
    flight_risk: int = Field(0, ge=0, le=100, description="Probability they will attempt to flee the scene if suspicion gets too high.")

class Phase(BaseModel):
    """Breakpoints that control the narrative pacing."""
    id: int = Field(..., description="Sequential index of the phase (0 is always the intro).")
    name: str = Field(..., description="The title of this narrative act.")
    objective: str = Field(..., description="The explicit goal the player must achieve to unlock the next phase.")
    unlocked_locations: List[str] = Field(..., description="Locations accessible during this phase.")
    unlocked_characters: List[str] = Field(..., description="Characters available to interact with during this phase.")

class WinConditions(BaseModel):
    required_weapon: str = Field(..., description="The actual mechanism of death.")
    required_suspect: str = Field(..., description="The true culprit.")
    required_motive: str = Field(..., description="The underlying reason for the crime.")

class ScenarioDifficulty(BaseModel);
		easy: str = Field(..., description="The scenario has least complexity in terms of the reasoning, number of phases, multi-step reasoning, prerequisities required to catch the culprit and the deductive reasoning required for solving it. Consider something like a Sherlock Holmes case to be hard difficulty.")
		medium: str = Field(..., description="The scenario has moderate complexity in terms of the reasoning, number of phases, multi-step reasoning, prerequisities required to catch the culprit and the deductive reasoning required for solving it. Consider something like a Sherlock Holmes case to be hard difficulty.")
		hard: str = Field(..., description="The scenario has high complexity in terms of the reasoning, number of phases, multi-step reasoning, prerequisities required to catch the culprit and the deductive reasoning required for solving it. Consider something like a Sherlock Holmes case to be hard difficulty.")

class Scenario(BaseModel):
    """The root Knowledge Graph object."""
    title: str = Field(..., description="The title of the mystery.")
    description: str = Field(..., description="A short non-spoiler description about the mystery")
    victim: str = Field(..., description="The name of the deceased.")
    intro_narrative: str = Field(..., description="A dynamic 2-3 sentence hook setting the initial scene (e.g., a client arriving).")
    time_limit_minutes: int = Field(180, description="Maximum in-game minutes allowed before failure.")
    start_time: str = Field(..., description="In-game clock starting time (e.g., '11:45 PM').")
    win_conditions: WinConditions = Field(..., description="The ground truth required to solve the case.")
    phases: List[Phase] = Field(..., description="The sequential acts of the story.")
    locations: Dict[str, Location] = Field(..., description="Map of all unique areas in the game.")
    characters: Dict[str, Character] = Field(..., description="Map of all cast members.")
    difficulty: ScenarioDifficulty = Field(..., description="A classification of how tough the scenario is to solve.")
```

---

# Game Agent

## Agentic Engine Specification

Mistry uses a hub-and-spoke multi-agent architecture. The system relies on isolated working memories to prevent hallucinations and premature narrative spoilers.

NOTE that we use Gemini models for C4 diagrams but it is interchangeable with other LLMs

NOTE that some features such as the custom scene generation and the co-op mode are ideated but not in the design, so we need to design the system DB and so on with future implementation considerations. 

### C4 Level 1: System Context

How the user interacts with the overarching platform.

```
C4Context
    title Context Diagram: Mistry

    Person(player, "The Detective (Player)", "Interacts via text, manages evidence, draws epiphanies.")
    System(mistry, "Mistry", "Stateful game engine managing narrative progression and physics.")
    System_Ext(gemini_flash, "Gemini Flash (LLM)", "Powers natural language routing, reasoning, and character dialog.")
    System_Ext(gemini_image, "Gemini Image (Nano Banana)", "Renders real-time visual metadata into environmental imagery.")

    Rel(player, mistry, "Executes commands, interrogates, connects clues")
    Rel(mistry, gemini_flash, "Sends prompts & state, receives structured JSON")
    Rel(mistry, gemini_image, "Sends visual metadata, receives Base64 images")
```

### C4 Level 2: Container Diagram

The major deployable units and data stores.

```
C4Container
    title Container Diagram: Mistry

    Person(player, "The Detective")

    Container_Boundary(frontend, "Client App") {
        Container(react_ui, "React UI", "React/JS", "Manages Chat, Deduction Board Canvas, and Image viewing.")
        Container(state_store, "Mutable State Manager", "React Hooks", "Holds current Inventory, Clues, Time, and specific Phase.")
    }

    Container_Boundary(backend, "Game Engine") {
        Container(intent_router, "Intent Router", "Regex/Logic", "Differentiates world actions from dialogues.")
        Container(kg_parser, "Knowledge Graph Parser", "LLM Wrapper", "Ingests raw datasets into the strict Pydantic Scenario schema.")
    }

    System_Ext(gemini, "Gemini Models", "Text/JSON & Image APIs")

    Rel(player, react_ui, "Interacts")
    Rel(react_ui, intent_router, "Sends parsed actions")
    Rel(kg_parser, gemini, "Converts text dataset -> JSON Graph")
    Rel(intent_router, gemini, "Triggers specific agent personas")
    Rel(react_ui, state_store, "Updates locally based on agent JSON responses")
```

### C4 Level 3: Component Diagram (Agent Ecosystem)

How the LLM prompts and specific agents are orchestrated based on the Knowledge Graph.

```
C4Component
    title Component Diagram: Agent Interactions

    Container_Boundary(engine, "Agentic Engine") {

        Component(oracle, "Gamemaker Oracle", "LLM Agent", "Evaluates physical interactions (Search, Move). Evaluates Phase completion.")

        Component(character, "Character Agent", "LLM Agent", "Instantiated per NPC. Runs the Contradiction Engine against the player's evidence.")

        Component(deduction, "Epiphany Engine", "LLM Agent", "Evaluates the Red String board. Grants 'Knowledge' required to break suspects.")

        Component(scene_gen, "Scene Generator", "Logic -> Image API", "Translates VisualMetadata into a rendering prompt.")
    }

    ContainerDb(kg, "Knowledge Graph", "JSON Store", "The immutable blueprint generated by the Pydantic schema.")
    ContainerDb(p_state, "Player State", "Memory", "Inventory, Clues, Elapsed Time, Current Phase.")

    Rel(oracle, kg, "Reads locations, phases, connections")
    Rel(oracle, p_state, "Updates clues, inventory, time, phase index")

    Rel(character, kg, "Reads persona, secrets, conditional_behaviors")
    Rel(character, p_state, "Reads player's inventory/epiphanies to verify if triggers are met")

    Rel(scene_gen, kg, "Reads base visual_metadata")
    Rel(scene_gen, p_state, "Applies mutable diffs (e.g., 'door is now open', 'item is gone')")
```

```markdown
const DEFAULT_SCENARIO = {
  title: "The Crooked Man",
  victim: "Colonel Watson Morrison",
  introNarrative: "One summer night, you are seated by your own hearth smoking a last pipe when the bell clangs. To your astonishment, it is your old friend Neill Bhurtee. He needs your help investigating the strange murder of Colonel Morrison at Aldershot.",
  timeLimitMinutes: 180,
  startTime: "11:45 PM",
  winConditions: {
    requiredWeapon: "The sight of Sherlock David (Shock/Apoplexy)",
    requiredSuspect: "Sherlock David",
    requiredMotive: "Morrison betrayed David during the Indian Mutiny to steal Simpson Bathsheba."
  },
  phases: [
    {
      id: 0,
      name: "The Late Night Visitor",
      objective: "Talk to Neill Bhurtee to learn the initial facts of the case, then travel to the Hallway at Lachine Villa (Aldershot).",
      unlockedLocations: ["Watson's Hearth"],
      unlockedCharacters: ["Neill Bhurtee"]
    },
    {
      id: 1,
      name: "The Locked Room",
      objective: "Investigate the Morning Room and the Lawn to figure out how the intruder entered and left the locked room.",
      unlockedLocations: ["Watson's Hearth", "Hallway", "Morning Room", "The Lawn"],
      unlockedCharacters: ["Neill Bhurtee", "Jackson Barclay"]
    },
    {
      id: 2,
      name: "The Neighbor's Secret",
      objective: "You found strange animal tracks and a missing key. Now, interrogate Miss Harry to trace Mrs. Morrison's steps before the murder.",
      unlockedLocations: ["Watson's Hearth", "Hallway", "Morning Room", "The Lawn", "Miss Harry's Villa"],
      unlockedCharacters: ["Neill Bhurtee", "Jackson Barclay", "Miss Harry"]
    },
    {
      id: 3,
      name: "The Crooked Man",
      objective: "Miss Harry revealed a confrontation with a deformed man named Sherlock on Hudson Street. Go there, find him, and extract the truth.",
      unlockedLocations: ["Watson's Hearth", "Hallway", "Morning Room", "The Lawn", "Miss Harry's Villa", "Hudson Street"],
      unlockedCharacters: ["Neill Bhurtee", "Jackson Barclay", "Miss Harry", "Sherlock David"]
    }
  ],
  locations: {
    "Watson's Hearth": {
      description: "Your cozy home. The fire is dying down, and the remains of your pipe sit on the table.",
      items: [],
      clues: ["Colonel Morrison was murdered in a locked room.", "His wife, Simpson Bathsheba, is the prime suspect."],
      sceneImage: null,
      asciiCache: null,
      baseAscii: `
+-------------------------+
|      [MANTLEPIECE]      |
|        ( )   ( )        |
|      __|||___|||__      |
|     [   FIRE      ]     |
|      \\  \\// //   /      |
+-------------------------+`,
      visualMetadata: {
        setting: "A warm, dimly lit Victorian study. Shadows dance from the dying fireplace.",
        connections: [
          { targetLocation: "Hallway", mechanism: "Front Door and Carriage", state: "accessible" }
        ],
        surfacesAndContainers: [
          { id: "Mantlepiece", type: "surface", spatialRelationship: "Above the fireplace on the North wall", objects: [] },
          { id: "Side Table", type: "surface", spatialRelationship: "Next to Watson's armchair", objects: [{ itemId: "Smoking Pipe", visibility: "visible", hiddenBy: null }] }
        ]
      }
    },
    "Hallway": {
      description: "Inside Lachine Villa. The door to the morning-room was locked from the inside. The servants heard screams here.",
      items: ["Housemaid's Duster"],
      clues: ["Voices heard inside: The wife yelled 'You coward!' repeatedly.", "The word 'Teddy' was shouted."],
      sceneImage: null,
      asciiCache: null,
      baseAscii: `
+-------------------------+
|      [LOCKED DOOR]      |
|         _||_            |
|        |    |           |
|        | O  |           |
|        |    |           |
+-------------------------+`,
      visualMetadata: {
        setting: "A high-ceilinged corridor outside the Morning Room. Gas lamps flicker anxiously.",
        connections: [
          { targetLocation: "Morning Room", mechanism: "Morning Room Door", state: "locked" },
          { targetLocation: "The Lawn", mechanism: "Front Entrance", state: "open" }
        ],
        surfacesAndContainers: [
          { id: "Morning Room Door", type: "surface", spatialRelationship: "End of the corridor", objects: [{ itemId: "Lock Mechanism", visibility: "visible", hiddenBy: null }] },
          { id: "Hall Stand", type: "surface", spatialRelationship: "Against the left wall", objects: [{ itemId: "Housemaid's Duster", visibility: "visible", hiddenBy: null }] }
        ]
      }
    },
    "Morning Room": {
      description: "The murder scene. French windows open to the lawn. Colonel Morrison lies dead, his head struck upon the fender. His face is frozen in pure horror.",
      items: ["Wooden Club", "Tea Cup"],
      clues: ["The door key is missing.", "The head wound matches the fender, not the club.", "He died of extreme shock before hitting the ground."],
      sceneImage: null,
      asciiCache: null,
      baseAscii: `
+-------[FRENCH WINDOW]---+
|            |            |
|  [CLUB]    |            |
|       _O_  |            |
|      / | \\ [FENDER]     |
|  [BODY]                 |
+-------------------------+`,
      visualMetadata: {
        setting: "Opulent sitting room. The night breeze blows the curtains inward through open French windows.",
        connections: [
          { targetLocation: "Hallway", mechanism: "Heavy oak door", state: "locked from inside" },
          { targetLocation: "The Lawn", mechanism: "French windows", state: "open" }
        ],
        surfacesAndContainers: [
          { id: "Floor", type: "surface", spatialRelationship: "Center of room", objects: [{ itemId: "Colonel's Body", visibility: "visible", hiddenBy: null }, { itemId: "Wooden Club", visibility: "visible", hiddenBy: null }] },
          { id: "Fireplace Fender", type: "surface", spatialRelationship: "East wall", objects: [{ itemId: "Blood Splatter", visibility: "visible", hiddenBy: null }] },
          { id: "Sofa Table", type: "surface", spatialRelationship: "Near the locked door", objects: [{ itemId: "Tea Cup", visibility: "visible", hiddenBy: null }] },
          { id: "Window Curtains", type: "surface", spatialRelationship: "Framing the French windows", objects: [{ itemId: "Animal Tracks", visibility: "partially hidden", hiddenBy: "Folds of the fabric" }] },
          { id: "Inside Door Lock", type: "container", spatialRelationship: "On the heavy oak door", objects: [{ itemId: "Missing Door Key", visibility: "hidden", hiddenBy: "It was taken away" }] }
        ]
      }
    },
    "The Lawn": {
      description: "Thirty yards of grass dividing the house from the high-road. A low wall bounds it.",
      items: ["Muddy Prints"],
      clues: ["Five distinct human footmarks coming from the road.", "Small, 15-inch long animal tracks with claws (carnivorous).", "Animal tracks lead up the window curtains."],
      sceneImage: null,
      asciiCache: null,
      baseAscii: `
+-------------------------+
|      [HIGH ROAD]        |
|  ====================   |
|      :: prints ::       |
|  .. animal tracks ..    |
|      [MORNING ROOM]     |
+-------------------------+`,
      visualMetadata: {
        setting: "Dark, damp grass under a cloudy night sky. A low stone wall separates it from the muddy road.",
        connections: [
          { targetLocation: "Morning Room", mechanism: "French windows", state: "open" },
          { targetLocation: "Miss Harry's Villa", mechanism: "Gravel path", state: "open" },
          { targetLocation: "Hudson Street", mechanism: "High-road over the wall", state: "open" }
        ],
        surfacesAndContainers: [
          { id: "Soft Mud", type: "surface", spatialRelationship: "Between the wall and the windows", objects: [{ itemId: "Muddy Prints", visibility: "visible", hiddenBy: null }, { itemId: "Animal Tracks", visibility: "visible", hiddenBy: null }] }
        ]
      }
    },
    "Miss Harry's Villa": {
      description: "The neighboring house. Miss Harry lives here.",
      items: [],
      clues: ["Mrs. Morrison met a deformed man on Hudson Street earlier.", "The man yelled 'My God, it's Simpson!'", "Mrs. Morrison called him 'Sherlock'."],
      sceneImage: null,
      asciiCache: null,
      baseAscii: `
+-------------------------+
|        [VILLA]          |
|          _              |
|         / \\             |
|        |   |            |
|        |___|            |
+-------------------------+`,
      visualMetadata: {
        setting: "A tidy, modest parlor in the neighboring villa.",
        connections: [
          { targetLocation: "The Lawn", mechanism: "Front Door", state: "open" }
        ],
        surfacesAndContainers: [
          { id: "Sofa", type: "surface", spatialRelationship: "Center of parlor", objects: [] }
        ]
      }
    },
    "Hudson Street": {
      description: "A quiet thoroughfare with a single lamp. Lodgings for entertainers.",
      items: ["Animal Hutch", "Indian Rupee"],
      clues: ["Sherlock David lodges here with a mongoose named Uriah.", "He pays with Indian currency."],
      sceneImage: null,
      asciiCache: null,
      baseAscii: `
+-------------------------+
|         [LAMP]          |
|           |             |
|           O             |
|   [HUTCH]               |
|          [LODGINGS]     |
+-------------------------+`,
      visualMetadata: {
        setting: "A dingy, cramped lodging room. A single fire burns in the grate making it suffocatingly hot.",
        connections: [
          { targetLocation: "The Lawn", mechanism: "Street path", state: "open" }
        ],
        surfacesAndContainers: [
          { id: "Wooden Hutch", type: "container", spatialRelationship: "In the dark corner of the room", objects: [{ itemId: "Animal Hutch", visibility: "visible", hiddenBy: null }, { itemId: "Mongoose", visibility: "hidden", hiddenBy: "Inside the hutch" }] },
          { id: "Landlady's Cashbox", type: "container", spatialRelationship: "Downstairs desk", objects: [{ itemId: "Indian Rupee", visibility: "hidden", hiddenBy: "Inside the closed box" }] }
        ]
      }
    }
  },
  characters: {
    "Neill Bhurtee": {
      type: "assistant",
      role: "Consulting Detective",
      location: "Watson's Hearth", 
      phaseLocations: { 0: "Watson's Hearth", 1: "Morning Room", 2: "Morning Room", 3: "Morning Room" },
      persona: "Sharp, observant, completely composed. He already suspects the police have the wrong angle.",
      abilities: "Can provide the initial briefing and accompany you to evaluate clues.",
      knowledgeAboutOthers: {
        "Colonel Morrison": "A decorated soldier, but prone to dark moods.",
        "Simpson Bathsheba": "The prime suspect, currently incapacitated by brain fever."
      },
      secret: "",
      conditionalBehaviors: [],
      suspicionMeter: 0
    },
    "Jackson Barclay": {
      type: "assistant",
      role: "Housemaid",
      location: "Hallway",
      phaseLocations: { 0: "Hallway", 1: "Hallway", 2: "Hallway", 3: "Hallway" },
      persona: "Terrified, shaking. Eager to help but easily spooked.",
      abilities: "Can recount exact timelines and sounds from the house.",
      knowledgeAboutOthers: {
        "Colonel Morrison": "He and the missus rarely fought, until tonight.",
        "Simpson Bathsheba": "She came home from the Guild meeting very agitated."
      },
      secret: "",
      conditionalBehaviors: [],
      suspicionMeter: 0
    },
    "Miss Harry": {
      type: "suspect",
      role: "Neighbor",
      location: "Miss Harry's Villa",
      phaseLocations: { 0: "Miss Harry's Villa", 1: "Miss Harry's Villa", 2: "Miss Harry's Villa", 3: "Miss Harry's Villa" },
      persona: "A little, ethereal slip of a girl, but shrewd. Defensive of her friend Mrs. Morrison.",
      knowledgeAboutOthers: {
        "Simpson Bathsheba": "We went to the Guild meeting together. She is innocent.",
        "Colonel Morrison": "A respectable man, though quite possessive."
      },
      secret: "She saw Mrs. Morrison confront a deformed man named Sherlock on Hudson Street.",
      conditionalBehaviors: [
        {
          applicablePhases: [1, 2, 3],
          requiredEvidence: [],
          requiredKnowledge: ["Voices heard inside: The wife yelled 'You coward!' repeatedly."],
          reaction: "She becomes defensive, claiming couples fight but it doesn't mean murder.",
          leadsToBreak: false
        },
        {
          applicablePhases: [2, 3],
          requiredEvidence: [],
          requiredKnowledge: ["The door key is missing.", "Small, 15-inch long animal tracks with claws (carnivorous)."],
          reaction: "She realizes the police are completely lost and breaks her promise to Mrs. Morrison, revealing the encounter on Hudson Street to save her friend.",
          leadsToBreak: true
        }
      ],
      suspicionMeter: 30,
      flightRisk: 0
    },
    "Sherlock David": {
      type: "suspect",
      role: "The Crooked Man",
      location: "Hudson Street",
      phaseLocations: { 0: "Hudson Street", 1: "Hudson Street", 2: "Hudson Street", 3: "Hudson Street" },
      persona: "Deformed, bent back, yellow-shot eyes. A former soldier twisted by torture. Fierce but honorable.",
      knowledgeAboutOthers: {
        "Simpson Bathsheba": "The finest girl that ever had the breath of life between her lips.",
        "Colonel Morrison": "A traitor and a coward."
      },
      secret: "He is Corporal David. Morrison betrayed him in India to steal Simpson. David confronted him tonight, and Morrison died of pure fright. David took the key to cover his tracks.",
      conditionalBehaviors: [
        {
          applicablePhases: [3],
          requiredEvidence: ["Indian Rupee"],
          requiredKnowledge: [],
          reaction: "He claims it's just a prop he uses for his magic tricks in the canteens.",
          leadsToBreak: false
        },
        {
          applicablePhases: [3],
          requiredEvidence: [],
          requiredKnowledge: ["Small, 15-inch long animal tracks with claws (carnivorous).", "Sherlock David lodges here with a mongoose named Uriah."],
          reaction: "He introduces his mongoose, Uriah, but insists he hasn't been near Lachine Villa.",
          leadsToBreak: false
        },
        {
          applicablePhases: [3],
          requiredEvidence: ["Indian Rupee"],
          requiredKnowledge: ["The word 'Teddy' was shouted.", "Mrs. Morrison met a deformed man on Hudson Street earlier.", "Small, 15-inch long animal tracks with claws (carnivorous)."],
          reaction: "He proudly confesses his true identity, the betrayal in India, and how the Colonel's guilty conscience killed him. He admits he took the key.",
          leadsToBreak: true
        }
      ],
      suspicionMeter: 60,
      flightRisk: 10
    }
  }
};

```

## Part 3: Core Interaction Workflows

### 1. Narrative Progression (Phase Manager)

- **The Problem**: Open-world LLM games often lack pacing, resulting in the player wandering aimlessly or solving the case in two prompts.
- **The Solution**: The `Phase` array in the schema acts as a state machine.
- **Execution**: Every time the player executes a world action or finishes a conversation, a "Silent Check" is run against the Gamemaker Oracle. The Oracle compares the `Player State` (Inventory/Clues/Epiphanies) against the current `Phase.objective`. If the LLM determines the objective logic is satisfied, it returns `"advancePhase": true`. The Engine then shifts to the next Phase, which immediately unlocks new `locations` and `characters` according to the schema, simulating narrative time passing.

### 2. Character Interaction (Contradiction Engine)

- **The Problem**: Chatbots easily give up their secrets if prompted cleverly (Prompt Injection).
- **The Solution**: The `ConditionalBehavior` dependency graph.
- **Execution**: When the player interrogates a character, the Character Agent receives the player's *exact* inventory and discovered clues. The Agent is explicitly instructed to evaluate the `conditional_behaviors` array.
    - If the player says "I know you did it" but their inventory does NOT contain the `required_evidence`, the Agent relies on its `persona` to lie and raises the `suspicionMeter`.
    - If the player types "Present Evidence: [Item]" and it matches the requirements, the Agent executes the pre-defined `reaction`. If `leadsToBreak` is true, the Agent sets `isBroken: true`, overriding its defenses and spilling its `secret`.

### 3. Dynamic Scene Generation

- **The Problem**: Text games lack visual immersion, but generating images blindly from text descriptions results in spatial inconsistencies (e.g., a door moving from the left wall to the right wall between turns).
- **The Solution**: The `VisualMetadata` hierarchical structure.
- **Execution**: The room is defined mathematically (Surfaces -> Objects -> Visibility). If the player types "take the gun from the desk", the Gamemaker Oracle returns a mutated `VisualMetadata` object (removing the gun from the desk's array). A `useEffect` hook in React observes this mutation. It serializes the new metadata into a strict text prompt and sends it to the `gemini-2.5-flash-image-preview` API, generating a visually consistent representation of the room that respects the player's physical alterations.

## Feature Specs (UI, UX, Backend, Data management and UI)

- IAM
- Custom case scenario generation
- Case gallery with famous cases and difficulty tags
- Case sharing (public, private, unlisted)
- Co-op mode
- Discord bot
- Leaderboard based on time taken to solve cases, elo scores or difficulty based aggregate scores and individual case bell curves and overall ratings (similar to leetcode but for deductive reasoning)
- LLM arena type AI benchmark for deductive reasoning
- Tts with assistant (watson) who interacts with the backend agentic game maker and the game so user can directly talk to Watson and Watson interacts with the game. User can talk to Watson and Watson can give hints too. Handling for coop mode where Watson can scribe notes based on discussions and then use it to interact with the game based on the team discussions

## UI/UX → User journey

- Login
- User lands on the Mistry home page. This contains the home feed which is a case gallery with the following:
    - A curated set of first party cases
        - These contain famous whodunit stories from authors like Arthur conan doyle, Agatha christie and so on so that the users can solve the stories in an immersive format.
    - A for you feed, which shows popular public cases developed by other users and private cases shared by their friends and people they follow
    - Users can like and share the cases
- The user can click into any of the cases, where they will see:
    - The title, description, author and other metadata (likes, comments etc)
    - A comment section to comment about the case
    - A leaderboard which shows the time taken to solve the case in the first attempt by the different players. This time taken is basically the in-game time which is tracked by the game engine during the gameplay, not the real-world time.
    - The user can click on “Start Case” to begin solving the case. (Full user journey for solving the case is described in the )
- A friend list page
- A case studio page
    - This feature allows the user to use our AI studio to generate and host new cases which can be made public, private or unlisted.
    - This page also allows the user to edit and manage their previously generated projects.
    - Keep it a WIP for now, we will implement it later.

### IAM

- Sign in with Google
- All user related data should associated with the account.

## Backend and DB

- The backend will be a fastapi router which can handle the different business logic of the app
- It imports the LLM provider and agent SDK we develop and use it for different cases
- DB should contain handling of key data like all the available cases, users, IAM, friend lists, likes, dislikes, comments etc, case progress for each user(s), custom created cases and scenarios, co-op specific logic and so on

## LLM providers and agents

- Use langgraph deepagent for all agentic handling
- Support models from the following providers:
    - OpenAI API
    - Mistral API
    - Gemini API
    - OpenRouter
    - Hugginface inference
- The LLMs should be able to be registered by adding the api key, api endpoint, model name and all other required information in the .env
- The registered LLMs can then be assigned to different agent roles as required. This LLM agent module should be a separately maintained pip package which can be imported into different services and backends. It should expose the LLMs at different levels:
    - Provider level (Just register the LLM and make raw model calls)
    - Agent level (Abstracted with deepagent)
- The agentic logic should optimally and efficiently use the deepagent SDK and its offerings where possible.

## Case Solving

- A UI to support playing each case when the user clicks into it.
- Assume that there exists a image generation module which takes in the visual metadata and returns an image for the scene image generation part
- Support UI and UX for
    - Taking actions, interactions
    - Store the evidence
    - Store, edit and collaborate on the clues and notes
        - These clues are auto generated when uncovered, and there is also a canvas for the user to write their own notes
        - In co-op mode, multiples users should be able to edit this board
    - Show the entities present
    - Show hints optionally (For starters, these hints can be the phase objectives)
    - Show the current in-game time and the time limit
    - Voice input (TBD later): users can interact and take actions in voice, which is then trasbribed into actions by the voice agent. in co-op mode, this voice agent can be imported as a discord bot in the future and transcribe speech from multiple players and then convert it into actions when prompted.
    - Save user progress so that users can return to a case later
- Also implement and design other UI/UX and backend features so that we can support the full extent of the game capabilities as designed.

## Co-Op mode

- Collaborative solving of the problem
- Single input → All players work together but as a single detective in the scenario. Only a single action is taken collectively at a time. Players can optionally suggest actions and vote on which to take in the collaborative canvas and that action is taken if it gets majority votes.

## Voice and Discord

- Discord integration → We plan to use a speech to text model which will be available as a discord bot which can be brought into discord servers and used to scribe voice interactions with the players and convert them into actions. The player(s) will still need to approve the action before it is taken

## Deployment and Scaling

- Design everything as modular packages which can be imported in the backend.
- Use observability and telemetry from langfuse
- Use deepagent for model calling
- LLMs used for different agents should be configurable
- Use feature flags and config files so that everything can be managed from a single .env file and a config.yaml file
- Agent prompts should be comprehensive, clear and aligned with the agentic and product goals.
- Use in memory caching and a NoSQL DB for data management
- Maintain a complete system diagram and documentation in [README.md](http://README.md) with full behavioural details