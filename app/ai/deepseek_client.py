import os
import json
import requests
from typing import List, Dict, Any, Optional

from config import DEEPSEEK_API_KEY

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
DEFAULT_MODEL = "deepseek-chat"  # DeepSeek-V2 or latest chat model

class DeepSeekClient:
    """Client for interacting with DeepSeek API for completions."""

    def __init__(self, api_key: Optional[str] = None, model: str = DEFAULT_MODEL):
        self.api_key = api_key or DEEPSEEK_API_KEY
        self.model = model
        self.base_url = DEEPSEEK_API_URL

        if not self.api_key:
            print("Warning: DEEPSEEK_API_KEY is not set. Completion features will fail.")

    def get_completion(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1000,
    ) -> str:
        """Generate a text completion using DeepSeek chat API."""
        if not self.api_key:
            return "Error: DeepSeek API key is not configured."

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            response = requests.post(self.base_url, json=payload, headers=headers, timeout=60)
            response.raise_for_status()
            result = response.json()

            choices = result.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "").strip()
            return ""

        except requests.exceptions.Timeout:
            return "Error: Request to DeepSeek API timed out."
        except requests.exceptions.HTTPError as e:
            status = e.response.status_code if e.response is not None else "unknown"
            detail = ""
            if e.response is not None:
                try:
                    detail = e.response.json().get("error", {}).get("message", "")
                except (json.JSONDecodeError, AttributeError):
                    detail = e.response.text[:200]
            return f"Error: DeepSeek API returned status {status}. {detail}".strip()
        except Exception as e:
            return f"Error: {str(e)}"