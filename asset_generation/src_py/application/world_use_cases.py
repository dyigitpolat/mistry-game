from __future__ import annotations

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
        placement = _build_placement(
            world=request.world,
            seed=request.seed,
            gate_map={loc_id: loc.gates for loc_id, loc in layout.locations.items()},
        )
        render_requests, variant_requests = _collect_render_requests(request.world, request.target_format)
        artifacts, _, _ = await self._artifacts.render_many(render_requests, request.profile)
        variant_artifacts, _ = await self._artifacts.render_variant_groups(variant_requests, request.profile)
        artifacts.update(variant_artifacts)
        keys = sorted(artifacts.keys())
        return WorldResponse(
            world=request.world,
            world_hash=world_hash(request.world),
            layout=layout,
            placement=placement,
            artifacts=artifacts,
            cache_manifest=CacheManifest(hits=0, misses=len(artifacts), keys=keys),
            diagnostics=Diagnostics(provider=_provider_name(artifacts), warnings=[]),
        )

    async def update_world(self, request: UpdateWorldRequest) -> WorldResponse:
        if request.previous_world_hash and request.previous_world_hash != world_hash(request.world):
            raise ValueError("previous_world_hash does not match current world")
        render_requests, variant_requests = _collect_render_requests(request.world, request.target_format)
        artifacts, _, _ = await self._artifacts.render_many(render_requests, request.profile)
        variant_artifacts, _ = await self._artifacts.render_variant_groups(variant_requests, request.profile)
        artifacts.update(variant_artifacts)
        keys = sorted(artifacts.keys())
        return WorldResponse(
            world=request.world,
            world_hash=world_hash(request.world),
            layout=request.layout,
            placement=request.placement,
            artifacts=artifacts,
            cache_manifest=CacheManifest(hits=0, misses=len(artifacts), keys=keys),
            diagnostics=Diagnostics(provider=_provider_name(artifacts), warnings=[]),
        )

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
