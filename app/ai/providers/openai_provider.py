"""
OpenAI provider implementation for LLM and embedding models.

Supports:
- GPT-4o, GPT-4, GPT-3.5-turbo for chat/completions
- text-embedding-3-large, text-embedding-3-small, text-embedding-ada-002 for embeddings
"""

from typing import Optional, List, Dict, Any
import os

from app.ai.providers.base import LLMProvider, EmbeddingProvider, ProviderConfig


class OpenAIProvider(LLMProvider):
    """OpenAI LLM provider using the ChatGPT API."""

    def _default_config(self) -> ProviderConfig:
        return ProviderConfig(
            api_key=os.getenv("OPENAI_API_KEY", ""),
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            base_url=os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        )

    def _initialize(self):
        """Validate configuration on init."""
        if not self.config.api_key:
            print("Warning: OPENAI_API_KEY not set. Set it in .env or environment.")

    def generate(self, prompt: str, **kwargs) -> str:
        return self.generate_chat(
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        )

    def generate_chat(self, messages: List[Dict[str, str]], **kwargs) -> str:
        try:
            import openai
        except ImportError:
            raise ImportError("OpenAI provider requires: pip install openai")

        client = openai.OpenAI(
            api_key=kwargs.get("api_key", self.config.api_key),
            base_url=kwargs.get("base_url", self.config.base_url),
        )

        model = kwargs.get("model", self.config.model)
        temperature = kwargs.get("temperature", self.config.temperature)
        max_tokens = kwargs.get("max_tokens", self.config.max_tokens)

        # Extract system prompt if provided
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
        return "openai"


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI embedding provider."""

    def _default_config(self) -> ProviderConfig:
        return ProviderConfig(
            api_key=os.getenv("OPENAI_API_KEY", ""),
            model=os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large"),
        )

    def _initialize(self):
        if not self.config.api_key:
            print("Warning: OPENAI_API_KEY not set for embeddings.")

    def embed(self, text: str) -> List[float]:
        try:
            import openai
        except ImportError:
            raise ImportError("OpenAI provider requires: pip install openai")

        client = openai.OpenAI(api_key=self.config.api_key)
        response = client.embeddings.create(
            model=self.config.model,
            input=text,
        )
        return response.data[0].embedding

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        try:
            import openai
        except ImportError:
            raise ImportError("OpenAI provider requires: pip install openai")

        client = openai.OpenAI(api_key=self.config.api_key)
        response = client.embeddings.create(
            model=self.config.model,
            input=texts,
        )
        # Sort by index to maintain order
        sorted_data = sorted(response.data, key=lambda x: x.index)
        return [d.embedding for d in sorted_data]

    @property
    def name(self) -> str:
        return "openai-embedding"

    @property
    def dimensions(self) -> int:
        model = self.config.model
        if "3-large" in model:
            return 3072
        elif "3-small" in model:
            return 1536
        elif "ada-002" in model:
            return 1536
        return 1536  # default