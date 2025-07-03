from typing import List, Dict, Any, Union, Optional
import os
from pathlib import Path

from app.utils.chunking import Document, DocumentChunk, chunk_document
from app.loaders.pdf_loader import PDFLoader
from app.loaders.text_loader import TextLoader
from app.storage.vector_store import VectorStore
from config import CHUNK_SIZE, CHUNK_OVERLAP

class DocumentIndexer:
    """Main class for indexing documents."""
    
    def __init__(self):
        self.vector_store = VectorStore()
        
    def index_file(self, file_path: str) -> str:
        """Index a single file based on its extension."""
        file_ext = Path(file_path).suffix.lower()
        
        # Select appropriate loader
        if file_ext == ".pdf":
            document = PDFLoader.load(file_path)
        elif file_ext in [".txt", ".md", ".rst"]:
            document = TextLoader.load(file_path)
        elif file_ext in [".docx", ".doc"]:
            # Assuming you have a DocxLoader class
            document = DocxLoader.load(file_path)
        else:
            raise ValueError(f"Unsupported file extension: {file_ext}")
            
        # Add document metadata
        self.vector_store.add_document(
            document.id, 
            document.content, 
            document.metadata
        )
        
        # Chunk document
        chunks = chunk_document(document, CHUNK_SIZE, CHUNK_OVERLAP)
        
        # Add chunks to vector store
        chunk_ids = self.vector_store.add_document_chunks(chunks)
        
        return document.id
    
    def index_directory(self, dir_path: str, extensions: List[str] = None) -> List[str]:
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