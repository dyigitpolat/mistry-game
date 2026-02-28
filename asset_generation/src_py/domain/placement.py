from __future__ import annotations

from pydantic import BaseModel

from .gates import gate_tiles, inside_gate_tiles
from .models import ObjectCategory, PlacementObject, PlacementPerson, PlacementRoom
from .policies import DIRS, GRID_H, GRID_W
from .randomness import rand_int, seeded_random


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
    return (1, 1)


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

    placed_objects: list[PlacementObject] = []
    for obj in objects:
        default_w, default_h = object_size(obj.category)
        w = obj.w or default_w
        h = obj.h or default_h
        done = False
        for _ in range(80):
            x = rand_int(rng, 1, gw - 1 - w)
            y = rand_int(rng, 1, gh - 1 - h)
            if can_place(x, y, w, h):
                placed_objects.append(PlacementObject(id=obj.id, x=x, y=y, w=w, h=h))
                occupy(x, y, w, h)
                done = True
                break
        if not done:
            placed_objects.append(PlacementObject(id=obj.id, x=1, y=1, w=w, h=h))
            occupy(1, 1, w, h)

    placed_people: list[PlacementPerson] = []
    for person in people:
        done = False
        for _ in range(80):
            x = rand_int(rng, 1, gw - 3)
            y = rand_int(rng, 1, gh - 3)
            if can_place(x, y, 2, 2):
                placed_people.append(PlacementPerson(id=person.id, x=x, y=y))
                occupy(x, y, 2, 2)
                done = True
                break
        if not done:
            placed_people.append(PlacementPerson(id=person.id, x=1, y=2))
            occupy(1, 2, 2, 2)

    return PlacementRoom(objects=placed_objects, people=placed_people)
