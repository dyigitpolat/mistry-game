"""
LLM Provider Registry — multi-provider model management.

Reads from .env and config.yaml to register and instantiate LLM models.
Uses LangChain's init_chat_model() under the hood for provider:model routing.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

import yaml
from langchain.chat_models import init_chat_model
from langchain_core.language_models import BaseChatModel


class LLMRegistry:
    """
    Central registry for LLM providers and models.

    Supports two levels of access:
    1. Provider level — raw model calls via get_model()
    2. Agent level — abstracted with deepagents (see oracle.py, character.py, etc.)

    Configured models (from config.yaml):
        agents:
          gamemaker_oracle:
            model: "openai:gpt-4o"
            temperature: 0.3
    """

    def __init__(self, config_path: Optional[str] = None):
        self._models: Dict[str, BaseChatModel] = {}
        self._config: Dict[str, Any] = {}

        if config_path:
            self._load_config(config_path)

    def _load_config(self, config_path: str) -> None:
        """Load agent config from YAML."""
        with open(config_path, "r") as f:
            self._config = yaml.safe_load(f) or {}

    @property
    def agent_configs(self) -> Dict[str, Any]:
        """Get agent role configurations."""
        return self._config.get("agents", {})

    def get_model(
        self,
        model_id: str,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        **kwargs,
    ) -> BaseChatModel:
        """
        Get or create a LangChain chat model instance.

        Args:
            model_id: Provider:model string (e.g. "openai:gpt-4o", "google_genai:gemini-2.5-flash")
            temperature: Sampling temperature
            max_tokens: Max output tokens

        Returns:
            A LangChain BaseChatModel instance.
        """
        cache_key = f"{model_id}:{temperature}:{max_tokens}"

        if cache_key not in self._models:
            self._models[cache_key] = init_chat_model(
                model_id,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs,
            )

        return self._models[cache_key]

    def get_agent_model(self, agent_role: str) -> BaseChatModel:
        """
        Get the model configured for a specific agent role.

        Args:
            agent_role: Key from config.yaml agents section
                        (e.g. "gamemaker_oracle", "character_agent")

        Returns:
            Configured LangChain model instance.
        """
        agent_cfg = self.agent_configs.get(agent_role, {})
        model_id = agent_cfg.get("model", "openai:gpt-4o")
        temperature = agent_cfg.get("temperature", 0.7)
        max_tokens = agent_cfg.get("max_tokens", 4096)

        return self.get_model(model_id, temperature=temperature, max_tokens=max_tokens)

    def list_available_providers(self) -> list[str]:
        """List providers that have API keys configured in the environment."""
        providers = []
        provider_env_map = {
            "openai": "OPENAI_API_KEY",
            "mistral": "MISTRAL_API_KEY",
            "google_genai": "GOOGLE_API_KEY",
            "openrouter": "OPENROUTER_API_KEY",
            "huggingface": "HUGGINGFACEHUB_API_TOKEN",
        }
        for provider, env_var in provider_env_map.items():
            if os.getenv(env_var):
                providers.append(provider)
        return providers
