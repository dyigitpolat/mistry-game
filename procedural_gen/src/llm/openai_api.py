"""OpenAI client using the Responses API."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI


def _find_env() -> Path | None:
    """Locate .env from cwd or project root."""
    cwd = Path.cwd()
    for d in [cwd, *cwd.parents]:
        env = d / ".env"
        if env.is_file():
            return env
    return None


def load_env() -> None:
    """Load .env from project root or current directory."""
    env_path = _find_env()
    if env_path:
        load_dotenv(env_path)
    else:
        load_dotenv()


class OpenAILLM:
    """LLM client backed by OpenAI Responses API."""

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = "gpt-5.2",
        base_url: str | None = None,
    ) -> None:
        load_env()
        key = api_key or os.environ.get("OPENAI_KEY")
        if not key:
            raise ValueError(
                "OpenAI API key not set. Set OPENAI_KEY in .env or pass api_key=..."
            )
        self._client = OpenAI(api_key=key, base_url=base_url)
        self._model = model

    def complete(self, prompt: str, *, system: str | None = None) -> str:
        """Send a single prompt and return the full text response."""
        if system:
            input_items = [
                {"role": "developer", "content": system, "type": "message"},
                {"role": "user", "content": prompt, "type": "message"},
            ]
        else:
            input_items = prompt

        response = self._client.responses.create(
            model=self._model,
            input=input_items,
        )
        return response.output_text

    @property
    def model(self) -> str:
        return self._model


def main() -> None:
    """Test LLM calls with a simple prompt."""
    load_env()
    llm = OpenAILLM()
    reply = llm.complete("Say 'Hello from the Responses API' in one short sentence.")
    print("Response:", reply)


if __name__ == "__main__":
    main()
