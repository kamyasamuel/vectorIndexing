"""
Ollama provider implementation for LLM and embedding models.

Supports local Ollama instances for:
- Chat/completion models (llama3, granite, mistral, etc.)
- Embedding models (nomic-embed-text, etc.)
"""

from typing import Optional, List, Dict, Any
import os
import requests

from app.ai.providers.base import LLMProvider, EmbeddingProvider, ProviderConfig


class OllamaProvider(LLMProvider):
    """Ollama LLM provider for local model inference."""

    def _default_config(self) -> ProviderConfig:
        return ProviderConfig(
            model=os.getenv("OLLAMA_COMPLETION_MODEL", os.getenv("COMPLETION_MODEL", "granite3.3:2b")),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        )

    def _initialize(self):
        """Validate Ollama is reachable."""
        pass  # Lazy validation on first use

    def generate(self, prompt: str, **kwargs) -> str:
        return self.generate_chat(
            messages=[{"role": "user", "content": prompt}],
            **kwargs,
        )

    def generate_chat(self, messages: List[Dict[str, str]], **kwargs) -> str:
        base_url = kwargs.get("base_url", self.config.base_url)
        model = kwargs.get("model", self.config.model)
        temperature = kwargs.get("temperature", self.config.temperature)
        max_tokens = kwargs.get("max_tokens", self.config.max_tokens)

        # Build the payload
        payload = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            }
        }

        # Add system prompt if provided
        system_prompt = kwargs.get("system_prompt", None)
        if system_prompt:
            payload["messages"].insert(0, {"role": "system", "content": system_prompt})

        response = requests.post(
            f"{base_url.rstrip('/')}/api/chat",
            json=payload,
            timeout=120,
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Ollama API error {response.status_code}: {response.text}"
            )

        result = response.json()
        return result.get("message", {}).get("content", "").strip()

    @property
    def name(self) -> str:
        return "ollama"


class OllamaEmbeddingProvider(EmbeddingProvider):
    """Ollama embedding provider for local embedding models."""

    def _default_config(self) -> ProviderConfig:
        return ProviderConfig(
            model=os.getenv("EMBEDDING_MODEL", "nomic-embed-text:latest"),
            base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
        )

    def _initialize(self):
        pass

    def embed(self, text: str) -> List[float]:
        base_url = self.config.base_url
        model = self.config.model

        response = requests.post(
            f"{base_url.rstrip('/')}/api/embeddings",
            json={"model": model, "prompt": text},
            timeout=30,
        )

        if response.status_code != 200:
            raise RuntimeError(
                f"Ollama embedding error {response.status_code}: {response.text}"
            )

        result = response.json()
        return result.get("embedding", [])

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.embed(t) for t in texts]

    @property
    def name(self) -> str:
        return "ollama-embedding"

    @property
    def dimensions(self) -> int:
        model = self.config.model
        if "nomic-embed-text" in model:
            return 768
        elif "mxbai-embed-large" in model:
            return 1024
        elif "snowflake-arctic-embed" in model:
            return 1024
        return 768  # default for nomic-embed-text