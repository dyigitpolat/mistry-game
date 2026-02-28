from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response

from src_py.api.dependencies import get_world_service
from src_py.application.world_use_cases import WorldService
from src_py.domain.contracts import (
    InitializeWorldRequest,
    RenderBatchRequest,
    RenderBatchResponse,
    UpdateWorldRequest,
    WorldResponse,
)

router = APIRouter(prefix="/v1")


@router.post("/worlds/initialize", response_model=WorldResponse)
async def initialize_world(
    payload: InitializeWorldRequest,
    service: WorldService = Depends(get_world_service),
) -> WorldResponse:
    return await service.initialize_world(payload)


@router.post("/worlds/update", response_model=WorldResponse)
async def update_world(
    payload: UpdateWorldRequest,
    service: WorldService = Depends(get_world_service),
) -> WorldResponse:
    try:
        return await service.update_world(payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/renders/batch", response_model=RenderBatchResponse)
async def render_batch(
    payload: RenderBatchRequest,
    service: WorldService = Depends(get_world_service),
) -> RenderBatchResponse:
    artifacts, manifest, diagnostics = await service.render_batch(payload.requests, payload.profile)
    return RenderBatchResponse(artifacts=artifacts, cache_manifest=manifest, diagnostics=diagnostics)


@router.get("/renders/{render_key}")
async def get_render_by_key(
    render_key: str,
    service: WorldService = Depends(get_world_service),
) -> Response:
    artifact = await service.get_cached_artifact(render_key)
    if artifact is None:
        raise HTTPException(status_code=404, detail="render key not found")
    return Response(content=artifact.content, media_type=artifact.mime_type)
