"""
BM25 keyword indexer for hybrid search.

Builds and maintains a BM25 (Best Matching 25) keyword index over document chunks,
enabling exact keyword matching alongside semantic vector search.

The BM25 index is rebuilt incrementally as new chunks are added.
"""

import json
import os
import pickle
import sqlite3
from typing import List, Dict, Any, Optional, Tuple

import numpy as np
from rank_bm25 import BM25Okapi

from app.utils.chunking import DocumentChunk
from config import VECTOR_DB_PATH


class BM25Indexer:
    """BM25 keyword index built from document chunk content.
    
    The index is persisted as a pickle file alongside the FAISS index.
    Rebuilt incrementally when new chunks are added.
    """
    
    def __init__(self, index_path: str = None):
        self.index_path = index_path or os.path.join(VECTOR_DB_PATH, "bm25_index.pkl")
        self.doc_ids_path = self.index_path.replace(".pkl", "_doc_ids.pkl")
        
        self.bm25: Optional[BM25Okapi] = None
        self.corpus: List[str] = []          # Raw text of each chunk
        self.chunk_ids: List[str] = []       # Parallel list of chunk IDs
        self.tokenized_corpus: List[List[str]] = []  # Tokenized for BM25
        
        self._load_or_create()
    
    def _load_or_create(self):
        """Load existing BM25 index from disk or initialize empty."""
        if os.path.exists(self.index_path) and os.path.exists(self.doc_ids_path):
            try:
                with open(self.index_path, "rb") as f:
                    self.tokenized_corpus = pickle.load(f)
                with open(self.doc_ids_path, "rb") as f:
                    data = pickle.load(f)
                    self.chunk_ids = data["chunk_ids"]
                    self.corpus = data["corpus"]
                
                if self.tokenized_corpus:
                    self.bm25 = BM25Okapi(self.tokenized_corpus)
                return
            except Exception as e:
                print(f"Warning: Failed to load BM25 index, rebuilding: {e}")
        
        self.bm25 = None
        self.corpus = []
        self.chunk_ids = []
        self.tokenized_corpus = []
    
    def add_chunks(self, chunks: List[DocumentChunk]):
        """Add new chunks to the BM25 index.
        
        Args:
            chunks: List of DocumentChunk objects to index.
        """
        new_texts = [chunk.content for chunk in chunks]
        new_ids = [chunk.id for chunk in chunks]
        
        self.corpus.extend(new_texts)
        self.chunk_ids.extend(new_ids)
        
        # Tokenize new texts
        new_tokenized = [self._tokenize(text) for text in new_texts]
        self.tokenized_corpus.extend(new_tokenized)
        
        # Rebuild BM25 model
        if self.tokenized_corpus:
            self.bm25 = BM25Okapi(self.tokenized_corpus)
        else:
            self.bm25 = None
        
        self._persist()
    
    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text into words for BM25.
        
        Lowercases, splits on non-alphanumeric, removes short tokens.
        """
        import re
        tokens = re.findall(r'\b\w+\b', text.lower())
        # Filter out very short tokens (usually noise)
        return [t for t in tokens if len(t) >= 2]
    
    def search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Search using BM25 keyword matching.
        
        Args:
            query: The search query text.
            top_k: Number of results to return.
            
        Returns:
            List of dicts with keys: id, content, score, rank
        """
        if self.bm25 is None or not self.tokenized_corpus:
            return []
        
        tokenized_query = self._tokenize(query)
        if not tokenized_query:
            return []
        
        # Get BM25 scores for all documents
        scores = self.bm25.get_scores(tokenized_query)
        
        # Get top-k indices
        actual_k = min(top_k, len(scores))
        top_indices = np.argsort(scores)[::-1][:actual_k]
        
        results = []
        for idx in top_indices:
            score = float(scores[idx])
            if score <= 0:
                continue
            
            results.append({
                "id": self.chunk_ids[idx],
                "content": self.corpus[idx],
                "score": score,
                "rank": len(results) + 1
            })
        
        return results
    
    def remove_chunks_by_ids(self, chunk_ids_to_remove: set):
        """Remove chunks from the BM25 index by their IDs."""
        new_corpus = []
        new_chunk_ids = []
        new_tokenized = []
        
        for i, cid in enumerate(self.chunk_ids):
            if cid not in chunk_ids_to_remove:
                new_corpus.append(self.corpus[i])
                new_chunk_ids.append(cid)
                new_tokenized.append(self.tokenized_corpus[i])
        
        self.corpus = new_corpus
        self.chunk_ids = new_chunk_ids
        self.tokenized_corpus = new_tokenized
        
        if self.tokenized_corpus:
            self.bm25 = BM25Okapi(self.tokenized_corpus)
        else:
            self.bm25 = None
        
        self._persist()
    
    def clear(self):
        """Clear the entire BM25 index."""
        self.bm25 = None
        self.corpus = []
        self.chunk_ids = []
        self.tokenized_corpus = []
        self._persist()
    
    @property
    def size(self) -> int:
        """Number of chunks in the BM25 index."""
        return len(self.chunk_ids)
    
    def _persist(self):
        """Persist BM25 index to disk."""
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        
        with open(self.index_path, "wb") as f:
            pickle.dump(self.tokenized_corpus, f)
        
        with open(self.doc_ids_path, "wb") as f:
            pickle.dump({
                "chunk_ids": self.chunk_ids,
                "corpus": self.corpus,
            }, f)