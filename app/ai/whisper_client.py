"""
Whisper speech-to-text client for audio transcription.

Supports two modes:
1. OpenAI Whisper API (recommended for production) — requires OPENAI_API_KEY
2. Local whisper.cpp or faster-whisper fallback

Transcribes audio files to text, which can then be indexed like any
other document.
"""

from typing import Optional, List, Dict, Any
import os
import json
import tempfile
from pathlib import Path


class WhisperClient:
    """Speech-to-text client for audio transcription.

    Uses OpenAI Whisper API by default, with optional local fallback.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "whisper-1",
        local_fallback: bool = False,
        local_model_size: str = "base",
    ):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.model = model
        self.local_fallback = local_fallback
        self.local_model_size = local_model_size
        self._local_model = None

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        """Transcribe an audio file to text.

        Args:
            audio_path: Path to the audio file (mp3, wav, ogg, flac, m4a, etc.)
            language: Optional ISO language code (e.g., "en", "fr").

        Returns:
            Dict with keys: text (transcription), segments, language, duration.
        """
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        try:
            return self._transcribe_api(audio_path, language=language)
        except Exception as api_error:
            print(f"Whisper API transcription failed: {api_error}")
            if self.local_fallback:
                print(f"Falling back to local whisper model ({self.local_model_size})...")
                return self._transcribe_local(audio_path, language=language)
            raise

    def _transcribe_api(
        self, audio_path: str, language: Optional[str] = None
    ) -> Dict[str, Any]:
        """Transcribe using the OpenAI Whisper API."""
        import requests

        if not self.api_key:
            raise ValueError(
                "OpenAI API key not configured. Set OPENAI_API_KEY environment "
                "variable or pass api_key to WhisperClient."
            )

        headers = {"Authorization": f"Bearer {self.api_key}"}

        with open(audio_path, "rb") as f:
            files = {"file": (os.path.basename(audio_path), f, "audio/mpeg")}
            data = {"model": self.model}
            if language:
                data["language"] = language

            response = requests.post(
                "https://api.openai.com/v1/audio/transcriptions",
                headers=headers,
                files=files,
                data=data,
                timeout=120,
            )

        if response.status_code != 200:
            raise RuntimeError(
                f"Whisper API error {response.status_code}: {response.text}"
            )

        result = response.json()

        return {
            "text": result.get("text", "").strip(),
            "segments": result.get("segments", []),
            "language": language or result.get("language", "unknown"),
            "duration": result.get("duration", 0),
            "method": "api",
            "model": self.model,
        }

    def _transcribe_local(
        self, audio_path: str, language: Optional[str] = None
    ) -> Dict[str, Any]:
        """Transcribe using a local whisper model (faster-whisper)."""
        try:
            from faster_whisper import WhisperModel
        except ImportError:
            # Fallback to openai-whisper
            try:
                import whisper
                return self._transcribe_local_whisper(audio_path, language=language)
            except ImportError:
                raise ImportError(
                    "Local transcription requires either 'faster-whisper' or 'openai-whisper'. "
                    "Install with: pip install faster-whisper"
                )

        if self._local_model is None:
            self._local_model = WhisperModel(
                self.local_model_size,
                device="cpu",
                compute_type="int8",
            )

        segments, info = self._local_model.transcribe(
            audio_path,
            language=language,
            beam_size=5,
        )

        text_parts = []
        segment_list = []
        for segment in segments:
            text_parts.append(segment.text)
            segment_list.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text,
            })

        return {
            "text": " ".join(text_parts).strip(),
            "segments": segment_list,
            "language": info.language if info else (language or "unknown"),
            "duration": info.duration if info else 0,
            "method": "local",
            "model": self.local_model_size,
        }

    def _transcribe_local_whisper(
        self, audio_path: str, language: Optional[str] = None
    ) -> Dict[str, Any]:
        """Fallback transcription using openai-whisper."""
        import whisper

        model = whisper.load_model(self.local_model_size)
        result = model.transcribe(audio_path, language=language)

        return {
            "text": result.get("text", "").strip(),
            "segments": [
                {"start": s.get("start"), "end": s.get("end"), "text": s.get("text")}
                for s in result.get("segments", [])
            ],
            "language": result.get("language", language or "unknown"),
            "duration": result.get("duration", 0),
            "method": "local-whisper",
            "model": self.local_model_size,
        }

    def transcribe_batch(
        self,
        audio_paths: List[str],
        language: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Transcribe multiple audio files.

        Args:
            audio_paths: List of paths to audio files.
            language: Optional language code for all files.

        Returns:
            List of transcription results.
        """
        results = []
        for path in audio_paths:
            try:
                result = self.transcribe(path, language=language)
                results.append(result)
            except Exception as e:
                print(f"Transcription failed for {path}: {e}")
                results.append({
                    "text": "",
                    "error": str(e),
                    "path": path,
                })
        return results