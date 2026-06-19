from typing import List, Dict, Any, Optional
import os
import logging

from app.utils.chunking import Document
from app.ai.whisper_client import WhisperClient

logger = logging.getLogger(__name__)


class AudioLoader:
    """Loader for audio files using Whisper speech-to-text transcription.
    
    Supports common audio formats via ffmpeg:
    - MP3, WAV, OGG, FLAC, M4A, AAC, WMA
    
    Configuration:
    - Uses OpenAI Whisper API by default
    - Falls back to local model if OPENAI_API_KEY is not set
    - Local model size configurable via WHISPER_MODEL_SIZE env var
    """
    
    _whisper_client: Optional[WhisperClient] = None
    
    @classmethod
    def _get_client(cls) -> WhisperClient:
        """Get or create the Whisper client singleton."""
        if cls._whisper_client is None:
            cls._whisper_client = WhisperClient(
                api_key=os.getenv("OPENAI_API_KEY"),
                local_fallback=True,
                local_model_size=os.getenv("WHISPER_MODEL_SIZE", "base"),
            )
        return cls._whisper_client
    
    @classmethod
    def load(cls, file_path: str, language: Optional[str] = None) -> Document:
        """Load audio file and transcribe to text.
        
        Args:
            file_path: Path to the audio file.
            language: Optional ISO language code (e.g., "en", "fr").
                Auto-detected if not provided.
                
        Returns:
            Document with transcribed text content and metadata.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        # Extract metadata
        filename = os.path.basename(file_path)
        file_size = os.path.getsize(file_path)
        file_ext = os.path.splitext(file_path)[1].lower()
        
        logger.info(f"Transcribing audio file: {filename} ({file_size} bytes)")
        
        # Transcribe using Whisper
        client = cls._get_client()
        result = client.transcribe(file_path, language=language)
        
        transcription = result.get("text", "").strip()
        if not transcription:
            logger.warning(f"Empty transcription for {filename}")
        
        # Build comprehensive metadata
        metadata = {
            "source": file_path,
            "filename": filename,
            "file_size": file_size,
            "file_type": file_ext[1:] if file_ext.startswith('.') else file_ext,
            "transcription_method": result.get("method", "unknown"),
            "transcription_model": result.get("model", "unknown"),
            "audio_duration_seconds": result.get("duration", 0),
            "detected_language": result.get("language", "unknown"),
            "word_count": len(transcription.split()) if transcription else 0,
        }
        
        # Include segment-level timing if available
        segments = result.get("segments", [])
        if segments:
            metadata["segment_count"] = len(segments)
        
        return Document(
            content=transcription or f"[No speech detected in audio file: {filename}]",
            metadata=metadata
        )
    
    @classmethod
    def load_with_timestamps(cls, file_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        """Load audio file and return transcription with timestamp segments.
        
        Args:
            file_path: Path to the audio file.
            language: Optional language code.
            
        Returns:
            Dict with keys: document (Document), segments (list of {start, end, text}),
                           duration, language.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        client = cls._get_client()
        result = client.transcribe(file_path, language=language)
        
        document = cls.load(file_path, language=language)
        
        return {
            "document": document,
            "segments": result.get("segments", []),
            "duration": result.get("duration", 0),
            "language": result.get("language", "unknown"),
        }
