# UI Architecture & Contribution Guide

This document describes how the Room Generator UI is structured, how modules interact, and how to contribute changes safely.

---

## 1. High-level architecture

The UI follows a **layered architecture**: dependencies point inward. Presentation (React) depends on application (hooks), which depends on domain and infrastructure (rendering). Domain and rendering stay free of React and UI concerns.

```
┌─────────────────────────────────────────────────────────────────┐
│  PRESENTATION                                                    │
│  App.jsx, components/*  — layout, composition, props             │
└───────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  APPLICATION (hooks)                                             │
│  useGameState, useMovement, useCanvasInteraction, useObjectActions,
│  useGeneratedAssets  — state, side effects, event handlers      │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│  DOMAIN                    │   │  INFRASTRUCTURE                  │
│  room, geometry,           │   │  rendering/*, constants/*        │
│  pathfinding,              │   │  — canvas drawing, config       │
│  roomGeneration,            │   │                                  │
│  dungeonGeneration, random  │   │  (rendering reads domain types)  │
│  — pure logic, no React     │   │                                  │
└───────────────────────────┘   └─────────────────────────────────┘
```

- **Presentation**: What the user sees. Composes hooks and presentational components; no direct domain or rendering imports except for constants used for layout (e.g. `TILE`, `CANVAS_W`).
- **Application (hooks)**: Orchestrates state and behavior. Calls domain (pathfinding, room generation, geometry) and infrastructure (e.g. `drawScene`). Exposes state and callbacks to the tree.
- **Domain**: Pure game logic—rooms, objects, grid geometry, pathfinding, procedural generation. No React, no canvas, no DOM. Easy to unit test.
- **Infrastructure**: Constants (grid, palette) and canvas rendering. Rendering functions take a canvas context and domain data (room, player position, etc.).

---

## 2. Directory structure and module roles

| Path | Role | May import from |
|------|------|------------------|
| **`constants/`** | Grid dimensions, palette, item names/colors | — |
| **`domain/`** | Room/object model, geometry, pathfinding, room and dungeon generation, random helpers | `constants/` only |
| **`rendering/`** | All canvas drawing; `drawScene` orchestrates the rest | `constants/`, `domain/` (geometry, room shape) |
| **`hooks/`** | Game state, movement, canvas clicks, object actions, generated assets | `constants/`, `domain/`, `rendering/` (e.g. `drawScene`), `services/` |
| **`services/`** | Asset API client (fetch SVG by type+state, cache) | — |
| **`components/`** | Presentational React components | `constants/` (if needed), `styles.js`, other `components/` |
| **`App.jsx`** | Root component; composes hooks and layout | `constants/`, `hooks/`, `components/`, `styles.js` |
| **`styles.js`** | Shared inline style objects | — |
| **`main.jsx`** | Entry: mounts `App` into DOM | `App.jsx` |
| **`index.jsx`** | Re-exports `App` for external consumers | `App.jsx` |
| **`ui.jsx`** | Legacy entry; re-exports default from `App.jsx` | `App.jsx` |

**Dependency rules (enforced by convention):**

- **Domain** never imports from `rendering/`, `hooks/`, or `components/`.
- **Rendering** imports only `constants/` and `domain/` (for types and geometry).
- **Hooks** may import `domain/`, `rendering/`, and `constants/`.
- **Components and App** import from `hooks/`, `components/`, `constants/`, and `styles.js`; they do not import domain or rendering directly except when passing through callbacks or layout constants.

---

## 3. Data flow and interactions

### 3.1 Application startup

1. **`main.jsx`** renders `<App />` into `#root`.
2. **`App`** calls:
   - `useGameState()` → dungeon (rooms, layout, startRoomId), currentRoomId, **setCurrentRoomId**, visitedRoomIds, addVisited, current **room** (derived), player position, setPlayerPos, setRoom, path, selection, inventory, pending object, and `regenerate`. Player position lives in the same state object as dungeon/currentRoomId/visitedRoomIds.
   - `useMovement(...)` → effect that advances the path every `MOVE_DELAY`; when the next step is a gate with an exit, performs a room transition (setCurrentRoomId, setPlayerPos, addVisited); when the path is empty, applies the pending interaction (e.g. select object)
   - `useCanvasInteraction(...)` → returns `handleCanvasClick`
   - `useObjectActions(...)` → returns `toggleOpen`, `toggleLock`, `pickUpItem`, `pickUpFromSurface`
3. **`useGameState`** uses **`generateDungeon()`** from **`domain/dungeonGeneration.js`** to create the initial dungeon and on regenerate. The current **room** is always `dungeon.rooms[currentRoomId]`.

### 3.2 User clicks the canvas

1. **`GameCanvas`** passes `onCanvasClick={handleCanvasClick}` to the `<canvas>`.
2. **`useCanvasInteraction`** (in the returned handler):
   - Converts click to grid cell `(gx, gy)` using canvas rect and `TILE`, `CANVAS_*`.
   - Uses **domain** `getObjectTiles` to see if the click hit an interactable object.
   - Uses **domain** `buildWalkableGrid`, `findPath`, `findAdjacentWalkable` to decide:
     - **Click on object**: path to an adjacent tile and set `pendingObjId`, or if already adjacent, set `selectedObjId`.
     - **Click on empty tile**: path to that tile and clear selection/pending. Clicking a gate tile paths to it; **`useMovement`** will then perform a room transition when the player steps onto the gate.
3. **`useMovement`** effect consumes the path: each tick, if the next step is a gate tile and the current room has an exit in that direction, it switches to the adjacent room and places the player just inside the gate (and adds both rooms to `visitedRoomIds`); otherwise it moves the player one step. When the path is empty and there is a `pendingObjId`, it sets `selectedObjId` and clears `pendingObjId`.

### 3.3 User interacts with the selected object (panel)

1. **`InteractionPanel`** receives `onOpen`, `onLock`, `onPickUpItem`, `onPickUpFromSurface` from **`useObjectActions`**.
2. **`useObjectActions`** uses `room` and `setRoom`/`setInventory` to:
   - **`mutateObj`**: update one object in the room by id.
   - **`toggleOpen` / `toggleLock`**: guard (e.g. locked → no open) then call `mutateObj`.
   - **`pickUpItem` / `pickUpFromSurface`**: move items from room object to inventory and update the object via `mutateObj`.

All of this uses **domain** only in the sense that room/object shape is defined there; the hooks never import domain modules for logic, only the App passes room/objects as data.

### 3.4 Rendering the frame

1. **`GameCanvas`** runs a `useEffect` that depends on `room`, `playerPos`, `selectedObjId`, and `getImage`. **`room`** is always the current room (`dungeon.rooms[currentRoomId]`).
2. **`App`** calls **`useGeneratedAssets()`**, which (when `VITE_USE_GENERATED_ASSETS` is true) fetches all SVG variants once at startup from the asset_generation API, caches them, and returns **`getImage(type, state)`**. That is passed to **`GameCanvas`** and into **`drawScene`**. Object state changes (e.g. open/locked) use the cache without re-fetching.
3. **`GameCanvas`** gets the canvas 2D context and calls **`drawScene(ctx, room, playerPos, selectedObjId, { getImage })`** from `rendering/drawScene.js`.
4. **`drawScene`**:
   - Uses **domain** `getGateTiles` to know where to draw gates instead of walls.
   - For each object: if **`getImage`** is provided and returns a loaded image for that type+state, draws it via **`drawSvgImage`** (and items on/inside if applicable); otherwise uses the procedural **`drawBox`**, **`drawSafe`**, **`drawTable`**, etc.
   - Then floor, walls, windows, gates, objects and player (sorted by Y for depth), and selection highlight.

So: **events → hooks (application) → domain (pathfinding, room data) and rendering (drawScene)**. Domain and rendering do not call each other except that rendering imports domain geometry for gate tiles and room structure. When the **asset generation service** is used, the UI gets SVGs from its API (see repo root **ARCHITECTURE.md**), caches them by type+state in **`services/assetApi.js`**, and rendering uses them when available instead of procedural drawing.

---

## 4. Key data structures (domain)

- **Dungeon**: `{ rooms: Record<roomId, Room>, layout: Record<roomId, { row, col }>, startRoomId: string }`. Created by **`domain/dungeonGeneration.js`** (`generateDungeon`).
- **Room**: `{ id?, width, height, gridW, gridH, floorType, gates: { N?, E?, S?, W? }, exits: { N?, E?, S?, W? } (neighbor room ids), objects: Object[] }`. In a dungeon, `gates` are derived from `exits` (gate exists iff exit exists).
- **Object**: `{ id, type, x, y, w?, h?, wall?, locked?, open?, items?: Item[] }`. Types include `container_box`, `container_safe`, `surface_table`, `decoration_flower`, `decoration_lamp`, `window`.
- **Item**: `{ id, name, color }`.
- **Position**: `{ x, y }` in grid coordinates.
- **Application state**: One state object holds `dungeon`, `currentRoomId`, `visitedRoomIds`, and `playerPos`. `visitedRoomIds: Set<string>` tracks rooms the player has entered; current room is `dungeon.rooms[currentRoomId]`. **`useGameState`** exposes `setCurrentRoomId` and `setPlayerPos` (which update this state) for room transitions and movement.

Room and object shapes are created in **`domain/room.js`** (`createRoom`, `createRoomObject`, `createItem`). Dungeons are built in **`domain/dungeonGeneration.js`**, which uses **`domain/roomGeneration.js`** to fill each room. Data is consumed by rendering and hooks as plain data.

---

## 5. Contribution guide

### 5.1 Where to add or change code

| Goal | Where to change |
|------|------------------|
| New room/object type or game rule | **`domain/room.js`** (DEFAULTS, factories). If it affects movement: **`domain/geometry.js`** (`blocksMovement`) and possibly **`domain/pathfinding.js`**. |
| New procedural room layout or content | **`domain/roomGeneration.js`**. Use **`domain/random.js`**, **`domain/geometry.js`** (e.g. `getGateTiles`, `getObjectTiles`), **`domain/room.js`** (createRoom, createRoomObject, createItem). |
| Dungeon structure (multiple rooms, layout, connections) | **`domain/dungeonGeneration.js`**. Calls **`domain/roomGeneration.js`** with `exits`/`skipResetUid` for each room. |
| New pathfinding or grid behavior | **`domain/pathfinding.js`** and **`domain/geometry.js`**. Keep pure (no React, no canvas). |
| New or changed canvas drawing | **`rendering/`**. New object type → add a `draw*` in **`drawObjects.js`** (or a new file if it’s a large family) and call it from **`drawScene.js`** in the correct order (depth by Y). Use **`constants/palette.js`** and **`constants/grid.js`** (TILE, PX). |
| New constant or theme color | **`constants/grid.js`** or **`constants/palette.js`**. |
| New UI state or side effect | **`hooks/`**. New state → consider **`useGameState.js`**. New effect (e.g. timer, subscription) → new hook or extend **`useMovement.js`**. |
| New canvas interaction (e.g. drag, key) | **`hooks/useCanvasInteraction.js`** or a new hook; keep pathfinding and “click → path/selection” logic in one place. |
| Room transition on gate step | **`hooks/useMovement.js`** (detect gate via **`domain/geometry.js`** `getGateDirectionAt`; switch room, set player via `getTileInsideGate`). **`useGameState.js`** holds dungeon, currentRoomId, visitedRoomIds, playerPos and exposes `setCurrentRoomId`, `setPlayerPos`, `addVisited`, and `setRoom`; **`App.jsx`** must destructure and pass `setCurrentRoomId` into `useMovement`. |
| Minimap (visit-reveal, current room highlight) | **`components/Minimap.jsx`**. Receives `layout`, `visitedRoomIds`, `currentRoomId`, `rooms`; SVG from props only. Styles in **`styles.js`** (`minimapStyles`). |
| New object action (e.g. drop item) | **`hooks/useObjectActions.js`**. |
| New screen or layout section | **`App.jsx`** and/or new component in **`components/`**. Prefer small presentational components that receive props and callbacks. |
| Asset generation integration | **`services/assetApi.js`** (`fetchPreload`, `preloadAllImagesFromMap`, cache), **`hooks/useGeneratedAssets.js`** (one GET /svg/preload, then build all Images in parallel, expose `getImage`). Lockables: 3 states (open, closed_locked, closed_unlocked); single-state types: one SVG. **`rendering/drawScene.js`** uses `getImage` when provided and falls back to procedural drawing. Set `VITE_ASSET_API_URL` and `VITE_USE_GENERATED_ASSETS=true` to enable. |
| Shared styles | **`styles.js`**. Prefer named style objects over ad-hoc inline objects in components. |

### 5.2 Conventions

- **Domain and rendering**: Prefer **named exports** (e.g. `export function findPath(...)`) for tree-shaking and targeted tests. Default export for **App** and for components that are the single export of their file (e.g. **Header**, **GameCanvas**).
- **Imports**: Use explicit extensions (`.js` / `.jsx`) for local modules. Use the same layer rules as above (no domain import of hooks/rendering/components).
- **Components**: Prefer clear prop names (`onRegenerate`, `selectedObject`, `onClose`). Keep components focused; put complex logic in hooks or domain.
- **Styles**: Keep inline styles in **`styles.js`** as named objects; components import and spread or merge them. Avoid introducing a CSS build step unless agreed.

### 5.3 Testing

- **Domain** (pathfinding, geometry, room generation, room/object creation): add unit tests in a `domain/` or `__tests__/` directory. No React or canvas; use plain Node or a test runner (e.g. Vitest) that supports ES modules.
- **Hooks**: test via React Testing Library (e.g. `renderHook`) if you add a test setup.
- **Components / App**: optional; if you add a test runner, start with a simple smoke test that mounts **App** and checks that key elements (e.g. header, generate button) are present.

### 5.4 Before submitting changes

- [ ] New code lives in the correct layer (domain vs hooks vs components vs rendering).
- [ ] No new dependency from domain → hooks/rendering/components, or from rendering → hooks/components.
- [ ] New constants/themes go in **`constants/`**; new shared styles in **`styles.js`**.
- [ ] Run **`npm run build`** from **`ui/`** and fix any errors.
- [ ] Manually test: generate dungeon, move, select object, open/lock, pick up items, walk through gates (room transition), check minimap reveals only visited rooms, regenerate.

---

## 6. Entry points

- **Development**: **`main.jsx`** is the Vite entry (referenced from **`index.html`**). It sets **`#root`** to full viewport size, wraps **App** in an **ErrorBoundary** (so render errors show in-place), and mounts with **`React.StrictMode`**.
- **External import**: Consumers can **`import App from './ui'`** (via **`index.jsx`**) or **`import App from './ui/ui.jsx'`** (legacy re-export). Both resolve to the same **App** component.
