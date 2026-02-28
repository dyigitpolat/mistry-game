"""Mistral client for chat completions."""

from __future__ import annotations

import os

from mistralai import Mistral

from src.llm.openai_api import load_env


class MistralLLM:
    """LLM client backed by Mistral Chat API.

    Works with any Mistral model ID, including finetuned models from the
    Mistral fine-tuning API—pass the finetuned model ID as model=...
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        model: str = "mistral-large-latest",
    ) -> None:
        load_env()
        key = api_key or os.environ.get("MISTRAL_API_KEY")
        if not key:
            raise ValueError(
                "Mistral API key not set. Set MISTRAL_API_KEY in .env or pass api_key=..."
            )
        self._client = Mistral(api_key=key)
        self._model = model

    def complete(self, prompt: str, *, system: str | None = None) -> str:
        """Send a single prompt and return the full text response."""
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        response = self._client.chat.complete(
            model=self._model,
            messages=messages,
        )
        return response.choices[0].message.content or ""

    @property
    def model(self) -> str:
        return self._model


def main() -> None:
    """Test LLM calls with a simple prompt."""
    load_env()
    llm = MistralLLM()
    reply = llm.complete("Say 'Hello from Mistral' in one short sentence.")
    print("Response:", reply)


if __name__ == "__main__":
    main()
