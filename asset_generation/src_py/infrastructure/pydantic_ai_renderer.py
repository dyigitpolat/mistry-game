from __future__ import annotations

import os
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from src_py.application.ports import RendererPort
from src_py.domain.rendering import (
    ArtifactType,
    RenderArtifact,
    RenderProfile,
    RenderRequest,
    RenderTargetFormat,
    RenderVariantRequest,
)

SYSTEM_PROMPT = (
    "You are a senior game illustrator generating production SVG assets for a mystery game. "
    "Always return structured JSON matching the schema exactly. "
    "Style requirements: visually rich silhouettes, readable forms, layered depth, nuanced shading, "
    "high-contrast details, and coherent art direction across states of the same entity. "
    "Never include text labels, watermarks, or placeholder rectangles."
)


class StructuredRenderOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mime_type: str
    content: str = Field(min_length=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class StructuredVariantOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mime_type: str
    variants: dict[str, str]
    metadata: dict[str, Any] = Field(default_factory=dict)


class PydanticAiRenderer(RendererPort):
    def __init__(self) -> None:
        self._provider = os.getenv("ASSET_PROVIDER", "mistral")
        self._model = os.getenv("ASSET_MODEL", "mistral-large-latest")

    async def render(self, request: RenderRequest, profile: RenderProfile) -> RenderArtifact:
        output = await self._generate_structured_output(request, profile)
        artifact_type = ArtifactType.VECTOR if output.mime_type == "image/svg+xml" else ArtifactType.RASTER
        metadata = {
            **output.metadata,
            "provider": profile.provider,
            "model": profile.model,
            "style_profile": profile.style_profile,
        }
        return RenderArtifact(
            key=request.key,
            artifact_type=artifact_type,
            mime_type=output.mime_type,
            content=output.content.strip(),
            metadata=metadata,
            version=profile.version,
        )

    async def render_variants(
        self,
        request: RenderVariantRequest,
        profile: RenderProfile,
    ) -> dict[str, RenderArtifact]:
        output = await self._generate_variant_output(request, profile)
        if output.mime_type != "image/svg+xml":
            raise RuntimeError(f"Renderer returned unexpected mime type '{output.mime_type}' for SVG variants")
        artifacts: dict[str, RenderArtifact] = {}
        for state, content in output.variants.items():
            content = content.strip()
            _validate_svg_markup(content)
            artifacts[request.build_key(state)] = RenderArtifact(
                key=request.build_key(state),
                artifact_type=ArtifactType.VECTOR,
                mime_type="image/svg+xml",
                content=content,
                metadata={
                    **output.metadata,
                    "provider": profile.provider,
                    "model": profile.model,
                    "style_profile": profile.style_profile,
                    "state": state,
                },
                version=profile.version,
            )
        missing = set(request.states.keys()) - set(output.variants.keys())
        if missing:
            raise RuntimeError(f"Structured variant output missing states: {sorted(missing)}")
        return artifacts

    async def _generate_structured_output(
        self,
        request: RenderRequest,
        profile: RenderProfile,
    ) -> StructuredRenderOutput:
        if request.target_format is not RenderTargetFormat.SVG:
            raise RuntimeError(
                f"Unsupported target_format={request.target_format.value}. "
                "Current renderer supports only SVG."
            )
        if not _provider_key_present(profile.provider):
            raise RuntimeError(
                f"Missing API key for provider '{profile.provider}'. "
                "Set the provider key (e.g. MISTRAL_API_KEY)."
            )

        try:
            from pydantic_ai import Agent
        except Exception as exc:
            raise RuntimeError("pydantic-ai is not available in this environment") from exc

        model_ref = f"{profile.provider}:{profile.model}"
        prompt = _build_user_prompt(request, profile)
        agent = Agent(model=model_ref, output_type=StructuredRenderOutput, system_prompt=SYSTEM_PROMPT)
        try:
            result = await agent.run(prompt)
            output = getattr(result, "output", None) or getattr(result, "data", None)
            if isinstance(output, StructuredRenderOutput):
                validated = output
            elif isinstance(output, dict):
                validated = StructuredRenderOutput.model_validate(output)
            else:
                raise RuntimeError("PydanticAI did not return a structured render payload")
            return _validate_svg_payload(validated)
        except Exception as exc:
            raise RuntimeError(f"Structured generation failed: {exc}") from exc

    async def _generate_variant_output(
        self,
        request: RenderVariantRequest,
        profile: RenderProfile,
    ) -> StructuredVariantOutput:
        if request.target_format is not RenderTargetFormat.SVG:
            raise RuntimeError(
                f"Unsupported target_format={request.target_format.value}. "
                "Current renderer supports only SVG."
            )
        if not _provider_key_present(profile.provider):
            raise RuntimeError(
                f"Missing API key for provider '{profile.provider}'. "
                "Set the provider key (e.g. MISTRAL_API_KEY)."
            )
        try:
            from pydantic_ai import Agent
        except Exception as exc:
            raise RuntimeError("pydantic-ai is not available in this environment") from exc

        model_ref = f"{profile.provider}:{profile.model}"
        prompt = _build_variant_prompt(request, profile)
        agent = Agent(model=model_ref, output_type=StructuredVariantOutput, system_prompt=SYSTEM_PROMPT)
        try:
            result = await agent.run(prompt)
            output = getattr(result, "output", None) or getattr(result, "data", None)
            if isinstance(output, StructuredVariantOutput):
                validated = output
            elif isinstance(output, dict):
                validated = StructuredVariantOutput.model_validate(output)
            else:
                raise RuntimeError("PydanticAI did not return a structured variant payload")
            return _validate_variant_payload(validated, expected_states=set(request.states.keys()))
        except Exception as exc:
            raise RuntimeError(f"Structured variant generation failed: {exc}") from exc


def _provider_key_present(provider: str) -> bool:
    if provider == "mistral":
        return bool(os.getenv("MISTRAL_API_KEY"))
    if provider == "openai":
        return bool(os.getenv("OPENAI_API_KEY"))
    if provider == "anthropic":
        return bool(os.getenv("ANTHROPIC_API_KEY"))
    return False


def _validate_svg_payload(output: StructuredRenderOutput) -> StructuredRenderOutput:
    if output.mime_type != "image/svg+xml":
        raise RuntimeError(f"Renderer returned unexpected mime type '{output.mime_type}' for SVG request")
    content = output.content.strip()
    _validate_svg_markup(content)
    return StructuredRenderOutput(mime_type="image/svg+xml", content=content, metadata=output.metadata)


def _validate_variant_payload(output: StructuredVariantOutput, expected_states: set[str]) -> StructuredVariantOutput:
    if output.mime_type != "image/svg+xml":
        raise RuntimeError(f"Renderer returned unexpected mime type '{output.mime_type}' for SVG variants")
    if not output.variants:
        raise RuntimeError("Renderer returned empty variants object")
    for state, svg in output.variants.items():
        if state not in expected_states:
            raise RuntimeError(f"Renderer returned unexpected variant state '{state}'")
        _validate_svg_markup(svg.strip())
    missing = expected_states - set(output.variants.keys())
    if missing:
        raise RuntimeError(f"Renderer is missing required states: {sorted(missing)}")
    return output


def _validate_svg_markup(content: str) -> None:
    lower = content.lower()
    if "<svg" not in lower:
        raise RuntimeError("Renderer output is not valid SVG markup")
    if _looks_low_quality_placeholder(lower):
        raise RuntimeError("Renderer output rejected as low-quality placeholder SVG")


def _looks_low_quality_placeholder(lower_svg: str) -> bool:
    # Reject obvious fallback-like outputs and text-labeled placeholders.
    bad_patterns = [
        "<text",
        "placeholder",
        "world object",
        "generic object",
        "subject",
    ]
    return any(pattern in lower_svg for pattern in bad_patterns)


def _build_user_prompt(request: RenderRequest, profile: RenderProfile) -> str:
    view_box = request.view_box.model_dump() if request.view_box else None
    return (
        f"Render subject={request.subject_type.value} id={request.subject_id} "
        f"state={request.state} target_format={request.target_format.value}. "
        f"Description: {request.description}. "
        f"ViewBox: {view_box}. "
        f"Style profile: {profile.style_profile}. "
        "Output requirements: complete <svg> with strong silhouette, layered details, meaningful shape language, "
        "no text, no watermark, no placeholder framing, no markdown."
    )


def _build_variant_prompt(request: RenderVariantRequest, profile: RenderProfile) -> str:
    view_box = request.view_box.model_dump() if request.view_box else None
    state_lines = "\n".join([f"- {state}: {description}" for state, description in request.states.items()])
    return (
        f"Render coherent SVG variants for subject={request.subject_type.value} id={request.subject_id}. "
        f"Target format={request.target_format.value}, viewBox={view_box}, style profile={profile.style_profile}. "
        "Use the same visual identity and proportions across all states.\n"
        f"States and descriptions:\n{state_lines}\n"
        "Return JSON with mime_type='image/svg+xml' and variants map where each key is a state and value is full SVG. "
        "No text labels, no watermark, no placeholders."
    )
