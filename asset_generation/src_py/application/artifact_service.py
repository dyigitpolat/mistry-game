from __future__ import annotations

import asyncio
import os

from src_py.application.ports import CachePort, RendererPort
from src_py.domain.rendering import CacheRecord, RenderArtifact, RenderProfile, RenderRequest, RenderVariantRequest


class ArtifactService:
    def __init__(
        self,
        renderer: RendererPort,
        cache: CachePort,
        max_concurrency: int | None = None,
    ) -> None:
        self._renderer = renderer
        self._cache = cache
        configured = max_concurrency or int(os.getenv("ASSET_RENDER_CONCURRENCY", "8"))
        self._max_concurrency = max(1, configured)

    async def render_many(
        self,
        requests: list[RenderRequest],
        profile: RenderProfile,
    ) -> tuple[dict[str, RenderArtifact], int, int]:
        artifacts: dict[str, RenderArtifact] = {}
        misses = 0

        # No cross-request cache reuse: dedupe only within the current request.
        pending: dict[str, tuple[RenderRequest, str]] = {}
        for request in requests:
            fingerprint = request.fingerprint(profile)
            dedupe_key = f"{request.key}:{fingerprint}"
            if dedupe_key not in pending:
                pending[dedupe_key] = (request, fingerprint)

        if not pending:
            return artifacts, 0, 0

        semaphore = asyncio.Semaphore(self._max_concurrency)

        async def render_one(request: RenderRequest, fingerprint: str) -> tuple[str, RenderArtifact]:
            async with semaphore:
                artifact = await self._renderer.render(request, profile)
            await self._cache.set(
                CacheRecord(
                    key=request.key,
                    fingerprint=fingerprint,
                    artifact=artifact,
                )
            )
            return request.key, artifact

        jobs = [
            asyncio.create_task(render_one(request, fingerprint))
            for request, fingerprint in pending.values()
        ]
        results = await asyncio.gather(*jobs)
        for key, artifact in results:
            artifacts[key] = artifact
        misses = len(results)
        return artifacts, 0, misses

    async def render_variant_groups(
        self,
        requests: list[RenderVariantRequest],
        profile: RenderProfile,
    ) -> tuple[dict[str, RenderArtifact], int]:
        if not requests:
            return {}, 0
        semaphore = asyncio.Semaphore(self._max_concurrency)
        artifacts: dict[str, RenderArtifact] = {}

        async def render_group(request: RenderVariantRequest) -> dict[str, RenderArtifact]:
            async with semaphore:
                return await self._renderer.render_variants(request, profile)

        jobs = [asyncio.create_task(render_group(request)) for request in requests]
        results = await asyncio.gather(*jobs)
        for bundle in results:
            artifacts.update(bundle)
        return artifacts, len(results)

    async def get_cached(self, key: str) -> RenderArtifact | None:
        record = await self._cache.get(key)
        return record.artifact if record else None
