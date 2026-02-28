from __future__ import annotations

from collections import deque

from .models import ConnectionState, Grid, Layout, LayoutLocation, Location
from .policies import DIRS, GRID_H, GRID_W, LAYOUT_GRID_COLS, LAYOUT_GRID_ROWS
from .randomness import seeded_random, shuffled

DELTAS = {"N": (-1, 0), "S": (1, 0), "E": (0, 1), "W": (0, -1)}


def compute_world_layout(locations: dict[str, Location], seed: int = 0) -> Layout:
    location_ids = list(locations.keys())
    if not location_ids:
        return Layout(grid=Grid(rows=0, cols=0), locations={})

    rng = seeded_random(seed)
    adjacency = _build_undirected_adjacency(locations)
    cell_to_id = _place_connected_nodes(location_ids, adjacency, rng)
    rows, cols, cell_to_id = _normalize_cells(cell_to_id)

    out: dict[str, LayoutLocation] = {}
    for (row, col), loc_id in cell_to_id.items():
        loc = locations[loc_id]
        connections = {c.location_id: c for c in loc.connections}
        gates = {d: False for d in DIRS}
        exits = {d: "" for d in DIRS}
        connection_states = {d: ConnectionState.UNLOCKED for d in DIRS}

        for d in DIRS:
            dr, dc = DELTAS[d]
            neighbor = cell_to_id.get((row + dr, col + dc))
            if not neighbor:
                continue
            conn = connections.get(neighbor)
            if not conn:
                continue
            gates[d] = True
            exits[d] = neighbor
            connection_states[d] = conn.state

        out[loc_id] = LayoutLocation(
            row=row,
            col=col,
            gridW=GRID_W,
            gridH=GRID_H,
            gates=gates,
            exits=exits,
            connectionStates=connection_states,
        )

    return Layout(
        grid=Grid(rows=max(rows, LAYOUT_GRID_ROWS), cols=max(cols, LAYOUT_GRID_COLS)),
        locations=out,
    )


def _build_undirected_adjacency(locations: dict[str, Location]) -> dict[str, set[str]]:
    adjacency: dict[str, set[str]] = {loc_id: set() for loc_id in locations.keys()}
    for loc_id, loc in locations.items():
        for conn in loc.connections:
            if conn.location_id in adjacency:
                adjacency[loc_id].add(conn.location_id)
                adjacency[conn.location_id].add(loc_id)
    return adjacency


def _place_connected_nodes(
    location_ids: list[str],
    adjacency: dict[str, set[str]],
    rng,
) -> dict[tuple[int, int], str]:
    remaining = set(location_ids)
    ordered = shuffled(rng, location_ids)
    occupied: dict[tuple[int, int], str] = {}
    id_to_cell: dict[str, tuple[int, int]] = {}

    while remaining:
        # Start each disconnected component from a deterministic random node.
        root = next(loc_id for loc_id in ordered if loc_id in remaining)
        if occupied:
            root_cell = _nearest_free_cell_around_origin(set(occupied.keys()))
        else:
            root_cell = (0, 0)
        occupied[root_cell] = root
        id_to_cell[root] = root_cell
        remaining.remove(root)

        queue: deque[str] = deque([root])
        while queue:
            current = queue.popleft()
            current_cell = id_to_cell[current]
            neighbors = shuffled(rng, list(adjacency[current]))
            direction_order = shuffled(rng, list(DIRS))
            for neighbor in neighbors:
                if neighbor not in remaining:
                    continue
                target = _pick_cell_for_neighbor(neighbor, id_to_cell, adjacency, set(occupied.keys()), current_cell, direction_order)
                occupied[target] = neighbor
                id_to_cell[neighbor] = target
                remaining.remove(neighbor)
                queue.append(neighbor)
    return occupied


def _pick_cell_for_neighbor(
    node_id: str,
    id_to_cell: dict[str, tuple[int, int]],
    adjacency: dict[str, set[str]],
    occupied: set[tuple[int, int]],
    anchor: tuple[int, int],
    direction_order: list[str],
) -> tuple[int, int]:
    # First try cells adjacent to the current BFS node.
    for d in direction_order:
        dr, dc = DELTAS[d]
        candidate = (anchor[0] + dr, anchor[1] + dc)
        if candidate not in occupied:
            return candidate

    # Otherwise choose a free cell that maximizes adjacency to already-placed connected nodes.
    candidate_scores: list[tuple[int, int, int, tuple[int, int]]] = []
    placed_neighbors = [id_to_cell[n] for n in adjacency[node_id] if n in id_to_cell]
    if not placed_neighbors:
        return _nearest_free_cell_around_origin(occupied)

    seen: set[tuple[int, int]] = set()
    for nr, nc in placed_neighbors:
        for d in DIRS:
            dr, dc = DELTAS[d]
            candidate = (nr + dr, nc + dc)
            if candidate in occupied or candidate in seen:
                continue
            seen.add(candidate)
            score = sum((candidate[0] + dr2, candidate[1] + dc2) in placed_neighbors for dr2, dc2 in DELTAS.values())
            # Prefer higher score, then shorter distance to origin.
            manhattan = abs(candidate[0]) + abs(candidate[1])
            candidate_scores.append((-score, manhattan, candidate[0], candidate))

    if candidate_scores:
        candidate_scores.sort()
        return candidate_scores[0][3]
    return _nearest_free_cell_around_origin(occupied)


def _nearest_free_cell_around_origin(occupied: set[tuple[int, int]]) -> tuple[int, int]:
    if (0, 0) not in occupied:
        return (0, 0)
    radius = 1
    while True:
        for r in range(-radius, radius + 1):
            for c in range(-radius, radius + 1):
                if abs(r) + abs(c) != radius:
                    continue
                if (r, c) not in occupied:
                    return (r, c)
        radius += 1


def _normalize_cells(
    cell_to_id: dict[tuple[int, int], str]
) -> tuple[int, int, dict[tuple[int, int], str]]:
    rows = [row for row, _ in cell_to_id.keys()]
    cols = [col for _, col in cell_to_id.keys()]
    min_row, max_row = min(rows), max(rows)
    min_col, max_col = min(cols), max(cols)
    normalized: dict[tuple[int, int], str] = {}
    for (row, col), loc_id in cell_to_id.items():
        normalized[(row - min_row, col - min_col)] = loc_id
    total_rows = max_row - min_row + 1
    total_cols = max_col - min_col + 1
    return total_rows, total_cols, normalized
