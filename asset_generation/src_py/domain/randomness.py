from __future__ import annotations

from collections.abc import Iterable
from random import Random
from typing import TypeVar

T = TypeVar("T")


def seeded_random(seed: int) -> Random:
    return Random(seed)


def rand_int(rng: Random, minimum: int, maximum: int) -> int:
    return rng.randint(minimum, maximum)


def shuffled(rng: Random, values: Iterable[T]) -> list[T]:
    out = list(values)
    rng.shuffle(out)
    return out
