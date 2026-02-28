from __future__ import annotations

import base64

from fastapi import APIRouter, Body, Depends, HTTPException, Response
from pydantic import ValidationError

from src_py.api.dependencies import get_world_service
from src_py.application.world_use_cases import WorldService
from src_py.domain.contracts import (
    InitializeWorldRequest,
    RenderBatchRequest,
    RenderBatchResponse,
    UpdateWorldRequest,
    WorldResponse,
    coerce_world_payload,
)
from src_py.infrastructure.debug_feed import preview_snapshot

router = APIRouter(prefix="/v1")


@router.post("/worlds/initialize", response_model=WorldResponse)
async def initialize_world(
    payload: dict = Body(...),
    service: WorldService = Depends(get_world_service),
) -> WorldResponse:
    try:
        normalized_payload = {
            "world": coerce_world_payload(payload),
            "seed": payload.get("seed", 0),
            "target_format": payload.get("target_format", "png"),
            "profile": payload.get("profile", {}),
        }
        request = InitializeWorldRequest.model_validate(normalized_payload)
        return await service.initialize_world(request)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
    except RuntimeError as exc:
        detail = str(exc)
        status = 504 if "timed out" in detail.lower() else 502
        raise HTTPException(status_code=status, detail=detail) from exc


@router.post("/worlds/update", response_model=WorldResponse)
async def update_world(
    payload: dict = Body(...),
    service: WorldService = Depends(get_world_service),
) -> WorldResponse:
    try:
        normalized_payload = {
            "world": coerce_world_payload(payload),
            "layout": payload.get("layout"),
            "placement": payload.get("placement"),
            "previous_world_hash": payload.get("previous_world_hash"),
            "target_format": payload.get("target_format", "png"),
            "profile": payload.get("profile", {}),
        }
        request = UpdateWorldRequest.model_validate(normalized_payload)
        return await service.update_world(request)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=exc.errors()) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except RuntimeError as exc:
        detail = str(exc)
        status = 504 if "timed out" in detail.lower() else 502
        raise HTTPException(status_code=status, detail=detail) from exc


@router.post("/renders/batch", response_model=RenderBatchResponse)
async def render_batch(
    payload: RenderBatchRequest,
    service: WorldService = Depends(get_world_service),
) -> RenderBatchResponse:
    try:
        artifacts, manifest, diagnostics = await service.render_batch(payload.requests, payload.profile)
        return RenderBatchResponse(artifacts=artifacts, cache_manifest=manifest, diagnostics=diagnostics)
    except RuntimeError as exc:
        detail = str(exc)
        status = 504 if "timed out" in detail.lower() else 502
        raise HTTPException(status_code=status, detail=detail) from exc


@router.get("/renders/{render_key}")
async def get_render_by_key(
    render_key: str,
    service: WorldService = Depends(get_world_service),
) -> Response:
    artifact = await service.get_cached_artifact(render_key)
    if artifact is None:
        raise HTTPException(status_code=404, detail="render key not found")
    if artifact.mime_type == "image/png":
        try:
            raw = base64.b64decode(artifact.content, validate=True)
        except Exception as exc:
            raise HTTPException(status_code=500, detail="stored PNG payload is invalid base64") from exc
        return Response(content=raw, media_type="image/png")
    return Response(content=artifact.content, media_type=artifact.mime_type)


@router.get("/debug/previews")
async def get_debug_previews() -> dict:
    return preview_snapshot()
