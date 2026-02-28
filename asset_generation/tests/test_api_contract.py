import base64

from fastapi.testclient import TestClient

from src_py.api.dependencies import get_world_service
from src_py.application.artifact_service import ArtifactService
from src_py.application.world_use_cases import WorldService
from src_py.domain.rendering import ArtifactType, RenderArtifact
from src_py.infrastructure.cache import InMemoryCache
from src_py.main import app

PNG_1X1_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAucB9Y6vNisAAAAASUVORK5CYII="


class FakeRenderer:
    async def render(self, request, profile):  # noqa: ANN001
        return RenderArtifact(
            key=request.key,
            artifact_type=ArtifactType.RASTER,
            mime_type="image/png",
            content=PNG_1X1_BASE64,
            metadata={"provider": "fake"},
            version="v1",
        )

    async def render_variants(self, request, profile):  # noqa: ANN001
        return {
            request.build_key(state): RenderArtifact(
                key=request.build_key(state),
                artifact_type=ArtifactType.RASTER,
                mime_type="image/png",
                content=PNG_1X1_BASE64,
                metadata={"provider": "fake"},
                version="v1",
            )
            for state in request.states.keys()
        }


_TEST_SERVICE = WorldService(
    artifact_service=ArtifactService(
        renderer=FakeRenderer(),
        cache=InMemoryCache(),
    )
)


def _override_world_service() -> WorldService:
    return _TEST_SERVICE


def test_initialize_world_v1_contract() -> None:
    app.dependency_overrides[get_world_service] = _override_world_service
    client = TestClient(app)
    payload = {
        "world": {
            "locations": {
                "loc_1": {
                    "name": "Hall",
                    "description": "Long hall",
                    "connections": [],
                    "people": [],
                    "objects": [],
                }
            }
        },
        "seed": 3,
    }
    response = client.post("/v1/worlds/initialize", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert "world_hash" in body
    assert "cache_manifest" in body
    assert "artifacts" in body
    app.dependency_overrides.clear()


def test_initialize_world_accepts_game_world_wrapper_and_ignores_extra_fields() -> None:
    app.dependency_overrides[get_world_service] = _override_world_service
    client = TestClient(app)
    payload = {
        "title": "Case wrapper metadata",
        "intro_narrative": "Extra scenario fields should not break world ingestion.",
        "game_world": {
            "locations": {
                "loc_1": {
                    "name": "Hall",
                    "description": "Long hall",
                    "connections": [],
                    "people": [],
                    "objects": [
                        {
                            "id": "desk",
                            "category": "surface",
                            "name": "Desk",
                            "description": "A desk",
                            "contains": [
                                {
                                    "id": "note",
                                    "category": "item",
                                    "name": "Note",
                                    "description": "A folded note",
                                    "state": None,
                                    "contains": None,
                                }
                            ],
                        }
                    ],
                    "clues": ["extra location metadata"],
                    "setting": "Extra location metadata",
                }
            }
        },
        "seed": 11,
    }
    response = client.post("/v1/worlds/initialize", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["world"]["locations"]["loc_1"]["name"] == "Hall"
    app.dependency_overrides.clear()


def test_update_world_accepts_game_world_wrapper_and_ignores_extra_fields() -> None:
    app.dependency_overrides[get_world_service] = _override_world_service
    client = TestClient(app)
    initialize_payload = {
        "world": {
            "locations": {
                "loc_1": {
                    "name": "Hall",
                    "description": "Long hall",
                    "connections": [],
                    "people": [],
                    "objects": [],
                }
            }
        },
        "seed": 5,
    }
    init_response = client.post("/v1/worlds/initialize", json=initialize_payload)
    assert init_response.status_code == 200
    init_body = init_response.json()

    update_payload = {
        "game_world": {
            "locations": {
                "loc_1": {
                    "name": "Hall",
                    "description": "Long hall updated",
                    "connections": [],
                    "people": [],
                    "objects": [],
                    "clues": ["should be ignored"],
                }
            }
        },
        "layout": init_body["layout"],
        "placement": init_body["placement"],
    }
    response = client.post("/v1/worlds/update", json=update_payload)
    assert response.status_code == 200
    body = response.json()
    assert body["world"]["locations"]["loc_1"]["description"] == "Long hall updated"
    app.dependency_overrides.clear()


def test_batch_render_and_get_by_key() -> None:
    app.dependency_overrides[get_world_service] = _override_world_service
    client = TestClient(app)
    batch = {
        "requests": [
            {
                "key": "demo:1",
                "subject_type": "generic_object",
                "subject_id": "demo",
                "description": "test render",
                "state": "default",
                "target_format": "png",
                "view_box": {"w": 80, "h": 40},
            }
        ]
    }
    response = client.post("/v1/renders/batch", json=batch)
    assert response.status_code == 200
    artifact = response.json()["artifacts"]["demo:1"]
    assert artifact["mime_type"] == "image/png"

    by_key = client.get("/v1/renders/demo:1")
    assert by_key.status_code == 200
    assert by_key.headers["content-type"].startswith("image/png")
    assert base64.b64encode(by_key.content).decode("utf-8") == PNG_1X1_BASE64
    app.dependency_overrides.clear()
