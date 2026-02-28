# UI Architecture & Contribution Guide

This UI is a **server-driven world viewer**. It no longer generates procedural/random dungeons for gameplay state; instead it renders backend world snapshots from the asset service.

## 1. High-level architecture

The UI keeps a layered structure:

- **Presentation**: `App.jsx`, `components/*`
- **Application hooks**: `useGameState`, `useMovement`, `useCanvasInteraction`
- **Domain**: geometry/pathfinding plus `worldToDungeon` mapping
- **Infrastructure**: canvas renderers, effects layer, and API client

Core data flow:

1. `useGameState` auto-loads `/exampleWorld.json`.
2. UI calls `POST /v1/worlds/initialize`.
3. Response `{ world, layout, placement, artifacts, moods, decorations }` is converted by `worldToDungeon`.
4. Artifact payloads (base64 PNG) are converted into `HTMLImageElement`s and drawn in `drawScene`.
5. `drawEffects` applies post-processing: vignette, color temperature, ambient particles, and light glow.
6. Room name/description is displayed as an HTML bar below the canvas (not drawn on canvas).
7. `useMovement` handles navigation between backend-defined room exits, blocking locked gates.
8. Optional refresh calls `POST /v1/worlds/update` with latest world/layout/placement.

## 2. Directory roles

| Path | Role |
|------|------|
| `hooks/useGameState.js` | Source of truth for server-driven world state, room selection, and image cache |
| `services/assetApi.js` | HTTP client for `initialize_world` and `update_world`, artifact-to-image conversion |
| `domain/worldToDungeon.js` | Maps backend payload shape to renderer-friendly room objects; infers floor type, builds exit names, passes connection states, AI-inferred moods, and merges AI-generated decorations |
| `hooks/useMovement.js` | Player movement and room transitions via room gates/exits; blocks locked gates |
| `hooks/useCanvasInteraction.js` | Click-to-path and object selection behavior |
| `rendering/drawScene.js` | Main render loop: procedural floor tiles, walls, gates with labels, objects with alpha-channel shadows and AO |
| `rendering/drawObjects.js` | Object/item sprite rendering, alpha-based drop shadows, ambient occlusion overlays, labels, selection highlights, opaque-pixel hit testing |
| `rendering/drawWalls.js` | Wall tiles, windows, and gate rendering with lock indicators and destination labels |
| `rendering/drawFloor.js` | Procedural floor tile drawing (wood, stone, grass, ceramic) |
| `rendering/effects.js` | Post-processing visual effects: vignette, color temperature, ambient particles, light source glow. Mood is provided by backend AI inference |
| `rendering/drawOverlays.js` | HUD overlays (legacy; room banner now rendered as HTML below canvas) |
| `rendering/drawPlayer.js` | Player character sprite |

## 3. Visual features

- **Alpha-channel shadows**: the sprite's alpha channel is blurred and shifted downward to produce a natural ground shadow. An edge-aware ambient occlusion overlay detects alpha-channel edges (original minus blurred alpha) weighted toward the bottom of the sprite, darkening the lower edges to simulate contact shadow that "leaks into" the object.
- **AI decorations**: 2-3 large standalone floor objects per room (barrels, statues, furniture, large plants, etc.) are AI-suggested based on room description, rendered as 2×2 tile sprites, and placed near walls.
- **Effects layer**: vignette darkness, color temperature tinting, floating dust particles, and radial glow around light-source objects. Mood intensities (`dim`, `warm`, `cold`, `dusty`, `eerie`, `damp`, `opulent`, `desolate`, `tense`, `serene`) are provided by the backend via Pydantic AI + Mistral Large inference on room descriptions.
- **Room info bar**: room name and description are displayed as an HTML bar below the canvas (not drawn on the canvas, avoiding click interference with north gates).
- **Object labels**: all non-decoration objects and people have their name displayed below their sprite.
- **Surface item placement**: items on surfaces are placed at the top 30% of the surface height rather than centered.
- **Wall-biased placement**: all objects, people, and decorations are placed near room walls (within 2-3 tiles) instead of randomly in the room center.
- **Door labels**: gates show destination room name and lock/unlock state with visual indicators (lock icon for locked, arrow for unlocked).
- **Hover tooltips**: hovering any object, person, or item shows a tooltip with name, description, notes, and state.
- **Locked gate feedback**: walking into a locked gate shows a temporary "locked" message and blocks movement.
- **Minimap**: rooms are displayed as rectangles with full names inside, connected by lines (dashed red for locked connections).

## 4. Interaction model

- The UI is **read-only** for world mutations.
- No local open/lock/pickup state mutation is treated as source-of-truth.
- Backend endpoints define world, layout, placement, and visual artifacts.
- UI interactions are view/navigation concerns only.
- Clicking objects/people opens an interaction panel; people show description/notes/state.
- Container open/close is toggled locally for visual preview.

## 5. Backend contract assumptions

- `POST /v1/worlds/initialize` returns first snapshot.
- `POST /v1/worlds/update` returns refreshed snapshot using provided `world/layout/placement`.
- `artifacts` map contains render key -> artifact, where base64 PNG is in `artifact.content` and mime metadata is in `artifact.mime_type`.
- `moods` map contains location_id -> `RoomMood` object with float intensities for atmospheric effects.
- `decorations` map contains location_id -> list of `DecorationItem` (id, name, description, x, y, w, h).
- Artifact keys used by renderer:
  - `object:<locationId>:<objectId>:<state>`
  - `item:<locationId>:<parentId>:<itemId>`
  - `person:<locationId>:<personId>:<state>`
  - `decor:<locationId>:<decorId>` (AI-generated decorations)
- Layout locations include `connectionStates` mapping directions to `locked`/`unlocked`.

## 6. Contribution rules

- Keep UI state as a projection of backend responses.
- Avoid reintroducing local procedural dungeon initialization.
- If backend payload shape changes, update both:
  - `ui/services/assetApi.js`
  - `ui/domain/worldToDungeon.js`
- Keep artifact decoding format-agnostic (`mime_type` + `content`) so future formats do not require renderer-wide rewrites.
- Validate with:
  - `npm run build` (UI)
  - world load + room traversal manual smoke test
