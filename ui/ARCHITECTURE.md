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
│  useGameState, useMovement, useCanvasInteraction, useObjectActions
│  — state, side effects, event handlers                           │
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│  DOMAIN                    │   │  INFRASTRUCTURE                  │
│  room, geometry,           │   │  rendering/*, constants/*        │
│  pathfinding,              │   │  — canvas drawing, config       │
│  roomGeneration, random    │   │                                  │
│  — pure logic, no React     │   │  (rendering reads domain types)  │
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
| **`domain/`** | Room/object model, geometry, pathfinding, room generation, random helpers | `constants/` only |
| **`rendering/`** | All canvas drawing; `drawScene` orchestrates the rest | `constants/`, `domain/` (geometry, room shape) |
| **`hooks/`** | Game state, movement, canvas clicks, object actions | `constants/`, `domain/`, `rendering/` (e.g. `drawScene`) |
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
   - `useGameState()` → initial room, player position, path, selection, inventory, pending object, and `regenerate`
   - `useMovement(...)` → effect that advances the path every `MOVE_DELAY` and, when the path is empty, applies the pending interaction (e.g. select object)
   - `useCanvasInteraction(...)` → returns `handleCanvasClick`
   - `useObjectActions(...)` → returns `toggleOpen`, `toggleLock`, `pickUpItem`, `pickUpFromSurface`
3. **`useGameState`** uses `generateRoom()` from domain to create the initial room and on regenerate.

### 3.2 User clicks the canvas

1. **`GameCanvas`** passes `onCanvasClick={handleCanvasClick}` to the `<canvas>`.
2. **`useCanvasInteraction`** (in the returned handler):
   - Converts click to grid cell `(gx, gy)` using canvas rect and `TILE`, `CANVAS_*`.
   - Uses **domain** `getObjectTiles` to see if the click hit an interactable object.
   - Uses **domain** `buildWalkableGrid`, `findPath`, `findAdjacentWalkable` to decide:
     - **Click on object**: path to an adjacent tile and set `pendingObjId`, or if already adjacent, set `selectedObjId`.
     - **Click on empty tile**: path to that tile and clear selection/pending.
3. **`useMovement`** effect consumes the path: each tick it moves the player one step and, when the path is empty and there is a `pendingObjId`, sets `selectedObjId` and clears `pendingObjId`.

### 3.3 User interacts with the selected object (panel)

1. **`InteractionPanel`** receives `onOpen`, `onLock`, `onPickUpItem`, `onPickUpFromSurface` from **`useObjectActions`**.
2. **`useObjectActions`** uses `room` and `setRoom`/`setInventory` to:
   - **`mutateObj`**: update one object in the room by id.
   - **`toggleOpen` / `toggleLock`**: guard (e.g. locked → no open) then call `mutateObj`.
   - **`pickUpItem` / `pickUpFromSurface`**: move items from room object to inventory and update the object via `mutateObj`.

All of this uses **domain** only in the sense that room/object shape is defined there; the hooks never import domain modules for logic, only the App passes room/objects as data.

### 3.4 Rendering the frame

1. **`GameCanvas`** runs a `useEffect` that depends on `room`, `playerPos`, `selectedObjId`.
2. It gets the canvas 2D context and calls **`drawScene(ctx, room, playerPos, selectedObjId)`** from `rendering/drawScene.js`.
3. **`drawScene`**:
   - Uses **domain** `getGateTiles` to know where to draw gates instead of walls.
   - Calls **rendering** helpers in order: floor, walls, windows, gates, then objects and player (sorted by Y for depth), and selection highlight.

So: **events → hooks (application) → domain (pathfinding, room data) and rendering (drawScene)**. Domain and rendering do not call each other except that rendering imports domain geometry for gate tiles and room structure.

---

## 4. Key data structures (domain)

- **Room**: `{ width, height, gridW, gridH, floorType, gates: { N?, E?, S?, W? }, objects: Object[] }`.
- **Object**: `{ id, type, x, y, w?, h?, wall?, locked?, open?, items?: Item[] }`. Types include `container_box`, `container_safe`, `surface_table`, `decoration_flower`, `decoration_lamp`, `window`.
- **Item**: `{ id, name, color }`.
- **Position**: `{ x, y }` in grid coordinates.

Room and object shapes are created in **`domain/room.js`** (`createRoom`, `createRoomObject`, `createItem`) and consumed by rendering and hooks as plain data.

---

## 5. Contribution guide

### 5.1 Where to add or change code

| Goal | Where to change |
|------|------------------|
| New room/object type or game rule | **`domain/room.js`** (DEFAULTS, factories). If it affects movement: **`domain/geometry.js`** (`blocksMovement`) and possibly **`domain/pathfinding.js`**. |
| New procedural room layout or content | **`domain/roomGeneration.js`**. Use **`domain/random.js`**, **`domain/geometry.js`** (e.g. `getGateTiles`, `getObjectTiles`), **`domain/room.js`** (createRoom, createRoomObject, createItem). |
| New pathfinding or grid behavior | **`domain/pathfinding.js`** and **`domain/geometry.js`**. Keep pure (no React, no canvas). |
| New or changed canvas drawing | **`rendering/`**. New object type → add a `draw*` in **`drawObjects.js`** (or a new file if it’s a large family) and call it from **`drawScene.js`** in the correct order (depth by Y). Use **`constants/palette.js`** and **`constants/grid.js`** (TILE, PX). |
| New constant or theme color | **`constants/grid.js`** or **`constants/palette.js`**. |
| New UI state or side effect | **`hooks/`**. New state → consider **`useGameState.js`**. New effect (e.g. timer, subscription) → new hook or extend **`useMovement.js`**. |
| New canvas interaction (e.g. drag, key) | **`hooks/useCanvasInteraction.js`** or a new hook; keep pathfinding and “click → path/selection” logic in one place. |
| New object action (e.g. drop item) | **`hooks/useObjectActions.js`**. |
| New screen or layout section | **`App.jsx`** and/or new component in **`components/`**. Prefer small presentational components that receive props and callbacks. |
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
- [ ] Manually test: generate room, move, select object, open/lock, pick up items, regenerate.

---

## 6. Entry points

- **Development**: **`main.jsx`** is the Vite entry (referenced from **`index.html`**). It mounts **App** with `React.StrictMode`.
- **External import**: Consumers can **`import App from './ui'`** (via **`index.jsx`**) or **`import App from './ui/ui.jsx'`** (legacy re-export). Both resolve to the same **App** component.
