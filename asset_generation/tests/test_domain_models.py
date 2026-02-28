from pydantic import ValidationError

from src_py.domain.models import GameObject, ObjectCategory, World


def test_container_requires_state() -> None:
    try:
        GameObject(
            id="box1",
            category=ObjectCategory.CONTAINER,
            name="Box",
            description="A plain box",
        )
    except ValidationError:
        return
    raise AssertionError("container without state should fail validation")


def test_world_requires_valid_connections() -> None:
    data = {
        "locations": {
            "loc_a": {
                "name": "A",
                "description": "A",
                "connections": [{"location_id": "missing"}],
                "people": [],
                "objects": [],
            }
        }
    }
    try:
        World.model_validate(data)
    except ValidationError:
        return
    raise AssertionError("unknown connection target should fail validation")
