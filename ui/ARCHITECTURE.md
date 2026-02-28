# UI Architecture & Contribution Guide

This UI is a **server-driven world viewer**. It no longer generates procedural/random dungeons for gameplay state; instead it renders backend world snapshots from the asset service.

## 1. High-level architecture

The UI keeps a layered structure:

- **Presentation**: `App.jsx`, `components/*`
- **Application hooks**: `useGameState`, `useMovement`, `useCanvasInteraction`
- **Domain**: geometry/pathfinding plus `worldToDungeon` mapping
- **Infrastructure**: canvas renderers and API client

Core data flow:

1. `useGameState` auto-loads `/exampleWorld.json`.
2. UI calls `POST /v1/worlds/initialize`.
3. Response `{ world, layout, placement, artifacts }` is converted by `worldToDungeon`.
4. Artifact SVGs are converted into `HTMLImageElement`s and drawn in `drawScene`.
5. `useMovement` handles only navigation between backend-defined room exits.
6. Optional refresh calls `POST /v1/worlds/update` with latest world/layout/placement.

## 2. Directory roles

| Path | Role |
|------|------|
| `hooks/useGameState.js` | Source of truth for server-driven world state, room selection, and image cache |
| `services/assetApi.js` | HTTP client for `initialize_world` and `update_world`, artifact-to-image conversion |
| `domain/worldToDungeon.js` | Maps backend payload shape to renderer-friendly room objects |
| `hooks/useMovement.js` | Player movement and room transitions via room gates/exits |
| `hooks/useCanvasInteraction.js` | Click-to-path and object selection behavior |
| `rendering/*` | Canvas drawing pipeline and object/image rendering |

## 3. Interaction model

- The UI is **read-only** for world mutations.
- No local open/lock/pickup state mutation is treated as source-of-truth.
- Backend endpoints define world, layout, placement, and visual artifacts.
- UI interactions are view/navigation concerns only.

## 4. Backend contract assumptions

- `POST /v1/worlds/initialize` returns first snapshot.
- `POST /v1/worlds/update` returns refreshed snapshot using provided `world/layout/placement`.
- `artifacts` map contains render key -> artifact, where SVG is in `artifact.content`.
- Object/person keys used by renderer:
  - `object:<locationId>:<objectId>:<state>`
  - `item:<locationId>:<parentId>:<itemId>`
  - `person:<locationId>:<personId>:<state>`

## 5. Contribution rules

- Keep UI state as a projection of backend responses.
- Avoid reintroducing local procedural dungeon initialization.
- If backend payload shape changes, update both:
  - `ui/services/assetApi.js`
  - `ui/domain/worldToDungeon.js`
- Validate with:
  - `npm run build` (UI)
  - world load + room traversal manual smoke test
