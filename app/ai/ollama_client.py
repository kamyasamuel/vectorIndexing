import json
import requests
from typing import List, Dict, Any, Optional

from config import OLLAMA_BASE_URL, EMBEDDING_MODEL, COMPLETION_MODEL

class OllamaClient:
    """Client for interacting with Ollama API for embeddings and completions."""
    
    def __init__(self, base_url: str = OLLAMA_BASE_URL):
        self.base_url = base_url
        
    def get_embedding(self, text: str, model: str = EMBEDDING_MODEL) -> List[float]:
        """Generate embeddings for a piece of text."""
        url = f"{self.base_url}/api/embeddings"
        payload = {
            "model": model,
            "prompt": text
        }
        
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        
        return result.get("embedding", [])
    
    def get_completion(self, prompt: str, model: str = COMPLETION_MODEL, 
                      temperature: float = 0.7, max_tokens: int = 500) -> str:
        """Generate text completion for a prompt."""
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        
        return result.get("response", "")
    
    def get_batch_embeddings(self, texts: List[str], model: str = EMBEDDING_MODEL) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        return [self.get_embedding(text, model) for text in texts]