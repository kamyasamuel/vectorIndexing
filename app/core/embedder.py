from typing import List, Dict, Any
import numpy as np

from app.ai.ollama_client import OllamaClient
from app.utils.chunking import Document, DocumentChunk

class DocumentEmbedder:
    """Handles embedding generation for documents and queries."""
    
    def __init__(self):
        self.ollama_client = OllamaClient()
    
    def embed_text(self, text: str) -> List[float]:
        """Generate embeddings for a piece of text."""
        return self.ollama_client.get_embedding(text)
    
    def embed_document(self, document: Document) -> Dict[str, Any]:
        """Generate embeddings for a whole document."""
        embedding = self.embed_text(document.content)
        
        return {
            "id": document.id,
            "embedding": embedding,
            "metadata": document.metadata
        }
    
    def embed_chunks(self, chunks: List[DocumentChunk]) -> List[Dict[str, Any]]:
        """Generate embeddings for document chunks."""
        embedded_chunks = []
        
        for chunk in chunks:
            embedding = self.embed_text(chunk.content)
            
            embedded_chunks.append({
                "id": chunk.id,
                "document_id": chunk.document_id,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "embedding": embedding,
                "metadata": chunk.metadata
            })
            
        return embedded_chunks
    
    def embed_query(self, query: str) -> List[float]:
        """Generate embeddings for a search query."""
        return self.embed_text(query)
    
    def calculate_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """Calculate cosine similarity between two embeddings."""
        embedding1_array = np.array(embedding1)
        embedding2_array = np.array(embedding2)
        
        # Calculate cosine similarity
        similarity = np.dot(embedding1_array, embedding2_array) / (
            np.linalg.norm(embedding1_array) * np.linalg.norm(embedding2_array)
        )
        
        return float(similarity)
