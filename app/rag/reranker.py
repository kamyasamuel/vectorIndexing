"""
Cross-Encoder reranker for the advanced RAG pipeline.

After initial retrieval (BM25 + FAISS), results are reranked using a
cross-encoder model that jointly scores each query-document pair.
This is more accurate than the dot-product similarity of bi-encoders
used during initial retrieval.

Uses the `cross-encoder/ms-marco-MiniLM-L-6-v2` model from SentenceTransformers,
which is optimized for:
- Fast inference (~20ms per pair on CPU)
- MS MARCO passage ranking dataset
- Relevance scoring for search/QA
"""

from typing import List, Dict, Any, Optional, Tuple

import numpy as np


class CrossEncoderReranker:
    """Reranks retrieved chunks using a cross-encoder model.
    
    The cross-encoder jointly processes query+chunk pairs, producing a
    relevance score that is more accurate than the bi-encoder cosine similarity.
    This is used to reorder the top-N candidates after initial retrieval.
    """
    
    def __init__(
        self,
        model_name: str = "cross-encoder/ms-marco-MiniLM-L-6-v2",
        device: str = "cpu",
        enabled: bool = True,
    ):
        self.model_name = model_name
        self.device = device
        self.enabled = enabled
        self._model = None
    
    def _load_model(self):
        """Lazy-load the cross-encoder model."""
        if self._model is not None:
            return
        
        try:
            from sentence_transformers import CrossEncoder
            self._model = CrossEncoder(
                self.model_name,
                device=self.device,
                max_length=512,
            )
            print(f"Loaded cross-encoder model: {self.model_name}")
        except Exception as e:
            print(f"Failed to load cross-encoder model '{self.model_name}': {e}")
            print("Reranking will be disabled. Install sentence-transformers if needed.")
            self.enabled = False
            self._model = None
    
    def rerank(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        top_k: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Rerank a list of chunks by their relevance to the query.
        
        Args:
            query: The original search query.
            chunks: List of chunk dicts, each with at least "content" key.
            top_k: Number of top results to return after reranking.
                   If None, returns all reranked results.
                   
        Returns:
            Reranked chunks with "rerank_score" added.
        """
        if not self.enabled or not chunks:
            return chunks
        
        self._load_model()
        if self._model is None:
            return chunks
        
        if top_k is None:
            top_k = len(chunks)
        
        try:
            # Prepare query-document pairs
            pairs = [(query, chunk.get("content", "")) for chunk in chunks]
            
            # Get relevance scores
            scores = self._model.predict(pairs)
            
            # Add scores to chunks
            for i, chunk in enumerate(chunks):
                chunk["rerank_score"] = float(scores[i])
            
            # Sort by rerank score (highest first)
            reranked = sorted(
                chunks,
                key=lambda c: c.get("rerank_score", 0.0),
                reverse=True,
            )
            
            return reranked[:top_k]
            
        except Exception as e:
            print(f"Reranking failed (returning original order): {e}")
            return chunks[:top_k]
    
    def score_pair(self, query: str, document: str) -> float:
        """Score a single query-document pair.
        
        Args:
            query: The query string.
            document: The document/chunk content.
            
        Returns:
            Relevance score between 0 and 1.
        """
        if not self.enabled:
            return 0.0
        
        self._load_model()
        if self._model is None:
            return 0.0
        
        try:
            score = self._model.predict([(query, document)])[0]
            return float(score)
        except Exception:
            return 0.0