"""
Pluggable provider system for LLM and embedding models.

Supports OpenAI, DeepSeek, and Ollama for both:
- Text completions / chat (for Q&A, query rewriting, HyDE generation)
- Embeddings (for vector indexing and search)

Usage:
    from app.ai.providers import get_provider, get_embedding_provider
    
    # Get an LLM provider by name
    llm = get_provider("openai")
    response = llm.generate("Hello!")
    
    # Get an embedding provider by name
    embedder = get_embedding_provider("ollama")
    vector = embedder.embed("Some text")
    
    # Get the configured default provider
    llm = get_provider()  # uses LLM_PROVIDER env var
"""

from typing import Optional

from app.ai.providers.base import (
    LLMProvider,
    EmbeddingProvider,
    ProviderConfig,
    ProviderError,
)
from app.ai.providers.openai_provider import OpenAIProvider, OpenAIEmbeddingProvider
from app.ai.providers.deepseek_provider import DeepSeekProvider
from app.ai.providers.ollama_provider import OllamaProvider, OllamaEmbeddingProvider

# Registry of available providers
_llm_providers: dict = {}
_embedding_providers: dict = {}

# Default provider names (configurable via env vars)
from os import getenv
DEFAULT_LLM = getenv("LLM_PROVIDER", "deepseek")  # or "openai", "ollama"
DEFAULT_EMBEDDING = getenv("EMBEDDING_PROVIDER", "ollama")  # or "openai"


def register_provider(name: str, provider: LLMProvider):
    """Register an LLM provider by name."""
    _llm_providers[name] = provider


def register_embedding_provider(name: str, provider: EmbeddingProvider):
    """Register an embedding provider by name."""
    _embedding_providers[name] = provider


def get_provider(name: Optional[str] = None) -> LLMProvider:
    """Get an LLM provider by name. Falls back to default."""
    name = name or DEFAULT_LLM
    if not _llm_providers:
        _init_providers()
    provider = _llm_providers.get(name)
    if not provider:
        raise ProviderError(f"Unknown LLM provider: {name}. Available: {list(_llm_providers.keys())}")
    return provider


def get_embedding_provider(name: Optional[str] = None) -> EmbeddingProvider:
    """Get an embedding provider by name. Falls back to default."""
    name = name or DEFAULT_EMBEDDING
    if not _embedding_providers:
        _init_providers()
    provider = _embedding_providers.get(name)
    if not provider:
        raise ProviderError(f"Unknown embedding provider: {name}. Available: {list(_embedding_providers.keys())}")
    return provider


def list_providers() -> dict:
    """List all registered providers with their status."""
    if not _llm_providers:
        _init_providers()
    return {
        "llm": {k: v.__class__.__name__ for k, v in _llm_providers.items()},
        "embedding": {k: v.__class__.__name__ for k, v in _embedding_providers.items()},
    }


def _init_providers():
    """Initialize all providers lazily."""
    # LLM providers
    register_provider("openai", OpenAIProvider())
    register_provider("deepseek", DeepSeekProvider())
    register_provider("ollama", OllamaProvider())
    
    # Embedding providers
    register_embedding_provider("openai", OpenAIEmbeddingProvider())
    register_embedding_provider("ollama", OllamaEmbeddingProvider())