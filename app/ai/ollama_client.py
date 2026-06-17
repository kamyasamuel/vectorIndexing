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
            "max_tokens": max_tokens,
            "stream": False  # Explicitly set stream to False
        }
        
        try:
            response = requests.post(url, json=payload)
            response.raise_for_status()
            
            # Get just the text content
            content = response.text.strip()
            
            # If it's a single JSON object
            try:
                result = json.loads(content)
                return result.get("response", "")
            except json.JSONDecodeError:
                # If it's multiple JSON objects (one per line)
                full_response = ""
                for line in content.splitlines():
                    if not line.strip():
                        continue
                    try:
                        line_json = json.loads(line)
                        if "response" in line_json:
                            full_response += line_json["response"]
                    except json.JSONDecodeError:
                        pass
                        
                if full_response:
                    return full_response
                else:
                    return "Failed to parse response from language model."
                
        except Exception as e:
            print(f"Error getting completion: {str(e)}")
            return f"Error: {str(e)}"
