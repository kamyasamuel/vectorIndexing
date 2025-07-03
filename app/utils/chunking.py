from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import uuid

@dataclass
class Document:
    """Base document class."""
    id: str
    content: str
    metadata: Dict[str, Any]
    
    def __init__(self, content: str, metadata: Optional[Dict[str, Any]] = None, id: Optional[str] = None):
        self.id = id or str(uuid.uuid4())
        self.content = content
        self.metadata = metadata or {}

@dataclass
class DocumentChunk:
    """Chunk of a document with its own ID and reference to parent document."""
    id: str
    content: str
    document_id: str
    chunk_index: int
    metadata: Dict[str, Any]
    
    def __init__(self, content: str, document_id: str, chunk_index: int, 
                 metadata: Optional[Dict[str, Any]] = None, id: Optional[str] = None):
        self.id = id or str(uuid.uuid4())
        self.content = content
        self.document_id = document_id
        self.chunk_index = chunk_index
        self.metadata = metadata or {}

def chunk_document(document: Document, chunk_size: int = 512, 
                  chunk_overlap: int = 128) -> List[DocumentChunk]:
    """Split a document into overlapping chunks."""
    text = document.content
    chunks = []
    
    # Simple character-based chunking (could be improved with sentence boundaries)
    start = 0
    chunk_index = 0
    
    while start < len(text):
        # Calculate end position with overlap
        end = min(start + chunk_size, len(text))
        
        # Extract the chunk
        chunk_text = text[start:end]
        
        # Create chunk with metadata from parent document
        chunk = DocumentChunk(
            content=chunk_text,
            document_id=document.id,
            chunk_index=chunk_index,
            metadata={**document.metadata, "chunk_index": chunk_index}
        )
        
        chunks.append(chunk)
        
        # Move to next chunk position with overlap
        start += chunk_size - chunk_overlap
        chunk_index += 1
        
        # Break if we've reached the end
        if start >= len(text):
            break
    
    return chunks