# Repository architecture

This repo contains the Mistry game: a **UI** (React + canvas) and an optional **asset generation** backend service.

## Layout

| Path | Role |
|------|------|
| **`ui/`** | Frontend: React app and canvas viewer for backend-provided world/layout/placement/artifacts. See [ui/ARCHITECTURE.md](ui/ARCHITECTURE.md). |
| **`asset_generation/`** | Backend service: Python FastAPI API with clean architecture and HuggingFace raster generation. See below. |

The UI is now backend-driven: it visualizes world snapshots from `initialize_world`/`update_world` and uses backend artifacts directly.

## Asset generation service (Python)

- **Purpose**: Generate render artifacts for game entities and world state using typed Pydantic models and a raster image pipeline.
- **Stack**: FastAPI + Pydantic v2 + HuggingFace InferenceClient + Pillow + rembg. Architecture is layered:
  - `src_py/domain`: pure world/render models, validation, policies, deterministic layout/placement.
  - `src_py/application`: use-cases (`initialize_world`, `update_world`, batch rendering) with stateless generation orchestration.
  - `src_py/infrastructure`: renderer adapter and cache implementation.
  - `src_py/api`: HTTP controllers.
- **Artifact pipeline**: responses return typed artifacts (`mime_type`, `content`, metadata) where `content` is inline base64 PNG.
- **Subject types**: `WORLD_OBJECT`, `WORLD_ITEM`, `WORLD_PERSON`, `GENERIC_OBJECT`.
- **Mood inference**: room atmospheric moods (`dim`, `warm`, `cold`, `dusty`, `eerie`, `damp`, `opulent`, `desolate`, `tense`, `serene`) are inferred per-location via Pydantic AI with Mistral Large. The `moods` dict is returned in `WorldResponse` and consumed by the UI effects layer. Runs in parallel with asset rendering.
- **Variant strip generation**: containers and people are generated as side-by-side state strips in one call, then cropped into per-state artifacts (`open/closed_unlocked/closed_locked`, `alive/dead`).
- **Background removal**: each generated image crop is processed by `rembg` before encoding.
- **Coherent variants**: state variants for a single entity are generated together in one call (containers: `open/closed_unlocked/closed_locked`; people: `alive/dead`) to keep visual style consistent.
- **Caching policy**: no cross-request AI generation reuse; each initialize/update request performs fresh model generation.
- **API**:
  - `POST /v1/worlds/initialize`
  - `POST /v1/worlds/update`
  - `POST /v1/renders/batch`
  - `GET /v1/renders/{render_key}`
- **Input compatibility**: world endpoints normalize world payloads from either `world` or `game_world` wrappers and ignore unknown narrative metadata fields before strict model validation.
- **Run**: `cd asset_generation && .venv/bin/python -m uvicorn src_py.main:app --reload --port 3001`
- **UI integration**: Set `VITE_ASSET_API_URL`. UI consumes `/v1/worlds/initialize` and `/v1/worlds/update` and reads PNG artifacts from `artifacts[key].content`.
