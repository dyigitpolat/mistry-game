from __future__ import annotations

import base64
import threading
import uuid
from collections import deque
from dataclasses import dataclass


@dataclass
class _Preview:
    key: str
    data_url: str


class _DebugPreviewFeed:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._run_id: str | None = None
        self._status: str = "idle"
        self._expected_total: int = 0
        self._completed_total: int = 0
        self._error: str | None = None
        self._previews: deque[_Preview] = deque(maxlen=48)

    def start(self, expected_total: int) -> str:
        with self._lock:
            self._run_id = str(uuid.uuid4())
            self._status = "running"
            self._expected_total = max(0, int(expected_total))
            self._completed_total = 0
            self._error = None
            self._previews.clear()
            return self._run_id

    def add_artifact(self, key: str, mime_type: str, content: str) -> None:
        if mime_type != "image/png":
            return
        # Validate base64 quickly to avoid injecting invalid data URLs.
        try:
            base64.b64decode(content, validate=True)
        except Exception:
            return
        data_url = f"data:image/png;base64,{content}"
        with self._lock:
            self._completed_total += 1
            self._previews.append(_Preview(key=key, data_url=data_url))

    def finish(self, success: bool, error: str | None = None) -> None:
        with self._lock:
            self._status = "done" if success else "failed"
            self._error = error

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "run_id": self._run_id,
                "status": self._status,
                "expected_total": self._expected_total,
                "completed_total": self._completed_total,
                "error": self._error,
                "previews": [{"key": p.key, "data_url": p.data_url} for p in self._previews],
            }


_FEED = _DebugPreviewFeed()


def start_preview_run(expected_total: int) -> str:
    return _FEED.start(expected_total)


def add_preview_artifact(key: str, mime_type: str, content: str) -> None:
    _FEED.add_artifact(key=key, mime_type=mime_type, content=content)


def finish_preview_run(success: bool, error: str | None = None) -> None:
    _FEED.finish(success=success, error=error)


def preview_snapshot() -> dict:
    return _FEED.snapshot()
