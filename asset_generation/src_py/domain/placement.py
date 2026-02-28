from __future__ import annotations

from pydantic import BaseModel

from .gates import gate_tiles, inside_gate_tiles
from .models import ObjectCategory, PlacementObject, PlacementPerson, PlacementRoom
from .policies import DIRS, GRID_H, GRID_W
from .randomness import seeded_random


class PlaceableObject(BaseModel):
    id: str
    category: ObjectCategory
    w: int | None = None
    h: int | None = None


class PlaceablePerson(BaseModel):
    id: str


def object_size(category: ObjectCategory) -> tuple[int, int]:
    if category in (ObjectCategory.CONTAINER, ObjectCategory.SURFACE):
        return (3, 3)
    if category is ObjectCategory.DECORATION:
        return (2, 2)
    return (1, 1)


def _gate_exclusion_zone(
    gates: dict[str, bool], gw: int, gh: int, margin: int = 3,
) -> set[tuple[int, int]]:
    """Tiles near gate openings that should stay clear for walkability."""
    cx, cy = gw // 2, gh // 2
    excluded: set[tuple[int, int]] = set()
    for d, active in gates.items():
        if not active:
            continue
        if d == "N":
            for x in range(cx - margin, cx + margin + 1):
                for y in range(0, margin + 1):
                    excluded.add((x, y))
        elif d == "S":
            for x in range(cx - margin, cx + margin + 1):
                for y in range(gh - margin - 1, gh):
                    excluded.add((x, y))
        elif d == "W":
            for x in range(0, margin + 1):
                for y in range(cy - margin, cy + margin + 1):
                    excluded.add((x, y))
        elif d == "E":
            for x in range(gw - margin - 1, gw):
                for y in range(cy - margin, cy + margin + 1):
                    excluded.add((x, y))
    return excluded


def _wall_adjacent_positions(
    gw: int, gh: int, w: int, h: int, depth: int = 1,
    excluded: set[tuple[int, int]] | None = None,
) -> list[tuple[int, int]]:
    """Collect interior positions within `depth` tiles of any wall, avoiding excluded tiles."""
    positions: list[tuple[int, int]] = []
    for x in range(1, gw - w):
        for y in range(1, gh - h):
            near_top = y <= depth
            near_bottom = y + h >= gh - 1 - depth
            near_left = x <= depth
            near_right = x + w >= gw - 1 - depth
            if not (near_top or near_bottom or near_left or near_right):
                continue
            if excluded:
                overlap = any(
                    (x + dx, y + dy) in excluded
                    for dy in range(h) for dx in range(w)
                )
                if overlap:
                    continue
            positions.append((x, y))
    return positions


def place_in_room(
    objects: list[PlaceableObject],
    people: list[PlaceablePerson],
    gates: dict[str, bool],
    room_seed: int,
) -> PlacementRoom:
    gw = GRID_W
    gh = GRID_H
    occupied = [[False for _ in range(gw)] for _ in range(gh)]

    for x in range(gw):
        occupied[0][x] = True
        occupied[gh - 1][x] = True
    for y in range(gh):
        occupied[y][0] = True
        occupied[y][gw - 1] = True

    for direction in DIRS:
        if gates.get(direction, False):
            for x, y in gate_tiles(direction, gw, gh):
                occupied[y][x] = False

    for x, y in inside_gate_tiles(gates, gw, gh):
        occupied[y][x] = True

    rng = seeded_random(room_seed)
    gate_excl = _gate_exclusion_zone(gates, gw, gh, margin=3)

    def can_place(x: int, y: int, w: int, h: int) -> bool:
        for dy in range(h):
            for dx in range(w):
                nx = x + dx
                ny = y + dy
                if nx < 0 or nx >= gw or ny < 0 or ny >= gh:
                    return False
                if occupied[ny][nx]:
                    return False
        return True

    def occupy(x: int, y: int, w: int, h: int) -> None:
        for dy in range(h):
            for dx in range(w):
                occupied[y + dy][x + dx] = True

    def _place_wall_biased(w: int, h: int, depth: int = 1) -> tuple[int, int] | None:
        candidates = _wall_adjacent_positions(gw, gh, w, h, depth, excluded=gate_excl)
        rng.shuffle(candidates)
        for cx, cy in candidates:
            if can_place(cx, cy, w, h):
                return (cx, cy)
        # Widen search if nothing found flush against walls
        wider = _wall_adjacent_positions(gw, gh, w, h, depth=3, excluded=gate_excl)
        rng.shuffle(wider)
        for cx, cy in wider:
            if can_place(cx, cy, w, h):
                return (cx, cy)
        return None

    placed_objects: list[PlacementObject] = []
    for obj in objects:
        default_w, default_h = object_size(obj.category)
        w = obj.w or default_w
        h = obj.h or default_h
        pos = _place_wall_biased(w, h)
        if pos:
            placed_objects.append(PlacementObject(id=obj.id, x=pos[0], y=pos[1], w=w, h=h))
            occupy(pos[0], pos[1], w, h)
        else:
            placed_objects.append(PlacementObject(id=obj.id, x=1, y=1, w=w, h=h))
            occupy(1, 1, w, h)

    placed_people: list[PlacementPerson] = []
    for person in people:
        pos = _place_wall_biased(2, 2)
        if pos:
            placed_people.append(PlacementPerson(id=person.id, x=pos[0], y=pos[1]))
            occupy(pos[0], pos[1], 2, 2)
        else:
            placed_people.append(PlacementPerson(id=person.id, x=1, y=2))
            occupy(1, 2, 2, 2)

    return PlacementRoom(objects=placed_objects, people=placed_people)
