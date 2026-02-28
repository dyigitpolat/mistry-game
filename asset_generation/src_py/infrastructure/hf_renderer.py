from __future__ import annotations

import asyncio
import base64
import io
import os
from collections import OrderedDict
from typing import Any

from src_py.application.ports import RendererPort
from src_py.domain.rendering import (
    ArtifactType,
    RenderArtifact,
    RenderProfile,
    RenderRequest,
    RenderTargetFormat,
    RenderVariantRequest,
)

PIXEL_ART_PROMPT_PREFIX = (
    "Pixel art game asset, clean silhouette, readable details, "
    "white background, centered subject, no text, no watermark."
)


class HfRenderer(RendererPort):
    def __init__(self) -> None:
        self._prompt_cache: OrderedDict[str, bytes] = OrderedDict()
        self._cache_lock: asyncio.Lock | None = None
        self._cache_max = max(0, int(os.getenv("ASSET_HF_PROMPT_CACHE_SIZE", "256")))

    async def render(self, request: RenderRequest, profile: RenderProfile) -> RenderArtifact:
        if request.target_format is not RenderTargetFormat.PNG:
            raise RuntimeError(
                f"Unsupported target_format={request.target_format.value}. Current renderer supports only PNG."
            )
        image = await self._generate_pil_image(_build_single_prompt(request), profile)
        generated_size = image.size
        generated_b64 = _png_to_base64(image)
        image = await self._remove_background(image)
        image = await self._trim_to_visible_bounds(image)
        processed_size = image.size
        payload_b64 = _png_to_base64(image)
        _validate_png_base64(payload_b64)
        metadata = {
            "provider": profile.provider,
            "model": profile.model,
            "style_profile": profile.style_profile,
            "state": request.state,
            "target_format": request.target_format.value,
        }
        if _debug_images_enabled():
            metadata["diagnostics"] = _debug_payload(
                stage="single",
                generated_png_base64=generated_b64,
                processed_png_base64=payload_b64,
                generated_size=generated_size,
                processed_size=processed_size,
            )
        return RenderArtifact(
            key=request.key,
            artifact_type=ArtifactType.RASTER,
            mime_type="image/png",
            content=payload_b64,
            metadata=metadata,
            version=profile.version,
        )

    async def render_variants(
        self,
        request: RenderVariantRequest,
        profile: RenderProfile,
    ) -> dict[str, RenderArtifact]:
        if request.target_format is not RenderTargetFormat.PNG:
            raise RuntimeError(
                f"Unsupported target_format={request.target_format.value}. Current renderer supports only PNG."
            )
        states = list(request.states.keys())
        if len(states) == 0:
            raise RuntimeError("Variant request has no states")

        # Generate only alive humans; derive dead as alpha silhouette.
        if (
            request.subject_type.value == "world_person"
            and "alive" in request.states
            and "dead" in request.states
        ):
            alive_desc = request.states["alive"]
            alive_prompt = (
                f"{PIXEL_ART_PROMPT_PREFIX} "
                f"{request.subject_type.value.replace('_', ' ')} {request.subject_id}. "
                f"{alive_desc}. "
                "single version only."
            )
            alive_img = await self._generate_pil_image(alive_prompt, profile)
            alive_img = await self._remove_background(alive_img)
            alive_img = await self._trim_to_visible_bounds(alive_img)
            dead_img = await self._dead_silhouette_from_alive(alive_img)
            alive_b64 = _png_to_base64(alive_img)
            dead_b64 = _png_to_base64(dead_img)
            _validate_png_base64(alive_b64)
            _validate_png_base64(dead_b64)
            return {
                request.build_key("alive"): RenderArtifact(
                    key=request.build_key("alive"),
                    artifact_type=ArtifactType.RASTER,
                    mime_type="image/png",
                    content=alive_b64,
                    metadata={
                        "provider": profile.provider,
                        "model": profile.model,
                        "style_profile": profile.style_profile,
                        "state": "alive",
                        "target_format": request.target_format.value,
                        **request.metadata,
                    },
                    version=profile.version,
                ),
                request.build_key("dead"): RenderArtifact(
                    key=request.build_key("dead"),
                    artifact_type=ArtifactType.RASTER,
                    mime_type="image/png",
                    content=dead_b64,
                    metadata={
                        "provider": profile.provider,
                        "model": profile.model,
                        "style_profile": profile.style_profile,
                        "state": "dead",
                        "derived_from": "alive_alpha_silhouette",
                        "target_format": request.target_format.value,
                        **request.metadata,
                    },
                    version=profile.version,
                ),
            }

        strip_prompt = _build_variant_strip_prompt(request)
        strip_image = await self._generate_pil_image(strip_prompt, profile)
        crops = _split_horizontal(strip_image, len(states))
        if len(crops) != len(states):
            raise RuntimeError("State strip crop failed: crop count does not match state count")

        async def process_one(state: str, crop):
            generated_crop_b64 = _png_to_base64(crop)
            fg = await self._remove_background(crop)
            fg = await self._trim_to_visible_bounds(fg)
            payload_b64 = _png_to_base64(fg)
            _validate_png_base64(payload_b64)
            key = request.build_key(state)
            metadata: dict[str, Any] = {
                "provider": profile.provider,
                "model": profile.model,
                "style_profile": profile.style_profile,
                "state": state,
                "target_format": request.target_format.value,
                **request.metadata,
            }
            if _debug_images_enabled():
                metadata["diagnostics"] = _debug_payload(
                    stage="variant",
                    generated_png_base64=generated_crop_b64,
                    processed_png_base64=payload_b64,
                    generated_size=crop.size,
                    processed_size=fg.size,
                )
            return key, RenderArtifact(
                key=key,
                artifact_type=ArtifactType.RASTER,
                mime_type="image/png",
                content=payload_b64,
                metadata=metadata,
                version=profile.version,
            )

        pairs = await asyncio.gather(*(process_one(state, crop) for state, crop in zip(states, crops)))
        artifacts: dict[str, RenderArtifact] = {key: artifact for key, artifact in pairs}
        return artifacts

    async def _generate_pil_image(self, prompt: str, profile: RenderProfile):
        token = os.getenv("HF_TOKEN")
        if not token:
            raise RuntimeError("HF_TOKEN is not set")
        cache_key = f"{profile.provider}|{profile.model}|{prompt}"
        cached = await self._prompt_cache_get(cache_key)
        if cached is not None:
            return _image_from_png_bytes(cached)

        def _run() -> Any:
            try:
                from huggingface_hub import InferenceClient
            except Exception as exc:
                raise RuntimeError("huggingface_hub is not available") from exc

            timeout_seconds = float(os.getenv("ASSET_HF_TIMEOUT_SECONDS", "90"))
            client = InferenceClient(provider=profile.provider, api_key=token, timeout=timeout_seconds)
            return client.text_to_image(prompt, model=profile.model)

        max_attempts = max(1, int(os.getenv("ASSET_HF_MAX_RETRIES", "3")))
        base_delay_seconds = max(0.05, float(os.getenv("ASSET_HF_RETRY_BASE_DELAY_SECONDS", "0.8")))

        last_error: Exception | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                print(f"[hf_renderer] text_to_image:start attempt={attempt}/{max_attempts}")
                image = await asyncio.to_thread(_run)
                if image is None:
                    raise RuntimeError("InferenceClient returned no image")
                print(f"[hf_renderer] text_to_image:done attempt={attempt}/{max_attempts}")
                await self._prompt_cache_set(cache_key, _image_to_png_bytes(image))
                return image
            except Exception as exc:
                last_error = exc
                print(f"[hf_renderer] text_to_image:error attempt={attempt}/{max_attempts} error={exc}")
                if _is_transient_timeout_error(exc) and attempt < max_attempts:
                    await asyncio.sleep(base_delay_seconds * attempt)
                    continue
                if _is_transient_timeout_error(exc):
                    raise RuntimeError(
                        f"HuggingFace image generation timed out after {max_attempts} attempts. "
                        "Try lowering ASSET_RENDER_CONCURRENCY or retry the request."
                    ) from exc
                raise RuntimeError(f"HuggingFace image generation failed: {type(exc).__name__}: {exc}") from exc

        raise RuntimeError(f"HuggingFace image generation failed: {last_error}")

    async def _remove_background(self, image):
        def _run() -> Any:
            try:
                from PIL import Image
                from rembg import remove
            except Exception as exc:
                raise RuntimeError(
                    "Background removal dependencies are missing. "
                    "Ensure `pillow`, `rembg`, and `onnxruntime` are installed in asset_generation/.venv. "
                    f"Original import error: {type(exc).__name__}: {exc}"
                ) from exc

            buffer = io.BytesIO()
            image.save(buffer, format="PNG")
            fg_bytes = remove(buffer.getvalue())
            fg = Image.open(io.BytesIO(fg_bytes))
            return fg.convert("RGBA")

        return await asyncio.to_thread(_run)

    async def _dead_silhouette_from_alive(self, image):
        def _run() -> Any:
            try:
                from PIL import Image
            except Exception as exc:
                raise RuntimeError("Pillow is not available for dead-silhouette generation") from exc

            rgba = image.convert("RGBA")
            alpha = rgba.getchannel("A")
            silhouette = Image.new("RGBA", rgba.size, (20, 20, 24, 0))
            silhouette.putalpha(alpha)
            # Subtle floor shadow for readability.
            shadow = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
            shadow_alpha = alpha.point(lambda a: min(110, int(a * 0.55)))
            shadow.putalpha(shadow_alpha)
            out = Image.alpha_composite(shadow, silhouette)
            return out

        return await asyncio.to_thread(_run)

    async def _prompt_cache_get(self, key: str) -> bytes | None:
        if self._cache_max <= 0:
            return None
        lock = self._get_cache_lock()
        async with lock:
            value = self._prompt_cache.get(key)
            if value is None:
                return None
            self._prompt_cache.move_to_end(key)
            return value

    async def _prompt_cache_set(self, key: str, png_bytes: bytes) -> None:
        if self._cache_max <= 0:
            return
        lock = self._get_cache_lock()
        async with lock:
            self._prompt_cache[key] = png_bytes
            self._prompt_cache.move_to_end(key)
            while len(self._prompt_cache) > self._cache_max:
                self._prompt_cache.popitem(last=False)

    def _get_cache_lock(self) -> asyncio.Lock:
        # Lazily create the lock while an event loop is running.
        # This avoids RuntimeError when the renderer is instantiated in a worker thread.
        if self._cache_lock is None:
            self._cache_lock = asyncio.Lock()
        return self._cache_lock

    async def _trim_to_visible_bounds(self, image):
        def _run() -> Any:
            try:
                from PIL import Image
            except Exception as exc:
                raise RuntimeError("Pillow is not available for alpha trimming") from exc

            rgba = image.convert("RGBA")
            alpha = rgba.getchannel("A")
            bbox = alpha.getbbox()
            if not bbox:
                return rgba
            pad = max(0, int(os.getenv("ASSET_ALPHA_CROP_PADDING_PX", "2")))
            left, top, right, bottom = bbox
            left = max(0, left - pad)
            top = max(0, top - pad)
            right = min(rgba.width, right + pad)
            bottom = min(rgba.height, bottom + pad)
            cropped = rgba.crop((left, top, right, bottom))

            min_side = max(1, int(os.getenv("ASSET_MIN_TRIMMED_SIDE_PX", "16")))
            if cropped.width < min_side or cropped.height < min_side:
                canvas = Image.new("RGBA", (max(cropped.width, min_side), max(cropped.height, min_side)), (0, 0, 0, 0))
                off_x = (canvas.width - cropped.width) // 2
                off_y = (canvas.height - cropped.height) // 2
                canvas.paste(cropped, (off_x, off_y))
                return canvas
            return cropped

        return await asyncio.to_thread(_run)


def _build_single_prompt(request: RenderRequest) -> str:
    person_hint = ""
    if request.subject_type.value == "world_person":
        person_hint = (
            " Character must be strongly separated from white background with thick dark outline and saturated colors. "
            "Avoid white/very-light clothing and avoid glow that blends into white."
        )
    return (
        f"{PIXEL_ART_PROMPT_PREFIX} "
        f"{request.description}. "
        f"state: {request.state}. "
        f"{person_hint}"
        "single version only."
    )


def _build_variant_strip_prompt(request: RenderVariantRequest) -> str:
    ordered_states = list(request.states.items())
    state_words = ", ".join(state for state, _ in ordered_states)
    state_instructions = " ".join(
        f"Panel {idx + 1} is '{state}' ({description})."
        for idx, (state, description) in enumerate(ordered_states)
    )
    return (
        f"{PIXEL_ART_PROMPT_PREFIX} "
        f"{request.subject_type.value.replace('_', ' ')} {request.subject_id}. "
        f"Create one horizontal sprite strip with exactly {len(ordered_states)} equal-width panels, left-to-right states: {state_words}. "
        f"{state_instructions} "
        "If subject is a person, ensure thick dark contour and strong color contrast from white background. "
        "Strict layout rules: one version per panel, no overlap across panels, no stacked rows, no cropped subject, "
        "uniform camera angle/scale across panels, and clear empty white separators between panels."
    )


def _split_horizontal(image, parts: int):
    if parts <= 0:
        return []
    width, height = image.size
    step = width / parts
    out = []
    left = 0.0
    for idx in range(parts):
        right = width if idx == parts - 1 else round((idx + 1) * step)
        box = (round(left), 0, max(round(left) + 1, right), height)
        out.append(image.crop(box))
        left = right
    return out


def _png_to_base64(image) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


def _validate_png_base64(payload_b64: str) -> None:
    try:
        raw = base64.b64decode(payload_b64, validate=True)
    except Exception as exc:
        raise RuntimeError("Generated content is not valid base64") from exc
    if len(raw) < 8 or raw[:8] != b"\x89PNG\r\n\x1a\n":
        raise RuntimeError("Generated artifact is not a valid PNG payload")


def _debug_images_enabled() -> bool:
    return os.getenv("ASSET_INCLUDE_DEBUG_IMAGES", "").lower() in {"1", "true", "yes", "on"}


def _is_transient_timeout_error(exc: Exception) -> bool:
    status_code = getattr(getattr(exc, "response", None), "status_code", None)
    if status_code in {408, 429, 500, 502, 503, 504}:
        return True
    msg = str(exc).lower()
    timeout_markers = (
        "gateway time-out",
        "gateway timeout",
        "readtimeout",
        "timed out",
        "temporarily unavailable",
    )
    return any(marker in msg for marker in timeout_markers)


def _debug_payload(
    stage: str,
    generated_png_base64: str,
    processed_png_base64: str,
    generated_size: tuple[int, int],
    processed_size: tuple[int, int],
) -> dict[str, Any]:
    return {
        "stage": stage,
        "generated_png_base64": generated_png_base64,
        "processed_png_base64": processed_png_base64,
        "generated_png_data_url": f"data:image/png;base64,{generated_png_base64}",
        "processed_png_data_url": f"data:image/png;base64,{processed_png_base64}",
        "generated_size": {"w": generated_size[0], "h": generated_size[1]},
        "processed_size": {"w": processed_size[0], "h": processed_size[1]},
    }


def _image_to_png_bytes(image) -> bytes:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    return buf.getvalue()


def _image_from_png_bytes(raw: bytes):
    from PIL import Image

    return Image.open(io.BytesIO(raw)).convert("RGBA")
