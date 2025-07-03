from typing import List, Dict, Any, Union, Optional
import os
from pathlib import Path

from app.utils.chunking import Document, DocumentChunk, chunk_document
from app.loaders.pdf_loader import PDFLoader
from app.loaders.text_loader import TextLoader
from app.loaders.docx_loader import DocxLoader
from app.loaders.audio_loader import AudioLoader
from app.storage.vector_store import VectorStore
from app.storage.metadata_store import MetadataStore
from config import CHUNK_SIZE, CHUNK_OVERLAP

class DocumentIndexer:
    """Main class for indexing documents."""
    
    def __init__(self):
        self.vector_store = VectorStore()
        self.metadata_store = MetadataStore()
        
    def index_file(self, file_path: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        """Index a single file based on its extension."""
        file_ext = Path(file_path).suffix.lower()
        
        # Select appropriate loader
        if file_ext == ".pdf":
            document = PDFLoader.load(file_path)
        elif file_ext in [".txt", ".md", ".rst"]:
            document = TextLoader.load(file_path)
        elif file_ext in [".docx", ".doc"]:
            document = DocxLoader.load(file_path)
        elif file_ext in [".mp3", ".wav", ".ogg", ".flac"]:
            document = AudioLoader.load(file_path)
        else:
            raise ValueError(f"Unsupported file extension: {file_ext}")
        
        # Merge any provided metadata with document metadata
        if metadata:
            document.metadata.update(metadata)
            
        # Add document metadata
        self.vector_store.add_document(
            document.id, 
            document.content, 
            document.metadata
        )
        
        # Store document in metadata store
        # Update metadata with essential info that might be needed later
        document.metadata["filename"] = document.metadata.get("filename", os.path.basename(file_path))
        document.metadata["source"] = document.metadata.get("source", file_path)
        document.metadata["file_type"] = document.metadata.get("file_type", file_ext[1:] if file_ext.startswith('.') else file_ext)
        
        # We don't need file_type as a separate parameter, it's already in metadata
        self.metadata_store.add_document(
            document.id,
            document.content,
            document.metadata
        )
        
        # Chunk document
        chunks = chunk_document(document, CHUNK_SIZE, CHUNK_OVERLAP)
        
        # Add chunks to vector store
        chunk_ids = self.vector_store.add_document_chunks(chunks)
        
        return document.id
    
    def index_directory(self, dir_path: str, extensions: Optional[List[str]] = None) -> List[str]:
        """Index all files in a directory with given extensions."""
        if not os.path.isdir(dir_path):
            raise ValueError(f"Directory not found: {dir_path}")
            
        extensions = extensions or [".pdf", ".txt", ".docx", ".md"]
        document_ids = []
        
        for root, _, files in os.walk(dir_path):
            for file in files:
                file_path = os.path.join(root, file)
                file_ext = os.path.splitext(file)[1].lower()
                
                if file_ext in extensions:
                    try:
                        doc_id = self.index_file(file_path)
                        document_ids.append(doc_id)
                    except Exception as e:
                        print(f"Failed to index {file_path}: {str(e)}")
        
        return document_ids