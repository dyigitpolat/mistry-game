from src_py.domain.layout import compute_world_layout
from src_py.domain.models import World
from src_py.domain.placement import PlaceableObject, PlaceablePerson, place_in_room


def _world() -> World:
    return World.model_validate(
        {
            "locations": {
                "a": {
                    "name": "A",
                    "description": "A",
                    "connections": [{"location_id": "b"}],
                    "people": [],
                    "objects": [],
                },
                "b": {
                    "name": "B",
                    "description": "B",
                    "connections": [{"location_id": "a"}],
                    "people": [],
                    "objects": [],
                },
            }
        }
    )


def test_layout_is_seeded_deterministic() -> None:
    world = _world()
    left = compute_world_layout(world.locations, seed=7)
    right = compute_world_layout(world.locations, seed=7)
    assert left.model_dump() == right.model_dump()


def test_layout_places_connected_rooms_adjacent_with_exits() -> None:
    world = _world()
    layout = compute_world_layout(world.locations, seed=3)
    exits_a = set(layout.locations["a"].exits.values())
    exits_b = set(layout.locations["b"].exits.values())
    assert "b" in exits_a
    assert "a" in exits_b


def test_placement_avoids_walls() -> None:
    result = place_in_room(
        objects=[PlaceableObject(id="obj1", category="surface")],
        people=[PlaceablePerson(id="p1")],
        gates={"N": True, "E": False, "S": False, "W": False},
        room_seed=99,
    )
    for obj in result.objects:
        assert obj.x >= 1
        assert obj.y >= 1
    for person in result.people:
        assert person.x >= 1
        assert person.y >= 1
