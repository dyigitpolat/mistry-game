# Asset Generation Backend (Python)

This service generates render artifacts for game entities and world state using a clean architecture:

- `src_py/domain`: pure domain models and policies
- `src_py/application`: use-cases and cache-aware orchestration
- `src_py/infrastructure`: renderer and cache implementations
- `src_py/api`: FastAPI HTTP adapters

## Run

```bash
cd asset_generation
python -m pip install -e ".[dev]"
python -m uvicorn src_py.main:app --reload --port 3001
```

## Environment

- `ASSET_PROVIDER` (default: `mistral`)
- `ASSET_MODEL` (default: `mistral-large-latest`)
- provider keys, e.g. `MISTRAL_API_KEY`

Without a provider key, the renderer returns deterministic fallback SVG placeholders for local development.
By default, missing provider credentials now fail fast so invalid placeholder art is not silently returned.
Set `ASSET_ALLOW_FALLBACK=true` only when you explicitly want placeholder outputs.

## API

- `POST /v1/worlds/initialize`
- `POST /v1/worlds/update`
- `POST /v1/renders/batch`
- `GET /v1/renders/{render_key}`
