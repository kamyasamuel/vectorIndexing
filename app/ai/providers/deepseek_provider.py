"""
DeepSeek provider implementation for LLM models.

Supports DeepSeek's API which is OpenAI-compatible.
Uses similar interface to OpenAI but with DeepSeek's endpoints and models.
"""

from typing import Optional, List, Dict, Any
import os

from app.ai.providers.base import LLMProvider, ProviderConfig


class DeepSeekProvider(LLMProvider):
    """DeepSeek LLM provider using OpenAI-compatible API."""

    def _default_config(self) -> ProviderConfig:
        return ProviderConfig(
            api_key=os.getenv("DEEPSEEK_API_KEY", ""),
            model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
            base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1"),
        )

    def _initialize(self):
        """Validate configuration on init."""
        if not self.config.api_key:
            print("Warning: DEEPSEEK_API_KEY not set. Set it in .env or environment.")

    def generate(self, prompt: str, **kwargs) -> str:
        return self.generate_chat(
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        )

    def generate_chat(self, messages: List[Dict[str, str]], **kwargs) -> str:
        try:
            import openai
        except ImportError:
            raise ImportError("DeepSeek provider requires: pip install openai")

        client = openai.OpenAI(
            api_key=kwargs.get("api_key", self.config.api_key),
            base_url=kwargs.get("base_url", self.config.base_url),
        )

        model = kwargs.get("model", self.config.model)
        temperature = kwargs.get("temperature", self.config.temperature)
        max_tokens = kwargs.get("max_tokens", self.config.max_tokens)

        system_prompt = kwargs.get("system_prompt", None)
        chat_messages = list(messages)
        if system_prompt:
            chat_messages.insert(0, {"role": "system", "content": system_prompt})

        response = client.chat.completions.create(
            model=model,
            messages=chat_messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        return response.choices[0].message.content.strip()

    @property
    def name(self) -> str:
        return "deepseek"