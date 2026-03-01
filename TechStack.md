# Mistry Game — TechStack

> Living document. Updated as decisions are made.

## Core Architecture

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Frontend** | Next.js (App Router) | 15.x | TypeScript, Tailwind CSS |
| **Backend** | FastAPI | 0.115+ | Async, CORS enabled |
| **Agent Engine** | deepagents SDK | latest | Built on LangGraph + LangChain |
| **Python Pkg Mgr** | uv | latest | Fast Python package manager, replaces pip/venv |
| **Database** | MongoDB | 7.x | Via `motor` async driver |
| **Cache** | Redis | 7.x | Session state, in-memory caching |
| **Containerization** | Docker + Compose | — | Multi-service orchestration |

## Frontend

- **Framework**: Next.js 15 with App Router and TypeScript
- **Styling**: Tailwind CSS v4 — chosen to match the Stitch design system (Space Grotesk font, `#1235e2` primary blue, dark mode)
- **UI Icons**: Material Symbols Outlined (Google Fonts)
- **State Management**: React hooks + context (local game state) — may migrate to Zustand if complexity grows
- **API Client**: Native `fetch` with typed wrappers

## Backend

- **Framework**: FastAPI with `uvicorn` ASGI server
- **Language**: Python 3.11+ (required by deepagents)
- **Validation**: Pydantic v2 — models ported directly from `Specs.md`
- **Package Manager**: `uv` — all Python deps managed via `uv pip install` / `uv sync`
- **Database Driver**: `motor` (async MongoDB driver)
- **Config**: `.env` for secrets, `config.yaml` for feature flags and agent assignments
- **CORS**: Enabled for `localhost:3000` (dev) — configurable via env

## Agent Module (`mistry-agents`)

- **SDK**: `deepagents` — LangGraph-based agent harness with built-in planning, subagent spawning, and memory
- **LLM Integration**: `langchain[openai]` via `init_chat_model()` — provider:model format (e.g. `openai:gpt-4o`)
- **Multi-Provider Support**: OpenAI, Mistral, Gemini, OpenRouter, HuggingFace — registered via env vars, assigned via `config.yaml`
- **Agent Topology**: Hub-and-spoke
  - **Gamemaker Oracle**: Phase progression, world action evaluation, visual metadata mutation
  - **Character Agent**: Per-NPC instantiation, contradiction engine, suspicion meter
  - **Epiphany Engine**: Deduction board evaluation, knowledge token granting
- **Prompts**: Jinja2 templates in `prompts.py` for dynamic scenario/character injection
- **Structured Output**: Pydantic models for all agent responses (deterministic game state transitions)

## Database Schema Decisions

- **MongoDB collections**: `users`, `scenarios`, `game_sessions`, `leaderboards`
- **Game state**: Stored per-session in `game_sessions` with full player state snapshot
- **Scenarios**: Pre-loaded JSON knowledge graphs matching Pydantic `Scenario` model
- **Why NoSQL**: Game state is deeply nested (locations → surfaces → objects → visibility). Document DB is a natural fit.

## Deployment

- **Docker Compose**: 4 services — `frontend`, `backend`, `mongo`, `redis`
- **Environment**: Single `.env` file at root, shared across all services
- **Config**: `config.yaml` mounted into backend container

## Quirks & Gotchas

1. **deepagents default model**: Defaults to `claude-sonnet-4-5-20250929`. We override to `openai:gpt-4o` via config since user has OpenAI key.
2. **OPENAI_API_KEY vs OPENAI_KEY**: LangChain expects `OPENAI_API_KEY`. Renamed from the original `OPENAI_KEY`.
3. **Pydantic v2**: `Specs.md` schema uses `BaseModel` — compatible with Pydantic v2 but `Field(...)` syntax is stable.
4. **Tailwind v4 in Next.js 15**: Uses `@tailwindcss/postcss` plugin instead of the legacy config approach.
5. **Scenario Difficulty**: Fixed classification — each scenario has a single `ScenarioDifficulty` enum value (`easy`, `medium`, `hard`), not per-difficulty descriptions.
6. **Build backend**: Both Python packages use `hatchling` as build backend for `uv` compatibility.
