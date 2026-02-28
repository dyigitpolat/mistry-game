from __future__ import annotations

import asyncio
import os

from src_py.application.ports import CachePort, RendererPort
from src_py.domain.rendering import CacheRecord, RenderArtifact, RenderProfile, RenderRequest, RenderVariantRequest
from src_py.infrastructure.debug_feed import add_preview_artifact


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

    async def _check_cache(self, fingerprint: str) -> RenderArtifact | None:
        get_fp = getattr(self._cache, "get_by_fingerprint", None)
        if get_fp is not None:
            record = await get_fp(fingerprint)
            if record is not None:
                return record.artifact
        return None

    async def render_many(
        self,
        requests: list[RenderRequest],
        profile: RenderProfile,
    ) -> tuple[dict[str, RenderArtifact], int, int]:
        artifacts: dict[str, RenderArtifact] = {}
        hits = 0

        pending: dict[str, tuple[RenderRequest, str]] = {}
        for request in requests:
            fingerprint = request.fingerprint(profile)
            cached = await self._check_cache(fingerprint)
            if cached is not None:
                rekeyed = cached.model_copy(update={"key": request.key})
                artifacts[request.key] = rekeyed
                hits += 1
                print(f"[artifact_service] cache_hit key={request.key}")
                continue
            dedupe_key = f"{request.key}:{fingerprint}"
            if dedupe_key not in pending:
                pending[dedupe_key] = (request, fingerprint)

        if not pending:
            return artifacts, hits, 0

        semaphore = asyncio.Semaphore(self._max_concurrency)

        async def render_one(request: RenderRequest, fingerprint: str) -> tuple[str, RenderArtifact]:
            async with semaphore:
                print(f"[artifact_service] render_one:start key={request.key}")
                artifact = await self._renderer.render(request, profile)
                print(f"[artifact_service] render_one:done key={request.key}")
            await self._cache.set(
                CacheRecord(
                    key=request.key,
                    fingerprint=fingerprint,
                    artifact=artifact,
                )
            )
            add_preview_artifact(key=request.key, mime_type=artifact.mime_type, content=artifact.content)
            return request.key, artifact

        jobs = [
            asyncio.create_task(render_one(request, fingerprint))
            for request, fingerprint in pending.values()
        ]
        results = await asyncio.gather(*jobs)
        for key, artifact in results:
            artifacts[key] = artifact
        misses = len(results)
        print(f"[artifact_service] render_many done: hits={hits} misses={misses}")
        return artifacts, hits, misses

    async def render_variant_groups(
        self,
        requests: list[RenderVariantRequest],
        profile: RenderProfile,
    ) -> tuple[dict[str, RenderArtifact], int]:
        if not requests:
            return {}, 0
        semaphore = asyncio.Semaphore(self._max_concurrency)
        artifacts: dict[str, RenderArtifact] = {}
        cache_hits = 0

        async def render_group(request: RenderVariantRequest) -> dict[str, RenderArtifact] | None:
            fingerprint = request.fingerprint(profile)
            expected_keys = [request.build_key(state) for state in request.states]
            cached_artifacts: dict[str, RenderArtifact] = {}
            all_hit = True
            for key in expected_keys:
                record = await self._cache.get(key)
                if record is not None:
                    cached_artifacts[key] = record.artifact
                else:
                    all_hit = False
                    break

            if all_hit and len(cached_artifacts) == len(expected_keys):
                print(f"[artifact_service] variant_cache_hit subject={request.subject_id}")
                for key, artifact in cached_artifacts.items():
                    add_preview_artifact(key=key, mime_type=artifact.mime_type, content=artifact.content)
                return cached_artifacts

            async with semaphore:
                print(
                    f"[artifact_service] render_group:start subject={request.subject_id} states={list(request.states.keys())}"
                )
                result = await self._renderer.render_variants(request, profile)
                print(f"[artifact_service] render_group:done subject={request.subject_id}")
                for key, artifact in result.items():
                    await self._cache.set(
                        CacheRecord(key=key, fingerprint=fingerprint, artifact=artifact)
                    )
                    add_preview_artifact(key=key, mime_type=artifact.mime_type, content=artifact.content)
                return result

        jobs = [asyncio.create_task(render_group(request)) for request in requests]
        results = await asyncio.gather(*jobs)
        for bundle in results:
            if bundle:
                artifacts.update(bundle)
        return artifacts, len(results)

    async def get_cached(self, key: str) -> RenderArtifact | None:
        record = await self._cache.get(key)
        return record.artifact if record else None
