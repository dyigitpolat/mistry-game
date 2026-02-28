from __future__ import annotations

from src_py.application.ports import CachePort
from src_py.domain.rendering import CacheRecord


class InMemoryCache(CachePort):
    def __init__(self) -> None:
        self._records: dict[str, CacheRecord] = {}

    async def get(self, key: str) -> CacheRecord | None:
        return self._records.get(key)

    async def set(self, record: CacheRecord) -> None:
        self._records[record.key] = record
