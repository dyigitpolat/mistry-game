# Repository architecture

This repo contains the Mistry detective game: a **Next.js frontend** with an integrated canvas-based gameplay UI, a **FastAPI backend** with merged asset generation, and an **agent engine** powering all game logic.

## Layout

| Path | Role |
|------|------|
| **`frontend/`** | Next.js 16 app (TypeScript, Tailwind). Game page includes a canvas-based dungeon viewer overlaid on Gemini-generated scene backgrounds. |
| **`backend/`** | FastAPI backend: game engine, scenario management, scene generation, and merged asset-generation pipeline. |
| **`agent/`** | `mistry-agents` package: LLM-powered Oracle, Character Agent, Epiphany Engine, Scene Generator. |
| **`asset_generation/`** | Source package for the asset-generation pipeline (installed as a path dependency of the backend). |
| **`ui/`** | Original standalone React+Vite canvas viewer (source-of-truth for gameplay rendering logic; ported into `frontend/src/components/gameplay/`). |
| **`docker/`** | Docker Compose orchestration for frontend, backend, MongoDB, Redis. |

## Backend (Python)

- **Stack**: FastAPI + Pydantic v2 + motor (MongoDB) + redis-py + deepagents SDK.
- **Game engine** (`app/services/game_engine.py`): orchestrates LLM agents, state transitions, phase checks, accusations. Includes canonical name mapping (LLM-backed) to normalize entity names in Oracle responses, display name simplification for verbose entity names, and on-the-fly sprite generation for new entities introduced by the LLM.
- **Scenario schema** (`app/models/scenario.py`): `Scenario` → `GameWorld` → `Location` (with `name`, `description`, `setting`, `connections`, `people`, `objects`). Legacy JSON formats are normalized on load. Connections are auto-fixed to be bidirectional. Characters from `scenario.characters` are populated into `Location.people` during normalization.
- **Merged asset generation**: the `mistry-asset-generation` package is installed as a local path dependency. Its FastAPI router is mounted at `/v1/` on the main backend, and game-specific endpoints are at `/game/{session_id}/world/initialize` and `/game/{session_id}/world/update`.
- **Run**: `cd backend && .venv/bin/python -m uvicorn app.main:app --reload --port 8000`

### Asset generation pipeline

- **Purpose**: compute layout/placement for world locations and generate pixel-art sprites for objects, people, and decorations.
- **Architecture**: layered — `src_py/domain` (models), `src_py/application` (use-cases), `src_py/infrastructure` (fal.ai renderer, disk cache), `src_py/api` (HTTP controllers).
- **Artifact pipeline**: text-to-image via fal.ai Nano Banana 2 → state strip cropping → rembg background removal → base64 PNG.
- **Mood inference**: per-room atmospheric moods inferred via Pydantic AI + Mistral.
- **AI decorations**: 2–3 large floor objects per room suggested by AI, placed near walls. Existing world objects and container items are passed to the inference prompt and used for post-generation deduplication filtering.
- **Caching**: disk-backed cache in `asset_generation/.artifact_cache/`. Persists across restarts.
- **API** (served from main backend on port 8000):
  - `POST /v1/worlds/initialize` — raw world JSON
  - `POST /v1/worlds/update` — re-render with existing layout
  - `POST /v1/renders/batch` — arbitrary render requests
  - `GET /v1/renders/{render_key}` — cached artifact by key
  - `POST /game/{session_id}/world/initialize` — session-aware: extracts game_world from scenario
  - `POST /game/{session_id}/world/update` — session-aware world update

## Frontend (Next.js)

- **Stack**: Next.js 16 (App Router), TypeScript, Tailwind v4, next-auth v4.
- **Game page** (`src/app/game/[id]/page.tsx`): 12-column grid layout:
  - **Left (col-span-3)**: MinimapPanel (SVG room map) + DeductionBoard (clues, evidence, notes, Discord).
  - **Center (col-span-6)**: Gemini scene background with GameplayView canvas overlay (slide-down animated on scene load, with drawer toggle) + NarrativeLog.
  - **Right (col-span-3)**: StatusPanel (objective, inventory with generated sprite thumbnails, characters, locations, Solve Case).

### Gameplay UI (`src/components/gameplay/`)

Ported from `ui/` — canvas-based top-down room renderer:

- **GameplayView.tsx**: controlled component accepting dungeon state from the page.
- **GameCanvas.jsx**: HTML5 canvas with `requestAnimationFrame` loop rendering floor tiles, walls, gates, objects, people, player sprite, and mood-driven effects (vignette, particles, color temperature).
- **MinimapPanel.tsx**: SVG minimap with fixed viewport, drag-to-pan, scroll-to-zoom. Displays visited rooms with dimmed scene-image backgrounds, bright text labels with drop shadows. Auto-centers on current room when location changes.
- **InteractionPanel.jsx**: floating panel for container/surface/person interaction. Includes "Take" buttons for items.
- **hooks/useGameplayState.ts**: manages dungeon state, world initialization from backend session, room sync with narrative engine, and state patch application.
- **hooks/useMovement.js**: path consumption; gate clicks fire `onRoomChangeRequest` callback instead of instant room switch.
- **hooks/useCanvasInteraction.js**: click handling with A* pathfinding.
- **domain/**: worldToDungeon transform, pathfinding, geometry, room models.
- **rendering/**: drawScene, drawFloor, drawWalls, drawObjects, drawPlayer, effects.
- **services/assetApi.js**: API client routing through Next.js proxy to merged backend.

### Room change flow

Room transitions in the gameplay canvas are mediated through the narrative command system:

1. Player clicks a gate tile in the canvas.
2. `useMovement` calls `onRoomChangeRequest(locationName)` instead of switching locally.
3. The game page auto-sends `"Move to {locationName}"` through `handleCommand`.
4. Backend processes the move action, returns `ActionResponse` with `new_location`.
5. `processResponse` updates `session.player_state.current_location`.
6. `useGameplayState` watches `currentLocation` and syncs `currentRoomId` + player position.

### Item pickup flow

Taking items from containers/surfaces also goes through the narrative command system:

1. Player opens a container or clicks a surface in the canvas.
2. InteractionPanel shows items with "Take" buttons.
3. Clicking "Take" fires `onTakeItem(itemName)`.
4. The game page auto-sends `"Take {itemName}"` through `handleCommand`.
5. Backend Oracle processes the pickup and returns the item in `ActionResponse.new_items`.
6. `processResponse` builds a `StatePatch` with `removedItems` and the item is removed from the canvas.
7. Inventory in the StatusPanel shows the item with its generated sprite thumbnail.

### Display name simplification

At scenario load time, the game engine runs an LLM call (`_generate_display_names`) to produce simplified display names for verbose entity names (>30 chars). The mapping is stored per-scenario and applied to:

1. **Asset generation**: world data is rewritten with short names before sending to the rendering pipeline.
2. **Oracle responses**: `new_location`, `new_items`, `new_clues`, and `characters_in_room` are mapped through display names.
3. **Frontend**: `ActionResponse.display_name_map` is sent so the UI can translate any remaining references.

### Canonical name mapping

Non-deterministic LLM outputs may produce variant names for the same entity. The backend normalizes these:

1. After the Oracle returns, `_canonicalize_oracle_result` collects all canonical entity names from the scenario (including display-name aliases).
2. For each name in `picked_up_items`, `new_location`, `found_clues`, it first tries exact/case-insensitive matching.
3. Remaining unmatched names are sent to the LLM for fuzzy resolution.
4. Names that map to `null` are flagged as genuinely new entities; sprites are generated on-the-fly via `_generate_new_entity_sprites`.
5. The response is updated in-place with canonical names and display names before being returned to the frontend.

### Dynamic entity handling

When the Oracle introduces entities not present in the scenario:

1. The canonical mapper detects them (mapped to `null`).
2. `_generate_new_entity_sprites` creates pixel-art sprites via the asset generation pipeline.
3. New artifacts are returned in `ActionResponse.new_entity_artifacts`.
4. The frontend merges them into `worldSvgImages` and optionally inserts items into room objects via `StatePatch.addedItems`.

### State synchronization

After each `ActionResponse`, the game page builds a `StatePatch` and feeds it to the gameplay state:

- **Item pickup** (`new_items`): removes items from room objects' `contains` arrays.
- **Object state changes** (`visual_metadata_diff.object_changes`): updates container locked/open state and recomputes `worldSvgKey`.
- **Connection changes** (`visual_metadata_diff.connection_changes`): updates `connectionStates` for gates.
- **Added items** (`addedItems`): inserts new items into container/surface objects.
- **New artifacts** (`newArtifacts`): loads new sprite images into the world image cache.
