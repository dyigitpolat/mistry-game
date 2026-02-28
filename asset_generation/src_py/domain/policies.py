from __future__ import annotations

from .models import ContainerState, ObjectCategory, PersonState
from .rendering import ViewBox

CONTAINER_STATE_TO_VISUAL = {
    ContainerState.OPEN: "open",
    ContainerState.CLOSED: "closed_unlocked",
    ContainerState.LOCKED: "closed_locked",
}

DIRS = ("N", "E", "S", "W")
LAYOUT_GRID_ROWS = 4
LAYOUT_GRID_COLS = 4
INTERIOR_W = 14
INTERIOR_H = 10
GRID_W = INTERIOR_W + 2
GRID_H = INTERIOR_H + 2


def visual_state_for_object(category: ObjectCategory, state: ContainerState | None) -> str:
    if category is ObjectCategory.CONTAINER and state is not None:
        return CONTAINER_STATE_TO_VISUAL.get(state, "closed_unlocked")
    return "closed"


def object_view_box(category: ObjectCategory) -> ViewBox:
    if category in (ObjectCategory.SURFACE, ObjectCategory.CONTAINER):
        return ViewBox(w=80, h=40)
    return ViewBox(w=40, h=40)


def person_view_box() -> ViewBox:
    return ViewBox(w=40, h=40)


def object_render_description(
    category: ObjectCategory,
    description: str,
    name: str,
    state: ContainerState | None,
) -> str:
    base = description or name or "object"
    if category is ObjectCategory.CONTAINER and state is not None:
        if state is ContainerState.OPEN:
            return f"{base}, open, interior visible"
        if state is ContainerState.LOCKED:
            return f"{base}, closed and locked"
        return f"{base}, closed and unlocked"
    return base


def person_render_description(description: str, state: PersonState) -> str:
    if state is PersonState.DEAD:
        return f"{description} (appearance: deceased, slumped or still)"
    return description
