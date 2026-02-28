from __future__ import annotations

from src_py.application.artifact_service import ArtifactService
from src_py.application.world_use_cases import WorldService
from src_py.infrastructure.cache import DiskCache
from src_py.infrastructure.fal_renderer import FalRenderer

_cache = DiskCache()
_renderer = FalRenderer()
_artifact_service = ArtifactService(renderer=_renderer, cache=_cache)


def get_world_service() -> WorldService:
    return WorldService(artifact_service=_artifact_service)


def get_cache_stats() -> dict[str, int]:
    return _cache.stats()
