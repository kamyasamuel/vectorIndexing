"""Document viewing endpoints for serving file content."""

import os
import base64
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from app.core.indexer import DocumentIndexer
from app.loaders.docx_loader import DocxLoader

router = APIRouter()
indexer = DocumentIndexer()

# MIME type mapping for common file types
MIME_TYPES = {
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".rst": "text/x-rst; charset=utf-8",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".csv": "text/csv; charset=utf-8",
    ".json": "application/json",
    ".xml": "application/xml",
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".py": "text/x-python; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".ts": "text/typescript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".yaml": "text/yaml; charset=utf-8",
    ".yml": "text/yaml; charset=utf-8",
    # Images
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    # Audio
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".m4a": "audio/mp4",
    ".wma": "audio/x-ms-wma",
    # Video
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".avi": "video/x-msvideo",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
}


def _get_mime_type(file_path: str) -> str:
    """Get MIME type for a file based on its extension."""
    _, ext = os.path.splitext(file_path)
    return MIME_TYPES.get(ext.lower(), "application/octet-stream")


def _is_text_type(file_path: str) -> bool:
    """Check if a file is a text-based type that can be read directly."""
    _, ext = os.path.splitext(file_path)
    text_extensions = {
        ".txt", ".md", ".rst", ".csv", ".json", ".xml",
        ".html", ".htm", ".py", ".js", ".ts", ".css",
        ".yaml", ".yml", ".sh", ".bash", ".zsh", ".env",
        ".cfg", ".conf", ".ini", ".toml", ".log",
    }
    return ext.lower() in text_extensions


def _is_image_type(file_path: str) -> bool:
    """Check if a file is an image type."""
    _, ext = os.path.splitext(file_path)
    image_extensions = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico"}
    return ext.lower() in image_extensions


def _is_audio_type(file_path: str) -> bool:
    """Check if a file is an audio type."""
    _, ext = os.path.splitext(file_path)
    audio_extensions = {".mp3", ".wav", ".ogg", ".flac", ".m4a", ".wma"}
    return ext.lower() in audio_extensions


def _is_video_type(file_path: str) -> bool:
    """Check if a file is a video type."""
    _, ext = os.path.splitext(file_path)
    video_extensions = {".mp4", ".webm", ".avi", ".mov", ".mkv"}
    return ext.lower() in video_extensions


def _read_text_content(file_path: str) -> str:
    """Read a text file with encoding detection."""
    encodings = ["utf-8", "latin-1", "cp1252", "iso-8859-1"]
    for encoding in encodings:
        try:
            with open(file_path, "r", encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
        except Exception:
            break
    # Fallback: read with errors='replace'
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


@router.get("/documents/{document_id}/view")
async def view_document(document_id: str, format: Optional[str] = Query(None)):
    """View document content. Returns file content or extracted text based on type.
    
    Query params:
      - format: 'raw' forces raw file download, 'text' forces text extraction.
                If omitted, the best representation is chosen automatically.
    """
    try:
        doc = indexer.metadata_store.get_document(document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        source = doc.get("source", "")
        if not source:
            raise HTTPException(status_code=404, detail="Document source path not found")
        
        file_ext = os.path.splitext(source)[1].lower()
        filename = doc.get("title") or os.path.basename(source) or "document"
        file_type = doc.get("metadata", {}).get("file_type", "") or file_ext[1:] if file_ext.startswith(".") else file_ext
        
        # Determine content type for the response
        content_type = _get_mime_type(source)
        
        # Build response info
        response_info = {
            "document_id": document_id,
            "filename": filename,
            "file_type": file_type,
            "file_size": doc.get("metadata", {}).get("file_size", 0) or os.path.getsize(source) if os.path.exists(source) else 0,
            "source": source,
            "metadata": doc.get("metadata", {}),
            "content_type": content_type,
        }
        
        # If the file doesn't exist on disk, try to return extracted text only
        if not os.path.exists(source):
            # Return whatever text we have stored
            content = doc.get("content", doc.get("text", ""))
            if not content:
                raise HTTPException(status_code=404, detail="File not found on disk and no cached content available")
            response_info["content"] = content
            response_info["view_type"] = "text"
            response_info["is_binary"] = False
            return response_info
        
        # For text-based files, read and return content inline
        if _is_text_type(source):
            content = _read_text_content(source)
            response_info["content"] = content
            response_info["view_type"] = "text"
            response_info["is_binary"] = False
            return response_info
        
        # For PDF files, return as raw binary (frontend can embed via iframe)
        if file_ext == ".pdf":
            response_info["view_type"] = "pdf"
            response_info["is_binary"] = True
            response_info["download_url"] = f"/api/documents/{document_id}/download"
            # Also include extracted text if available for search within document
            try:
                extracted = doc.get("content", doc.get("text", ""))
                if extracted:
                    # Truncate large text for the view response
                    max_chars = 50000
                    response_info["extracted_text"] = extracted[:max_chars]
                    if len(extracted) > max_chars:
                        response_info["extracted_text"] += "\n\n... [content truncated for performance]"
            except Exception:
                pass
            return response_info
        
        # For DOCX files, extract and return text
        if file_ext in (".docx", ".doc"):
            try:
                docx_doc = DocxLoader.load(source)
                response_info["content"] = docx_doc.content
                response_info["view_type"] = "text"
                response_info["is_binary"] = False
            except Exception as e:
                # Fallback: return file as binary download
                response_info["view_type"] = "binary"
                response_info["is_binary"] = True
                response_info["error"] = f"Could not extract text: {str(e)}"
            return response_info
        
        # For images, return metadata + file can be fetched via download URL
        if _is_image_type(source):
            img_info = {}
            try:
                from PIL import Image
                with Image.open(source) as img:
                    img_info["width"] = img.width
                    img_info["height"] = img.height
                    img_info["mode"] = img.mode
            except Exception:
                pass
            
            # Read and base64-encode the image for inline display
            try:
                with open(source, "rb") as f:
                    img_b64 = base64.b64encode(f.read()).decode("utf-8")
                response_info["content_base64"] = img_b64
                response_info["content_type"] = content_type
            except Exception:
                pass
            
            response_info["image_info"] = img_info
            response_info["view_type"] = "image"
            response_info["is_binary"] = True
            response_info["download_url"] = f"/api/documents/{document_id}/download"
            return response_info
        
        # For audio files, return metadata + the file can be played via download URL
        if _is_audio_type(source):
            response_info["view_type"] = "audio"
            response_info["is_binary"] = True
            response_info["download_url"] = f"/api/documents/{document_id}/download"
            # Read and base64-encode the audio for inline playback
            try:
                with open(source, "rb") as f:
                    audio_b64 = base64.b64encode(f.read()).decode("utf-8")
                response_info["content_base64"] = audio_b64
                response_info["content_type"] = content_type
            except Exception:
                pass
            return response_info
        
        # For video files, return metadata + download URL
        if _is_video_type(source):
            response_info["view_type"] = "video"
            response_info["is_binary"] = True
            response_info["download_url"] = f"/api/documents/{document_id}/download"
            # Read and base64-encode the video for inline playback
            try:
                with open(source, "rb") as f:
                    video_b64 = base64.b64encode(f.read()).decode("utf-8")
                response_info["content_base64"] = video_b64
                response_info["content_type"] = content_type
            except Exception:
                pass
            return response_info
        
        # Fallback for unknown types: try to read as text, or return binary info
        try:
            content = _read_text_content(source)
            response_info["content"] = content
            response_info["view_type"] = "text"
            response_info["is_binary"] = False
        except Exception:
            response_info["view_type"] = "binary"
            response_info["is_binary"] = True
            response_info["download_url"] = f"/api/documents/{document_id}/download"
        
        return response_info
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))