from __future__ import annotations

import json
import os
from pathlib import Path

from src_py.application.ports import CachePort
from src_py.domain.rendering import CacheRecord


class InMemoryCache(CachePort):
    def __init__(self) -> None:
        self._records: dict[str, CacheRecord] = {}
        self._by_fingerprint: dict[str, CacheRecord] = {}

    async def get(self, key: str) -> CacheRecord | None:
        return self._records.get(key)

    async def get_by_fingerprint(self, fingerprint: str) -> CacheRecord | None:
        return self._by_fingerprint.get(fingerprint)

    async def set(self, record: CacheRecord) -> None:
        self._records[record.key] = record
        if record.fingerprint:
            self._by_fingerprint[record.fingerprint] = record

    def stats(self) -> dict[str, int]:
        return {"records": len(self._records), "fingerprints": len(self._by_fingerprint)}


class DiskCache(CachePort):
    """Persistent cache that writes CacheRecords to disk as JSON files.

    Directory layout:
        <root>/records/<sha256(key)>.json  – one file per unique artifact key
        <root>/_index.json                 – { key: key_hash } mapping
        <root>/_fp_index.json              – { fingerprint: key } mapping
    """

    def __init__(self, root: str | Path | None = None) -> None:
        if root is None:
            base = Path(__file__).resolve().parent.parent.parent
            root = base / ".artifact_cache"
        self._root = Path(root)
        self._rec_dir = self._root / "records"
        self._index_path = self._root / "_index.json"
        self._fp_index_path = self._root / "_fp_index.json"
        self._rec_dir.mkdir(parents=True, exist_ok=True)

        self._records: dict[str, CacheRecord] = {}
        self._by_fingerprint: dict[str, CacheRecord] = {}
        self._load_index()
        self._migrate_old_layout()

    @staticmethod
    def _key_hash(key: str) -> str:
        import hashlib
        return hashlib.sha256(key.encode("utf-8")).hexdigest()

    def _migrate_old_layout(self) -> None:
        old_fp_dir = self._root / "by_fp"
        old_key_index = self._root / "_key_index.json"
        if not old_fp_dir.exists():
            return
        try:
            import shutil
            shutil.rmtree(old_fp_dir, ignore_errors=True)
            if old_key_index.exists():
                old_key_index.unlink(missing_ok=True)
            print("[disk_cache] migrated: removed old by_fp layout")
        except Exception:
            pass

    def _load_index(self) -> None:
        if not self._index_path.exists():
            return
        try:
            key_map = json.loads(self._index_path.read_text())
            fp_map: dict[str, str] = {}
            if self._fp_index_path.exists():
                fp_map = json.loads(self._fp_index_path.read_text())

            loaded = 0
            for key, key_hash in key_map.items():
                rec_file = self._rec_dir / f"{key_hash}.json"
                if not rec_file.exists():
                    continue
                try:
                    record = CacheRecord.model_validate_json(rec_file.read_text())
                    self._records[key] = record
                    if record.fingerprint:
                        self._by_fingerprint[record.fingerprint] = record
                    loaded += 1
                except Exception:
                    continue
            print(f"[disk_cache] loaded {loaded} records from {self._root}")
        except Exception as exc:
            print(f"[disk_cache] failed to load index: {exc}")

    def _save_indexes(self) -> None:
        try:
            key_map = {k: self._key_hash(k) for k in self._records}
            self._index_path.write_text(json.dumps(key_map, separators=(",", ":")))
            fp_map = {
                r.fingerprint: r.key
                for r in self._records.values()
                if r.fingerprint
            }
            self._fp_index_path.write_text(json.dumps(fp_map, separators=(",", ":")))
        except Exception as exc:
            print(f"[disk_cache] failed to save index: {exc}")

    async def get(self, key: str) -> CacheRecord | None:
        return self._records.get(key)

    async def get_by_fingerprint(self, fingerprint: str) -> CacheRecord | None:
        return self._by_fingerprint.get(fingerprint)

    async def set(self, record: CacheRecord) -> None:
        self._records[record.key] = record
        if record.fingerprint:
            self._by_fingerprint[record.fingerprint] = record
        key_hash = self._key_hash(record.key)
        rec_file = self._rec_dir / f"{key_hash}.json"
        try:
            rec_file.write_text(record.model_dump_json())
        except Exception as exc:
            print(f"[disk_cache] failed to write {rec_file.name}: {exc}")
        self._save_indexes()

    def stats(self) -> dict[str, int]:
        return {"records": len(self._records), "fingerprints": len(self._by_fingerprint)}
