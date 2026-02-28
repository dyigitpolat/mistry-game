from __future__ import annotations

from .policies import DIRS


def gate_tiles(direction: str, grid_w: int, grid_h: int) -> list[tuple[int, int]]:
    cx = grid_w // 2
    cy = grid_h // 2
    if direction == "N":
        return [(cx - 1, 0), (cx, 0)]
    if direction == "S":
        return [(cx - 1, grid_h - 1), (cx, grid_h - 1)]
    if direction == "W":
        return [(0, cy - 1), (0, cy)]
    if direction == "E":
        return [(grid_w - 1, cy - 1), (grid_w - 1, cy)]
    return []


def tile_inside_gate(direction: str, grid_w: int, grid_h: int) -> tuple[int, int]:
    cx = grid_w // 2
    cy = grid_h // 2
    if direction == "N":
        return (cx, 1)
    if direction == "S":
        return (cx, grid_h - 2)
    if direction == "W":
        return (1, cy)
    if direction == "E":
        return (grid_w - 2, cy)
    return (cx, cy)


def inside_gate_tiles(gates: dict[str, bool], grid_w: int, grid_h: int) -> set[tuple[int, int]]:
    out: set[tuple[int, int]] = set()
    for direction in DIRS:
        if gates.get(direction, False):
            out.add(tile_inside_gate(direction, grid_w, grid_h))
    return out
