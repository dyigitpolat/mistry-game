from __future__ import annotations

from src_py.application.artifact_service import ArtifactService
from src_py.application.world_use_cases import WorldService
from src_py.infrastructure.cache import InMemoryCache
from src_py.infrastructure.pydantic_ai_renderer import PydanticAiRenderer


def get_world_service() -> WorldService:
    # New instance per request: generation is stateless across requests.
    cache = InMemoryCache()
    renderer = PydanticAiRenderer()
    artifact_service = ArtifactService(renderer=renderer, cache=cache)
    return WorldService(artifact_service=artifact_service)
