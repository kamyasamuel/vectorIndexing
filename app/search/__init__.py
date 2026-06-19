"""
Search module for the Vector Indexing System.

Provides hybrid search combining BM25 keyword search with FAISS vector similarity,
merged via Reciprocal Rank Fusion (RRF).
"""

from app.search.bm25_indexer import BM25Indexer
from app.search.hybrid_searcher import HybridSearcher, rrf_merge