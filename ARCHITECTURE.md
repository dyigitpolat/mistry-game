# Repository architecture

This repo contains the Mistry game: a **UI** (React + canvas) and an optional **asset generation** backend service.

## Layout

| Path | Role |
|------|------|
| **`ui/`** | Frontend: React app and canvas viewer for backend-provided world/layout/placement/artifacts. See [ui/ARCHITECTURE.md](ui/ARCHITECTURE.md). |
| **`asset_generation/`** | Backend service: Python FastAPI API with clean architecture and provider-agnostic structured generation. See below. |

The UI is now backend-driven: it visualizes world snapshots from `initialize_world`/`update_world` and uses backend artifacts directly.

## Asset generation service (Python)

- **Purpose**: Generate render artifacts for game entities and world state using strongly typed Pydantic models and structured LLM output.
- **Stack**: FastAPI + Pydantic v2 + PydanticAI. Architecture is layered:
  - `src_py/domain`: pure world/render models, validation, policies, deterministic layout/placement.
  - `src_py/application`: use-cases (`initialize_world`, `update_world`, batch rendering) with stateless generation orchestration.
  - `src_py/infrastructure`: renderer adapter and cache implementation.
  - `src_py/api`: HTTP controllers.
- **Generic artifact pipeline**: responses return typed artifacts (`mime_type`, `content`, metadata). SVG is the current format, but the contract is designed for future image generators.
- **Coherent variants**: state variants for a single entity are generated together in one call (containers: `open/closed_unlocked/closed_locked`; people: `alive/dead`) to keep visual style consistent.
- **Caching policy**: no cross-request AI generation reuse; each initialize/update request performs fresh model generation.
- **API**:
  - `POST /v1/worlds/initialize`
  - `POST /v1/worlds/update`
  - `POST /v1/renders/batch`
  - `GET /v1/renders/{render_key}`
- **Run**: `cd asset_generation && python -m pip install -e ".[dev]" && python -m uvicorn src_py.main:app --reload --port 3001`
- **UI integration**: Set `VITE_ASSET_API_URL`. UI consumes `/v1/worlds/initialize` and `/v1/worlds/update` and reads SVG markup from `artifacts[key].content`.
