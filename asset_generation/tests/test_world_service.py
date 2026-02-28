import pytest

from src_py.application.artifact_service import ArtifactService
from src_py.application.world_use_cases import WorldService
from src_py.domain.contracts import InitializeWorldRequest
from src_py.domain.models import World
from src_py.domain.rendering import ArtifactType, RenderArtifact
from src_py.infrastructure.cache import InMemoryCache


class FakeRenderer:
    def __init__(self) -> None:
        self.single_calls = 0
        self.variant_calls = 0

    async def render(self, request, profile):  # noqa: ANN001
        self.single_calls += 1
        return RenderArtifact(
            key=request.key,
            artifact_type=ArtifactType.VECTOR,
            mime_type="image/svg+xml",
            content=f"<svg>{request.key}</svg>",
            metadata={"provider": "fake"},
            version="v1",
        )

    async def render_variants(self, request, profile):  # noqa: ANN001
        self.variant_calls += 1
        return {
            request.build_key(state): RenderArtifact(
                key=request.build_key(state),
                artifact_type=ArtifactType.VECTOR,
                mime_type="image/svg+xml",
                content=f"<svg>{request.subject_id}:{state}</svg>",
                metadata={"provider": "fake"},
                version="v1",
            )
            for state in request.states.keys()
        }


def _sample_world() -> World:
    return World.model_validate(
        {
            "locations": {
                "room_1": {
                    "name": "Study",
                    "description": "A study",
                    "connections": [],
                    "people": [{"id": "p1", "name": "Ada", "description": "Detective"}],
                    "objects": [
                        {
                            "id": "desk",
                            "category": "surface",
                            "name": "Desk",
                            "description": "oak desk",
                            "contains": [{"id": "key", "category": "item", "name": "Key", "description": "small"}],
                        }
                    ],
                }
            }
        }
    )


@pytest.mark.asyncio
async def test_initialize_is_stateless_across_requests() -> None:
    renderer = FakeRenderer()
    cache = InMemoryCache()
    service = WorldService(artifact_service=ArtifactService(renderer=renderer, cache=cache))
    req = InitializeWorldRequest(world=_sample_world(), seed=0)

    first = await service.initialize_world(req)
    first_misses = first.cache_manifest.misses
    assert first_misses > 0
    assert "person:room_1:p1:alive" in first.artifacts
    assert "person:room_1:p1:dead" in first.artifacts

    second = await service.initialize_world(req)
    assert second.cache_manifest.hits == 0
    assert second.cache_manifest.misses == first_misses
    assert renderer.single_calls > 0
    assert renderer.variant_calls > 0
