# Game World JSON Protocol

## Overview

A single `locations` object defines the entire world: the location graph, connectivity, and all objects within each location — fully inline.

---

## Schema

```jsonc
{
  "locations": {
    "<location_id>": {
      "name": "string — display name",
      "description": "string — prose description of the location",
      "connections": [
        {
          "location_id": "string — target location ID",
          "state": "unlocked" | "locked"
        }
      ],
      "people": [
        {
          "id": "string — unique descriptive ID",
          "name": "string — display name",
          "description": "string — appearance and role",
          "notes": "string — AI context, personality, secrets",
          "state": "alive" | "dead"
        }
      ],
      "objects": [
        {
          "id": "string — unique descriptive instance ID",
          "category": "surface" | "container" | "item",
          "name": "string — display name",
          "description": "string — what this object looks like / is",
          "notes": "string — instance-specific flavor text / AI context",

          // containers only:
          "state": "open" | "closed" | "locked",

          // containers & surfaces only:
          "contains": [
            {
              "id": "string",
              "category": "item",
              "name": "string",
              "description": "string",
              "notes": "string"
            }
          ]
        }
      ]
    }
  }
}
```

### Rules

| Category    | Has `state`? | Has `contains`? | Can appear inside `contains`? |
|-------------|:------------:|:---------------:|:-----------------------------:|
| `surface`   | ✗            | ✓               | ✗                             |
| `container` | ✓            | ✓               | ✗                             |
| `item`      | ✗            | ✗               | ✓                             |

- **`state`** enum for containers: `"open"`, `"closed"`, `"locked"`
- **`state`** enum for connections: `"unlocked"`, `"locked"`
- **`state`** enum for people: `"alive"`, `"dead"`
- Items inside `contains` are full inline definitions.
- Items **not** inside any `contains` sit loose in the location's top-level `objects` array.
- `connections` defines a directed graph — if bidirectional travel is intended, both locations must list each other. Each connection has a `state` that can gate traversal.

---

## Example

```json
{
  "locations": {
    "loc_study": {
      "name": "The Study",
      "description": "A cramped room lined with overflowing bookshelves. Dust motes drift through a shaft of pale light from a narrow window. A heavy desk dominates the center of the room.",
      "connections": [
        { "location_id": "loc_hallway", "state": "unlocked" }
      ],
      "people": [],
      "objects": [
        {
          "id": "scholars_desk",
          "category": "surface",
          "name": "Scholar's Desk",
          "description": "A sturdy wooden desk with carved legs.",
          "notes": "Ink stains cover the surface. A half-written page sits under a paperweight.",
          "contains": [
            {
              "id": "unsent_letter",
              "category": "item",
              "name": "Unsent Letter",
              "description": "A folded piece of parchment sealed with wax.",
              "notes": "Addressed to someone called 'M.' — the handwriting is frantic."
            },
            {
              "id": "desk_key",
              "category": "item",
              "name": "Desk Key",
              "description": "A small iron key with an ornate bow.",
              "notes": "Etched with the initials 'R.H.' — fits something in this house."
            }
          ]
        },
        {
          "id": "east_bookshelf",
          "category": "surface",
          "name": "East Bookshelf",
          "description": "A tall bookshelf lined with dusty volumes.",
          "notes": "One book appears to be lodged in at an odd angle.",
          "contains": [
            {
              "id": "hidden_journal",
              "category": "item",
              "name": "Hidden Journal",
              "description": "A leather-bound journal with a fraying strap.",
              "notes": "Tucked behind a false row of book spines. The last entry is dated three weeks ago."
            }
          ]
        }
      ]
    },

    "loc_hallway": {
      "name": "The Hallway",
      "description": "A long, dimly lit corridor with peeling wallpaper. Portraits of stern-faced figures line the walls. Doors lead off in several directions.",
      "connections": [
        { "location_id": "loc_study", "state": "unlocked" },
        { "location_id": "loc_bedroom", "state": "unlocked" },
        { "location_id": "loc_kitchen", "state": "locked" }
      ],
      "people": [
        {
          "id": "mrs_hollow",
          "name": "Mrs. Hollow",
          "description": "A gaunt elderly woman in a faded nightgown, clutching a lantern.",
          "notes": "The housekeeper. She knows about the hidden journal but won't speak of it unless pressed. Deeply loyal to 'R.H.'",
          "state": "alive"
        }
      ],
      "objects": [
        {
          "id": "guttering_candle",
          "category": "item",
          "name": "Guttering Candle",
          "description": "A half-melted tallow candle.",
          "notes": "Sitting on the floor near the bedroom door. Almost burnt out."
        }
      ]
    },

    "loc_bedroom": {
      "name": "The Bedroom",
      "description": "A sparse room with a sagging bed and a locked chest at its foot. The window has been boarded shut from the inside.",
      "connections": [
        { "location_id": "loc_hallway", "state": "unlocked" }
      ],
      "people": [
        {
          "id": "dead_stranger",
          "name": "Unknown Man",
          "description": "A man in a traveling coat, slumped against the far wall. His face is obscured by shadow.",
          "notes": "Carrying a second letter addressed to 'M.' in his coat pocket. Died recently — the body is still warm.",
          "state": "dead"
        }
      ],
      "objects": [
        {
          "id": "old_bed",
          "category": "surface",
          "name": "Old Bed",
          "description": "A simple wooden-framed bed with a thin mattress.",
          "notes": "The sheets are rumpled, as if someone left in a hurry.",
          "contains": [
            {
              "id": "crumpled_note",
              "category": "item",
              "name": "Crumpled Note",
              "description": "A folded piece of parchment sealed with wax.",
              "notes": "Found under the pillow. Reads: 'They know. Leave tonight.'"
            }
          ]
        },
        {
          "id": "iron_chest",
          "category": "container",
          "name": "Iron Chest",
          "description": "A heavy iron-bound chest.",
          "notes": "The lock matches the key from the study.",
          "state": "locked",
          "contains": [
            {
              "id": "emergency_coin_pouch",
              "category": "item",
              "name": "Emergency Coin Pouch",
              "description": "A small drawstring pouch that clinks when shaken.",
              "notes": "Contains enough silver for passage on a coach."
            }
          ]
        }
      ]
    },

    "loc_kitchen": {
      "name": "The Kitchen",
      "description": "A cold kitchen with a dead hearth. The cupboards hang open, mostly bare. Something smells faintly of rot.",
      "connections": [
        { "location_id": "loc_hallway", "state": "locked" }
      ],
      "people": [],
      "objects": [
        {
          "id": "pantry_cupboard",
          "category": "container",
          "name": "Pantry Cupboard",
          "description": "A tall cupboard with double doors and brass handles.",
          "notes": "Nearly empty. A few dried herbs remain.",
          "state": "open",
          "contains": []
        },
        {
          "id": "corner_cupboard",
          "category": "container",
          "name": "Corner Cupboard",
          "description": "A tall cupboard with double doors and brass handles.",
          "notes": "This one is still shut. Something rattles inside when you push against the door.",
          "state": "closed",
          "contains": [
            {
              "id": "fresh_candle",
              "category": "item",
              "name": "Fresh Candle",
              "description": "A half-melted tallow candle.",
              "notes": "Unused. Someone stashed it here recently."
            }
          ]
        }
      ]
    }
  }
}
```

---

## Pydantic Model

```python
from __future__ import annotations
from enum import Enum
from pydantic import BaseModel


class ContainerState(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    LOCKED = "locked"


class ConnectionState(str, Enum):
    UNLOCKED = "unlocked"
    LOCKED = "locked"


class PersonState(str, Enum):
    ALIVE = "alive"
    DEAD = "dead"


class ObjectCategory(str, Enum):
    SURFACE = "surface"
    CONTAINER = "container"
    ITEM = "item"


class Item(BaseModel):
    id: str
    category: ObjectCategory = ObjectCategory.ITEM
    name: str
    description: str
    notes: str


class GameObject(BaseModel):
    id: str
    category: ObjectCategory
    name: str
    description: str
    notes: str
    state: ContainerState | None = None        # containers only
    contains: list[Item] | None = None         # containers & surfaces only


class Connection(BaseModel):
    location_id: str
    state: ConnectionState = ConnectionState.UNLOCKED


class Person(BaseModel):
    id: str
    name: str
    description: str
    notes: str
    state: PersonState = PersonState.ALIVE


class Location(BaseModel):
    name: str
    description: str
    connections: list[Connection] = []
    people: list[Person] = []
    objects: list[GameObject] = []


class GameWorld(BaseModel):
    locations: dict[str, Location]
```

---

## Design Notes

- Every object and person is fully self-described — no type lookups needed.
- The AI generates everything in a single pass: locations → people → objects → nested contents.
- Moving items at runtime: splice the full object out of one `contains` / `objects` and into another.
- Moving people at runtime: splice the full person out of one location's `people` and into another.
- `description` is the base "what it is" text; `notes` is the instance-specific context, flavor, or clue.
