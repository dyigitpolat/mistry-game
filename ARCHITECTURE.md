# Repository architecture

This repo contains the Mistry game: a **UI** (React + canvas) and an optional **asset generation** backend service.

## Layout

| Path | Role |
|------|------|
| **`ui/`** | Frontend: React app, game state, canvas rendering, domain logic (rooms, pathfinding, dungeon generation). See [ui/ARCHITECTURE.md](ui/ARCHITECTURE.md). |
| **`asset_generation/`** | Backend service: HTTP API that generates SVG assets for game objects using the Mistral Conversations API. See below. |

The UI can run standalone using procedural canvas drawing (drawBox, drawSafe, etc.). When the asset service is running and the UI is configured to use it, objects can be drawn with LLM-generated SVGs instead; procedural drawing remains the fallback when SVGs are unavailable.

## Asset generation service

- **Purpose**: Generate SVG markup for game object types (e.g. box, safe, table, lamp) via the Mistral API, so the UI can render them instead of (or in addition to) procedural shapes.
- **Visual states**: Lockables (box, safe) have 3 states (open, closed_locked, closed_unlocked), generated in one LLM call for consistency. Non-lockables with open/close have 2 states (open, closed). Single-state types (table, flower, lamp) have one SVG each.
- **API**: `GET /svg?type=<type>&locked=<bool>&open=<bool>`. Returns `image/svg+xml` or JSON `{ svg }`.
- **Stack**: Node (ESM), Express, dotenv for `MISTRAL_API_KEY`. Clean layers: domain (object descriptions, viewBox), application (generate-SVG use case), infrastructure (Mistral gateway), API (routes).
- **Run**: From repo root, `cd asset_generation && npm install && npm start` (or `npm run dev`). Default port 3001; set `PORT` and ensure `.env` has `MISTRAL_API_KEY`.
- **UI integration**: Set `VITE_ASSET_API_URL` (e.g. `http://localhost:3001`) and `VITE_USE_GENERATED_ASSETS=true` to have the UI fetch and cache SVGs and use them when drawing objects; otherwise the UI uses only procedural drawing.
