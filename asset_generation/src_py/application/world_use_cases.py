from __future__ import annotations

import asyncio

from src_py.application.artifact_service import ArtifactService
from src_py.domain.contracts import InitializeWorldRequest, UpdateWorldRequest, WorldResponse, world_hash
from src_py.domain.layout import compute_world_layout
from src_py.domain.models import (
    CacheManifest,
    ContainerState,
    Diagnostics,
    ObjectCategory,
    PersonState,
    Placement,
    PlacementRoom,
    World,
)
from src_py.domain.policies import (
    GRID_H,
    GRID_W,
    object_render_description,
    object_view_box,
    person_render_description,
    person_view_box,
    visual_state_for_object,
)
from src_py.domain.placement import PlaceableObject, PlaceablePerson, object_size, place_in_room
from src_py.domain.rendering import (
    RenderArtifact,
    RenderRequest,
    RenderTargetFormat,
    RenderVariantRequest,
    SubjectType,
)
from src_py.domain.contracts import DecorationItem
from src_py.infrastructure.debug_feed import finish_preview_run, start_preview_run
from src_py.infrastructure.decoration_inference import suggest_decorations
from src_py.infrastructure.mood_inference import infer_room_moods


def _collect_render_requests(
    world: World,
    target_format: RenderTargetFormat,
) -> tuple[list[RenderRequest], list[RenderVariantRequest]]:
    requests: list[RenderRequest] = []
    variant_requests: list[RenderVariantRequest] = []
    for location_id, location in world.locations.items():
        for obj in location.objects:
            if obj.category is ObjectCategory.CONTAINER:
                states = {
                    "open": object_render_description(
                        obj.category, obj.description, obj.name, ContainerState.OPEN
                    ),
                    "closed_unlocked": object_render_description(
                        obj.category, obj.description, obj.name, ContainerState.CLOSED
                    ),
                    "closed_locked": object_render_description(
                        obj.category, obj.description, obj.name, ContainerState.LOCKED
                    ),
                }
                variant_requests.append(
                    RenderVariantRequest(
                        subject_type=SubjectType.WORLD_OBJECT,
                        subject_id=f"{location_id}:{obj.id}",
                        key_template=f"object:{location_id}:{obj.id}" + ":{state}",
                        states=states,
                        target_format=target_format,
                        view_box=object_view_box(obj.category),
                        metadata={"location_id": location_id, "object_id": obj.id, "category": obj.category.value},
                    )
                )
            else:
                visual_state = visual_state_for_object(obj.category, obj.state)
                object_key = f"object:{location_id}:{obj.id}:{visual_state}"
                requests.append(
                    RenderRequest(
                        key=object_key,
                        subject_type=SubjectType.WORLD_OBJECT,
                        subject_id=f"{location_id}:{obj.id}",
                        state=visual_state,
                        description=object_render_description(obj.category, obj.description, obj.name, obj.state),
                        target_format=target_format,
                        view_box=object_view_box(obj.category),
                        metadata={"location_id": location_id, "object_id": obj.id, "category": obj.category.value},
                    )
                )
            if obj.contains:
                for item in obj.contains:
                    item_key = f"item:{location_id}:{obj.id}:{item.id}"
                    requests.append(
                        RenderRequest(
                            key=item_key,
                            subject_type=SubjectType.WORLD_ITEM,
                            subject_id=f"{location_id}:{obj.id}:{item.id}",
                            state="closed",
                            description=item.description,
                            target_format=target_format,
                            view_box=object_view_box(ObjectCategory.ITEM),
                            metadata={"location_id": location_id, "parent_object_id": obj.id, "item_id": item.id},
                        )
                    )
        for person in location.people:
            variant_requests.append(
                RenderVariantRequest(
                    subject_type=SubjectType.WORLD_PERSON,
                    subject_id=f"{location_id}:{person.id}",
                    key_template=f"person:{location_id}:{person.id}" + ":{state}",
                    states={
                        "alive": person_render_description(person.description, PersonState.ALIVE),
                        "dead": person_render_description(person.description, PersonState.DEAD),
                    },
                    target_format=target_format,
                    view_box=person_view_box(),
                    metadata={"location_id": location_id, "person_id": person.id},
                )
            )
    return requests, variant_requests


def _build_placement(world: World, seed: int, gate_map: dict[str, dict[str, bool]]) -> Placement:
    rooms: dict[str, PlacementRoom] = {}
    for index, location_id in enumerate(sorted(world.locations.keys())):
        loc = world.locations[location_id]
        objects = []
        for obj in loc.objects:
            default_w, default_h = object_size(obj.category)
            objects.append(
                PlaceableObject(
                    id=obj.id,
                    category=obj.category,
                    w=default_w,
                    h=default_h,
                )
            )
        people = [PlaceablePerson(id=p.id) for p in loc.people]
        room_seed = seed + (index + 1) * 1000
        rooms[location_id] = place_in_room(objects, people, gate_map[location_id], room_seed)
    return Placement(rooms=rooms)


def _collect_decoration_render_requests(
    decorations: dict[str, list[DecorationItem]],
    target_format: RenderTargetFormat,
) -> list[RenderRequest]:
    requests: list[RenderRequest] = []
    for location_id, items in decorations.items():
        for item in items:
            requests.append(
                RenderRequest(
                    key=f"decor:{location_id}:{item.id}",
                    subject_type=SubjectType.WORLD_OBJECT,
                    subject_id=f"{location_id}:{item.id}",
                    state="default",
                    description=item.description,
                    target_format=target_format,
                    view_box=object_view_box(ObjectCategory.DECORATION),
                    metadata={
                        "location_id": location_id,
                        "decoration_id": item.id,
                        "category": "decoration",
                    },
                )
            )
    return requests


def _place_decorations(
    decorations: dict[str, list[DecorationItem]],
    placement: Placement,
    gate_map: dict[str, dict[str, bool]],
    seed: int,
) -> dict[str, list[DecorationItem]]:
    """Place decorations near walls, avoiding occupied tiles."""
    from src_py.domain.placement import _wall_adjacent_positions, object_size
    from src_py.domain.gates import gate_tiles, inside_gate_tiles
    from src_py.domain.randomness import seeded_random

    gw = GRID_W
    gh = GRID_H
    placed: dict[str, list[DecorationItem]] = {}

    for loc_idx, (loc_id, items) in enumerate(decorations.items()):
        if not items:
            placed[loc_id] = []
            continue

        occupied = [[False for _ in range(gw)] for _ in range(gh)]
        for x in range(gw):
            occupied[0][x] = True
            occupied[gh - 1][x] = True
        for y in range(gh):
            occupied[y][0] = True
            occupied[y][gw - 1] = True

        gates = gate_map.get(loc_id, {})
        for direction in ("N", "E", "S", "W"):
            if gates.get(direction, False):
                for x, y in gate_tiles(direction, gw, gh):
                    occupied[y][x] = False
        for x, y in inside_gate_tiles(gates, gw, gh):
            occupied[y][x] = True

        room_placement = placement.rooms.get(loc_id)
        if room_placement:
            for obj in room_placement.objects:
                for dy in range(obj.h):
                    for dx in range(obj.w):
                        ny, nx = obj.y + dy, obj.x + dx
                        if 0 <= ny < gh and 0 <= nx < gw:
                            occupied[ny][nx] = True
            for person in room_placement.people:
                for dy in range(2):
                    for dx in range(2):
                        ny, nx = person.y + dy, person.x + dx
                        if 0 <= ny < gh and 0 <= nx < gw:
                            occupied[ny][nx] = True

        dw, dh = object_size(ObjectCategory.DECORATION)
        rng = seeded_random(seed + (loc_idx + 100) * 777)
        candidates = _wall_adjacent_positions(gw, gh, dw, dh, depth=2)
        rng.shuffle(candidates)

        placed_items: list[DecorationItem] = []
        for item in items:
            for cx, cy in candidates:
                ok = True
                for dy in range(dh):
                    for dx in range(dw):
                        if occupied[cy + dy][cx + dx]:
                            ok = False
                            break
                    if not ok:
                        break
                if ok:
                    placed_items.append(item.model_copy(update={"x": cx, "y": cy, "w": dw, "h": dh}))
                    for dy in range(dh):
                        for dx in range(dw):
                            occupied[cy + dy][cx + dx] = True
                    candidates = [(x, y) for x, y in candidates if abs(x - cx) > 2 or abs(y - cy) > 2]
                    break

        placed[loc_id] = placed_items

    return placed


def _provider_name(artifacts: dict[str, RenderArtifact]) -> str:
    first = next(iter(artifacts.values()), None)
    if not first:
        return "unknown"
    return str(first.metadata.get("provider", "unknown"))


class WorldService:
    def __init__(self, artifact_service: ArtifactService) -> None:
        self._artifacts = artifact_service

    async def initialize_world(self, request: InitializeWorldRequest) -> WorldResponse:
        layout = compute_world_layout(request.world.locations, request.seed)
        gate_map = {loc_id: loc.gates for loc_id, loc in layout.locations.items()}
        placement = _build_placement(
            world=request.world,
            seed=request.seed,
            gate_map=gate_map,
        )
        render_requests, variant_requests = _collect_render_requests(request.world, request.target_format)
        expected = len(render_requests) + sum(len(v.states) for v in variant_requests)
        descriptions = {
            loc_id: loc.description for loc_id, loc in request.world.locations.items()
        }
        existing_objects: dict[str, list[str]] = {}
        for loc_id, loc in request.world.locations.items():
            names: list[str] = []
            for obj in loc.objects:
                names.append(obj.name)
                if obj.contains:
                    names.extend(item.name for item in obj.contains)
            existing_objects[loc_id] = names
        start_preview_run(expected_total=expected)
        try:
            (artifacts, _, _), (variant_artifacts, _), moods, raw_decorations = await asyncio.gather(
                self._artifacts.render_many(render_requests, request.profile),
                self._artifacts.render_variant_groups(variant_requests, request.profile),
                infer_room_moods(descriptions),
                suggest_decorations(descriptions, existing_objects=existing_objects),
            )
            artifacts.update(variant_artifacts)

            decorations = _place_decorations(raw_decorations, placement, gate_map, request.seed)
            decor_requests = _collect_decoration_render_requests(decorations, request.target_format)
            if decor_requests:
                decor_artifacts, _, _ = await self._artifacts.render_many(decor_requests, request.profile)
                artifacts.update(decor_artifacts)

            keys = sorted(artifacts.keys())
            response = WorldResponse(
                world=request.world,
                world_hash=world_hash(request.world),
                layout=layout,
                placement=placement,
                artifacts=artifacts,
                moods=moods,
                decorations=decorations,
                cache_manifest=CacheManifest(hits=0, misses=len(artifacts), keys=keys),
                diagnostics=Diagnostics(provider=_provider_name(artifacts), warnings=[]),
            )
            finish_preview_run(success=True)
            return response
        except Exception as exc:
            finish_preview_run(success=False, error=str(exc))
            raise

    async def update_world(self, request: UpdateWorldRequest) -> WorldResponse:
        if request.previous_world_hash and request.previous_world_hash != world_hash(request.world):
            raise ValueError("previous_world_hash does not match current world")
        render_requests, variant_requests = _collect_render_requests(request.world, request.target_format)
        expected = len(render_requests) + sum(len(v.states) for v in variant_requests)
        descriptions = {
            loc_id: loc.description for loc_id, loc in request.world.locations.items()
        }
        existing_objects_upd: dict[str, list[str]] = {}
        for loc_id, loc in request.world.locations.items():
            names: list[str] = []
            for obj in loc.objects:
                names.append(obj.name)
                if obj.contains:
                    names.extend(item.name for item in obj.contains)
            existing_objects_upd[loc_id] = names
        gate_map = {
            loc_id: loc.gates for loc_id, loc in request.layout.locations.items()
        }
        start_preview_run(expected_total=expected)
        try:
            (artifacts, _, _), (variant_artifacts, _), moods, raw_decorations = await asyncio.gather(
                self._artifacts.render_many(render_requests, request.profile),
                self._artifacts.render_variant_groups(variant_requests, request.profile),
                infer_room_moods(descriptions),
                suggest_decorations(descriptions, existing_objects=existing_objects_upd),
            )
            artifacts.update(variant_artifacts)

            decorations = _place_decorations(raw_decorations, request.placement, gate_map, 0)
            decor_requests = _collect_decoration_render_requests(decorations, request.target_format)
            if decor_requests:
                decor_artifacts, _, _ = await self._artifacts.render_many(decor_requests, request.profile)
                artifacts.update(decor_artifacts)

            keys = sorted(artifacts.keys())
            response = WorldResponse(
                world=request.world,
                world_hash=world_hash(request.world),
                layout=request.layout,
                placement=request.placement,
                artifacts=artifacts,
                moods=moods,
                decorations=decorations,
                cache_manifest=CacheManifest(hits=0, misses=len(artifacts), keys=keys),
                diagnostics=Diagnostics(provider=_provider_name(artifacts), warnings=[]),
            )
            finish_preview_run(success=True)
            return response
        except Exception as exc:
            finish_preview_run(success=False, error=str(exc))
            raise

    async def render_batch(
        self,
        requests: list[RenderRequest],
        profile,
    ) -> tuple[dict[str, RenderArtifact], CacheManifest, Diagnostics]:
        artifacts, hits, misses = await self._artifacts.render_many(requests, profile)
        return (
            artifacts,
            CacheManifest(hits=hits, misses=misses, keys=sorted(artifacts.keys())),
            Diagnostics(provider=_provider_name(artifacts), warnings=[]),
        )

    async def get_cached_artifact(self, key: str) -> RenderArtifact | None:
        return await self._artifacts.get_cached(key)
