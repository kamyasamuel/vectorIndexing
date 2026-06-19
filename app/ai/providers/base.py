"""
Base classes for the pluggable provider system.

Defines the abstract interfaces that all LLM and embedding providers must implement,
along with common types and error handling.
"""

from typing import Optional, List, Dict, Any, AsyncIterator
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
import json


class ProviderError(Exception):
    """Base exception for provider errors."""
    pass


class ProviderRateLimitError(ProviderError):
    """Raised when the provider's rate limit is exceeded."""
    pass


class ProviderAuthError(ProviderError):
    """Raised when authentication with the provider fails."""
    pass


@dataclass
class ProviderConfig:
    """Configuration for a provider.
    
    Each provider subclass can define its own additional configuration fields.
    """
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: str = "default"
    timeout: int = 60
    max_retries: int = 3
    temperature: float = 0.7
    max_tokens: int = 2048
    # Additional provider-specific settings stored as JSON blob
    extra: Dict[str, Any] = field(default_factory=dict)


class LLMProvider(ABC):
    """Abstract base class for LLM (text completion) providers.
    
    Implementations: OpenAI, DeepSeek, Ollama
    """
    
    def __init__(self, config: Optional[ProviderConfig] = None):
        self.config = config or self._default_config()
        self._initialize()
    
    @abstractmethod
    def _default_config(self) -> ProviderConfig:
        """Return default configuration for this provider."""
        pass
    
    @abstractmethod
    def _initialize(self):
        """Initialize the provider client (API keys, endpoints, etc.)."""
        pass
    
    @abstractmethod
    def generate(self, prompt: str, **kwargs) -> str:
        """Generate a completion for the given prompt.
        
        Args:
            prompt: The input prompt text.
            **kwargs: Override any of the default config parameters.
            
        Returns:
            Generated text response.
        """
        pass
    
    @abstractmethod
    def generate_chat(self, messages: List[Dict[str, str]], **kwargs) -> str:
        """Generate a response from a chat conversation.
        
        Args:
            messages: List of {"role": "user"|"assistant"|"system", "content": "..."}
            **kwargs: Override any of the default config parameters.
            
        Returns:
            Generated text response.
        """
        pass
    
    def generate_streaming(self, prompt: str, **kwargs):
        """Generate a streaming completion. Override for SSE support.
        
        Default implementation falls back to non-streaming.
        """
        yield self.generate(prompt, **kwargs)
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider name."""
        pass
    
    def count_tokens(self, text: str) -> int:
        """Rough token count estimate. Override with provider-specific tokenizer."""
        # Simple heuristic: ~4 chars per token for English text
        return len(text) // 4


class EmbeddingProvider(ABC):
    """Abstract base class for embedding providers.
    
    Implementations: OpenAI (text-embedding-3-large), Ollama (nomic-embed-text)
    """
    
    def __init__(self, config: Optional[ProviderConfig] = None):
        self.config = config or self._default_config()
        self._initialize()
    
    @abstractmethod
    def _default_config(self) -> ProviderConfig:
        """Return default configuration for this provider."""
        pass
    
    @abstractmethod
    def _initialize(self):
        """Initialize the provider client."""
        pass
    
    @abstractmethod
    def embed(self, text: str) -> List[float]:
        """Generate an embedding vector for the given text.
        
        Args:
            text: The input text to embed.
            
        Returns:
            List of floats representing the embedding vector.
        """
        pass
    
    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts in batch.
        
        Default implementation loops over embed(). Override for efficiency.
        
        Args:
            texts: List of input texts.
            
        Returns:
            List of embedding vectors.
        """
        return [self.embed(t) for t in texts]
    
    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider name."""
        pass
    
    @property
    @abstractmethod
    def dimensions(self) -> int:
        """The dimensionality of the embedding vectors."""
        pass