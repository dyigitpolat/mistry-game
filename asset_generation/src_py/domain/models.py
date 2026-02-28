from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ObjectCategory(str, Enum):
    SURFACE = "surface"
    CONTAINER = "container"
    ITEM = "item"
    DECORATION = "decoration"


class ContainerState(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    LOCKED = "locked"


class PersonState(str, Enum):
    ALIVE = "alive"
    DEAD = "dead"


class ConnectionState(str, Enum):
    UNLOCKED = "unlocked"
    LOCKED = "locked"


class Connection(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location_id: str = Field(min_length=1)
    state: ConnectionState = ConnectionState.UNLOCKED


class Item(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    category: ObjectCategory
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    notes: str | None = None

    @model_validator(mode="after")
    def ensure_item_category(self) -> "Item":
        if self.category is not ObjectCategory.ITEM:
            raise ValueError("contained object must have category 'item'")
        return self


class GameObject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    category: ObjectCategory
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    notes: str | None = None
    state: ContainerState | None = None
    contains: list[Item] | None = None

    @model_validator(mode="after")
    def validate_category_rules(self) -> "GameObject":
        if self.category is ObjectCategory.ITEM:
            if self.state is not None:
                raise ValueError("items cannot define state")
            if self.contains:
                raise ValueError("items cannot contain nested objects")
        elif self.category is ObjectCategory.SURFACE:
            if self.state is not None:
                raise ValueError("surfaces cannot define state")
        elif self.category is ObjectCategory.CONTAINER:
            if self.state is None:
                raise ValueError("containers must define state")
        elif self.category is ObjectCategory.DECORATION:
            if self.state is not None:
                raise ValueError("decorations cannot define state")
            if self.contains:
                raise ValueError("decorations cannot contain nested objects")
        return self


class Person(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    notes: str | None = None
    state: PersonState = PersonState.ALIVE


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    connections: list[Connection] = Field(default_factory=list)
    people: list[Person] = Field(default_factory=list)
    objects: list[GameObject] = Field(default_factory=list)


class World(BaseModel):
    model_config = ConfigDict(extra="forbid")

    locations: dict[str, Location]

    @model_validator(mode="after")
    def validate_location_links(self) -> "World":
        if not self.locations:
            raise ValueError("world.locations must not be empty")
        known = set(self.locations.keys())
        for loc_id, loc in self.locations.items():
            for connection in loc.connections:
                if connection.location_id not in known:
                    raise ValueError(
                        f'location "{loc_id}" references unknown connection target "{connection.location_id}"'
                    )
        return self


class Grid(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rows: int = Field(ge=0)
    cols: int = Field(ge=0)


class LayoutLocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    row: int = Field(ge=0)
    col: int = Field(ge=0)
    gridW: int = Field(ge=1)
    gridH: int = Field(ge=1)
    gates: dict[str, bool]
    exits: dict[str, str]
    connectionStates: dict[str, ConnectionState]


class Layout(BaseModel):
    model_config = ConfigDict(extra="forbid")

    grid: Grid
    locations: dict[str, LayoutLocation]


class PlacementObject(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    w: int = Field(ge=1)
    h: int = Field(ge=1)


class PlacementPerson(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    x: int = Field(ge=0)
    y: int = Field(ge=0)


class PlacementRoom(BaseModel):
    model_config = ConfigDict(extra="forbid")

    objects: list[PlacementObject] = Field(default_factory=list)
    people: list[PlacementPerson] = Field(default_factory=list)


class Placement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rooms: dict[str, PlacementRoom]


class Diagnostics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    warnings: list[str] = Field(default_factory=list)
    provider: str


class CacheManifest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hits: int = 0
    misses: int = 0
    keys: list[str] = Field(default_factory=list)


class WorldHashEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")

    world_hash: str
    metadata: dict[str, Any] = Field(default_factory=dict)
