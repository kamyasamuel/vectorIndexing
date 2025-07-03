from typing import List, Dict, Any, Optional
import numpy as np

from app.core.embedder import DocumentEmbedder
from app.storage.vector_store import VectorStore
from app.storage.metadata_store import MetadataStore
from app.ai.ollama_client import OllamaClient

class DocumentSearcher:
    """Handles document search and retrieval."""
    
    def __init__(self):
        self.vector_store = VectorStore()
        self.metadata_store = MetadataStore()
        self.embedder = DocumentEmbedder()
        self.ollama_client = OllamaClient()
    
    def similarity_search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for documents similar to the query."""
        # Delegate to vector store
        return self.vector_store.similarity_search(query, top_k)
    
    def search_and_get_documents(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for chunks and include full document metadata."""
        # Get similar chunks
        similar_chunks = self.similarity_search(query, top_k)
        
        # For each chunk, get the parent document
        for chunk in similar_chunks:
            document_id = chunk["document_id"]
            document = self.vector_store.get_document_by_id(document_id)
            if document:
                chunk["document"] = document
                
        return similar_chunks
    
    def answer_question(self, query: str, context_window: int = 5) -> Dict[str, Any]:
        """Answer a question using retrieved context."""
        # Get relevant chunks
        chunks = self.similarity_search(query, context_window)
        
        if not chunks:
            return {
                "answer": "I couldn't find any relevant information to answer your question.",
                "sources": []
            }
        
        # Format context for the LLM
        context = "\n\n".join([chunk["content"] for chunk in chunks])
        
        # Create prompt for the LLM
        prompt = f"""Answer the question based on the following context:
        
Context:
{context}

Question: {query}

Answer:"""
        
        # Get completion from Ollama
        answer = self.ollama_client.get_completion(prompt)
        
        # Return answer with source references
        sources = []
        for chunk in chunks:
            document_id = chunk["document_id"]
            document = self.vector_store.get_document_by_id(document_id)
            
            if document:
                sources.append({
                    "id": chunk["id"],
                    "document_id": document_id,
                    "document_title": document.get("metadata", {}).get("filename", "Unknown"),
                    "similarity": chunk["similarity"]
                })
        
        return {
            "answer": answer,
            "sources": sources
        }
    
    def filter_by_metadata(self, query: str, filters: Dict[str, Any], top_k: int = 5) -> List[Dict[str, Any]]:
        """Search with metadata filtering."""
        # Get initial results
        results = self.similarity_search(query, top_k=100)  # Get more results for filtering
        
        # Apply filters
        filtered_results = []
        for result in results:
            metadata = result.get("metadata", {})
            
            # Check if result matches all filters
            match = True
            for key, value in filters.items():
                if key in metadata:
                    # Handle list values (e.g., tags)
                    if isinstance(metadata[key], list) and isinstance(value, str):
                        if value not in metadata[key]:
                            match = False
                            break
                    # Handle exact match
                    elif metadata[key] != value:
                        match = False
                        break
                else:
                    match = False
                    break
                    
            if match:
                filtered_results.append(result)
                
        return filtered_results[:top_k]
