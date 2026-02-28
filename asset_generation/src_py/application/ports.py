from __future__ import annotations

from typing import Protocol

from src_py.domain.rendering import CacheRecord, RenderArtifact, RenderProfile, RenderRequest, RenderVariantRequest


class RendererPort(Protocol):
    async def render(self, request: RenderRequest, profile: RenderProfile) -> RenderArtifact:
        ...

    async def render_variants(
        self,
        request: RenderVariantRequest,
        profile: RenderProfile,
    ) -> dict[str, RenderArtifact]:
        ...


class CachePort(Protocol):
    async def get(self, key: str) -> CacheRecord | None:
        ...

    async def set(self, record: CacheRecord) -> None:
        ...


class ArtifactServicePort(Protocol):
    async def render_many(
        self,
        requests: list[RenderRequest],
        profile: RenderProfile,
    ) -> tuple[dict[str, RenderArtifact], int, int]:
        ...
