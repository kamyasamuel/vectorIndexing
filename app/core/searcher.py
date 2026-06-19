from typing import List, Dict, Any, Optional
import numpy as np
import json

from app.core.embedder import DocumentEmbedder
from app.storage.vector_store import VectorStore
from app.storage.metadata_store import MetadataStore
from app.ai.ollama_client import OllamaClient
from app.ai.deepseek_client import DeepSeekClient
from app.ai.agentic_qa import AgenticQATuner

class DocumentSearcher:
    """Handles document search and retrieval."""
    
    def __init__(self):
        self.vector_store = VectorStore()
        self.metadata_store = MetadataStore()
        self.embedder = DocumentEmbedder()
        self.ollama_client = OllamaClient()
        self.deepseek_client = DeepSeekClient()
        self.agentic_qa = AgenticQATuner()
    
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
        try:
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
            
            # Get completion from DeepSeek
            answer = self.deepseek_client.get_completion(prompt)
            
            # Return answer with source references
            sources = []
            for chunk in chunks:
                document_id = chunk["document_id"]
                document = self.vector_store.get_document_by_id(document_id)
                
                if document:
                    # Safely extract metadata
                    metadata = {}
                    if isinstance(document.get("metadata"), dict):
                        metadata = document["metadata"]
                    elif isinstance(document.get("metadata"), str):
                        try:
                            metadata = json.loads(document["metadata"])
                        except json.JSONDecodeError:
                            metadata = {"filename": "Unknown"}
                            
                    filename = metadata.get("filename", "Unknown")
                    
                    sources.append({
                        "id": chunk["id"],
                        "document_id": document_id,
                        "document_title": filename,
                        "filename": filename,
                        "source": metadata.get("source", document.get("source", "")),
                        "metadata": {
                            "filename": filename,
                            "source": metadata.get("source", document.get("source", "")),
                        },
                        "similarity": chunk["similarity"]
                    })
            
            return {
                "answer": answer,
                "sources": sources
            }
        except Exception as e:
            print(f"Error in answer_question: {str(e)}")
            return {
                "answer": f"An error occurred while processing your query: {str(e)}",
                "sources": []
            }
    
    def agentic_answer_question(
        self,
        query: str,
        max_iterations: int = 3,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Answer a question using the agentic multi-turn Q&A engine.
        
        The engine iteratively retrieves context, critiques it for sufficiency,
        refines the search query when information is missing, and synthesizes
        a comprehensive answer. Conversation history is maintained with
        automatic context compression when it exceeds 25,000 tokens.
        
        Args:
            query: The user's question.
            max_iterations: Maximum number of retrieval+critique rounds (default 3).
            history: List of previous conversation turns, each with
                     {"role": "user"|"assistant", "content": "..."}
            
        Returns:
            Dict with keys: answer, sources, iterations, confidence, total_iterations,
                            compressed_history
        """
        return self.agentic_qa.agentic_answer(
            query,
            max_iterations=max_iterations,
            history=history,
        )
    
    def filter_by_metadata(self, query: str, filters: Dict[str, Any], top_k: int = 5, candidate_k: int = 200) -> List[Dict[str, Any]]:
        """Search with metadata filtering.
        
        Uses SQL-level filtering first (via MetadataStore.search_by_metadata),
        then cross-references with vector similarity search results.
        
        For each document that matches the metadata filters, its best-matching
        chunk is included in the results.
        
        Args:
            query: The text search query.
            filters: Dict of metadata field-value pairs to filter by.
                     Supports __icontains and __iexact suffixes for case-insensitive matching.
            top_k: Number of results to return.
            candidate_k: Number of vector search candidates to consider (higher = slower but more thorough).
        """
        # Strategy: Get metadata-matching document IDs from SQL, then rank their chunks by vector similarity
        
        # 1. Get document IDs that match the metadata filters from SQL
        metadata_matches = self.metadata_store.search_by_metadata(filters, limit=candidate_k)
        if not metadata_matches:
            return []
        
        matching_doc_ids = {doc["id"] for doc in metadata_matches}
        
        # 2. Get vector search candidates
        vector_results = self.similarity_search(query, top_k=candidate_k)
        
        # 3. Intersect: keep only chunks whose document_id is in the metadata-matching set
        filtered_results = []
        seen_doc_ids = set()
        
        for result in vector_results:
            doc_id = result.get("document_id", "")
            if doc_id in matching_doc_ids and doc_id not in seen_doc_ids:
                # Enrich result with full document metadata from metadata store
                doc = self.metadata_store.get_document(doc_id)
                if doc:
                    # Merge document-level metadata into the chunk result
                    result["metadata"] = {
                        **doc.get("metadata", {}),
                        **result.get("metadata", {})
                    }
                    result["filename"] = doc.get("title", "")
                    result["file_type"] = doc.get("file_type", "")
                    result["source"] = doc.get("source", "")
                
                filtered_results.append(result)
                seen_doc_ids.add(doc_id)
                
                if len(filtered_results) >= top_k:
                    break
        
        # 4. Fallback: If not enough results via vector intersection, 
        #    try post-filtering from vector results (handles tags stored in vector store metadata)
        if len(filtered_results) < top_k and vector_results:
            for result in vector_results:
                doc_id = result.get("document_id", "")
                if doc_id in seen_doc_ids:
                    continue
                
                fallback_match = True
                metadata = result.get("metadata", {})
                for key, value in filters.items():
                    # Skip tag filter (handled by SQL) and suffix-based keys (handled by SQL)
                    if key == "tags" or key.endswith("__icontains") or key.endswith("__iexact"):
                        continue
                    
                    if key in metadata:
                        stored_val = metadata[key]
                        # Type coercion: try to match string values as numbers if needed
                        if isinstance(stored_val, (int, float)) and isinstance(value, str):
                            try:
                                if stored_val != type(stored_val)(value):
                                    fallback_match = False
                                    break
                            except (TypeError, ValueError):
                                fallback_match = False
                                break
                        # Case-insensitive string comparison
                        elif isinstance(stored_val, str) and isinstance(value, str):
                            if stored_val.lower() != value.lower():
                                fallback_match = False
                                break
                        # Handle list values (e.g., tags)
                        elif isinstance(stored_val, list) and isinstance(value, str):
                            if value not in stored_val:
                                fallback_match = False
                                break
                        # Default exact match
                        elif stored_val != value:
                            fallback_match = False
                            break
                    else:
                        fallback_match = False
                        break
                
                if fallback_match:
                    filtered_results.append(result)
                    seen_doc_ids.add(doc_id)
                    
                    if len(filtered_results) >= top_k:
                        break
        
        return filtered_results[:top_k]
