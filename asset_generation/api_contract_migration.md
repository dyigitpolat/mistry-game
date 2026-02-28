# API Contract Migration (JS -> Python)

## Endpoint mapping

- `GET /svg?type=...&locked=...&open=...`
  - replaced by `POST /v1/renders/batch` with a single typed `RenderRequest`
- `GET /svg/preload`
  - replaced by `POST /v1/renders/batch` with multiple typed `RenderRequest` entries
- `POST /world/initialize`
  - replaced by `POST /v1/worlds/initialize`
- `POST /world/update`
  - replaced by `POST /v1/worlds/update`

## Response mapping

- old: `svgs: Record<string, string>`
- new: `artifacts: Record<string, RenderArtifact>`
  - use `artifact.content` when `artifact.mime_type === "image/svg+xml"`

## Placement mapping

- old: `placement[locationId]`
- new: `placement.rooms[locationId]`

## New fields

- `world_hash`: deterministic hash of typed world payload
- `cache_manifest`: cache hit/miss info per request
- `diagnostics`: provider and warnings metadata
