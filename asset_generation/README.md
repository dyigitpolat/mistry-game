# Asset Generation Backend (Python)

This service generates render artifacts for game entities and world state using a clean architecture:

- `src_py/domain`: pure domain models and policies
- `src_py/application`: use-cases and cache-aware orchestration
- `src_py/infrastructure`: renderer and cache implementations
- `src_py/api`: FastAPI HTTP adapters

## Run

```bash
cd asset_generation
.venv/bin/python -m pip install -e ".[dev]"
.venv/bin/python -m uvicorn src_py.main:app --reload --port 3001
```

## Environment

- `HF_TOKEN` (required): HuggingFace token used by `InferenceClient`.
- `ASSET_PROVIDER` (default: `fal-ai`)
- `ASSET_MODEL` (default: `Qwen/Qwen-Image`)
- `ASSET_INCLUDE_DEBUG_IMAGES` (default: `false`): include generated/preprocessed image snapshots in artifact metadata for diagnostics.
- `ASSET_HF_TIMEOUT_SECONDS` (default: `90`): timeout for one upstream image request.
- `ASSET_HF_MAX_RETRIES` (default: `3`): retry attempts for transient upstream errors (504/timeout/5xx).
- `ASSET_HF_RETRY_BASE_DELAY_SECONDS` (default: `0.8`): linear backoff base delay between retries.
- `ASSET_RENDER_CONCURRENCY` (default: `8`): max in-flight render tasks.

Generation pipeline:

1. HF text-to-image generation (pixel art, white background prompts)
2. state strip cropping for variant bundles
3. `rembg` background removal
4. PNG encoding to base64 artifacts in API response

Runtime note:

- `rembg` requires `onnxruntime` in the same virtual environment.

## API

- `POST /v1/worlds/initialize`
- `POST /v1/worlds/update`
- `POST /v1/renders/batch`
- `GET /v1/renders/{render_key}`
