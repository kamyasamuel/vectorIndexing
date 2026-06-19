"""
Hybrid search combining BM25 keyword search with FAISS vector similarity search.

Uses Reciprocal Rank Fusion (RRF) to merge results from both retrieval methods,
providing the best of both worlds:
- BM25: Exact keyword matching (great for proper nouns, codes, regulations)
- FAISS: Semantic similarity (great for conceptual queries, paraphrases)
"""

from typing import List, Dict, Any, Optional, Callable

import numpy as np

from app.search.bm25_indexer import BM25Indexer
from app.core.vector_store import VectorStore
from config import VECTOR_DB_PATH, METADATA_DB_PATH


# Default RRF constant (standard value from literature)
RRF_K = 60


def rrf_merge(
    vector_results: List[Dict[str, Any]],
    keyword_results: List[Dict[str, Any]],
    k: int = RRF_K,
    top_k: int = 5,
    weight_vector: float = 1.0,
    weight_keyword: float = 1.0,
) -> List[Dict[str, Any]]:
    """Merge two ranked result lists using Reciprocal Rank Fusion.
    
    RRF score = Σ(1 / (k + rank_i)) for each document across all result sets.
    
    Args:
        vector_results: Results from vector similarity search.
        keyword_results: Results from BM25 keyword search.
        k: RRF constant (default 60, higher = more weight to top ranks).
        top_k: Number of final results to return.
        weight_vector: Weight multiplier for vector search scores.
        weight_keyword: Weight multiplier for keyword search scores.
        
    Returns:
        Merged and sorted list of results.
    """
    # Build RRF scores per chunk ID
    rrf_scores: Dict[str, float] = {}
    result_map: Dict[str, Dict[str, Any]] = {}
    
    for rank, result in enumerate(vector_results):
        chunk_id = result.get("id", "")
        if not chunk_id:
            continue
        rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + weight_vector * (1.0 / (k + rank + 1))
        result_map[chunk_id] = result
    
    for rank, result in enumerate(keyword_results):
        chunk_id = result.get("id", "")
        if not chunk_id:
            continue
        rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + weight_keyword * (1.0 / (k + rank + 1))
        # Keep the vector result if it exists; otherwise use keyword result
        if chunk_id not in result_map:
            result_map[chunk_id] = result
    
    # Sort by RRF score
    sorted_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)
    
    # Build final results
    merged = []
    for cid in sorted_ids[:top_k]:
        result = dict(result_map[cid])
        result["rrf_score"] = rrf_scores[cid]
        result["search_type"] = "hybrid"
        merged.append(result)
    
    return merged


class HybridSearcher:
    """Performs hybrid search combining BM25 keyword + FAISS vector search.
    
    Usage:
        searcher = HybridSearcher()
        results = searcher.search("quantum computing", top_k=5, mode="hybrid")
        results = searcher.search("regulation 42-B", top_k=5, mode="keyword")  # BM25 only
        results = searcher.search("conceptual query", top_k=5, mode="semantic")  # FAISS only
    """
    
    def __init__(
        self,
        vector_store: Optional[VectorStore] = None,
        bm25_indexer: Optional[BM25Indexer] = None,
    ):
        self.vector_store = vector_store or VectorStore(
            vector_db_path=VECTOR_DB_PATH,
            metadata_db_path=METADATA_DB_PATH,
        )
        self.bm25_indexer = bm25_indexer or BM25Indexer()
    
    def search(
        self,
        query: str,
        top_k: int = 5,
        mode: str = "hybrid",
        bm25_top_k: int = 50,
        vector_top_k: int = 50,
        weight_vector: float = 1.0,
        weight_keyword: float = 0.8,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Search across both BM25 and FAISS indexes.
        
        Args:
            query: The search query.
            top_k: Number of final results to return.
            mode: "hybrid" (default), "semantic" (FAISS only), "keyword" (BM25 only).
            bm25_top_k: Number of candidates from BM25.
            vector_top_k: Number of candidates from FAISS.
            weight_vector: RRF weight for vector results.
            weight_keyword: RRF weight for keyword results.
            filters: Optional metadata filters (only applied to vector results).
            
        Returns:
            Merged and sorted list of results with chunk metadata.
        """
        if mode == "semantic":
            # FAISS only
            raw_results = self.vector_store.similarity_search(query, top_k=top_k)
            for r in raw_results:
                r["search_type"] = "semantic"
            return raw_results
        
        if mode == "keyword":
            # BM25 only
            raw_results = self.bm25_indexer.search(query, top_k=top_k)
            # Enrich with metadata from vector store
            enriched = self._enrich_with_metadata(raw_results)
            return enriched
        
        # Hybrid mode: run both and merge
        vector_results = self.vector_store.similarity_search(query, top_k=vector_top_k)
        keyword_results = self.bm25_indexer.search(query, top_k=bm25_top_k)
        
        if not vector_results and not keyword_results:
            return []
        
        if not vector_results:
            enriched = self._enrich_with_metadata(keyword_results)
            for r in enriched:
                r["search_type"] = "keyword"
            return enriched
        
        if not keyword_results:
            for r in vector_results:
                r["search_type"] = "semantic"
            return vector_results
        
        # Apply optional filters to vector results
        if filters:
            vector_results = self._apply_filters(vector_results, filters)
        
        # Enrich keyword results with document metadata (content is already there)
        keyword_enriched = self._enrich_bm25_with_vector_data(keyword_results)
        
        # Merge via RRF
        merged = rrf_merge(
            vector_results,
            keyword_enriched,
            k=RRF_K,
            top_k=top_k,
            weight_vector=weight_vector,
            weight_keyword=weight_keyword,
        )
        
        # Final enrichment with document metadata
        enriched = self._enrich_with_metadata(merged)
        
        return enriched
    
    def _enrich_with_metadata(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Enrich search results with document-level metadata."""
        for result in results:
            chunk_id = result.get("id", "")
            doc_id = result.get("document_id", "")
            
            if doc_id:
                doc = self.vector_store.get_document_by_id(doc_id)
                if doc:
                    result["filename"] = doc.get("title", "")
                    result["file_type"] = doc.get("file_type", "")
                    result["source"] = doc.get("source", "")
                    if "metadata" not in result or not result["metadata"]:
                        result["metadata"] = doc.get("metadata", {})
                    else:
                        # Merge metadata
                        result["metadata"] = {
                            **doc.get("metadata", {}),
                            **result.get("metadata", {})
                        }
        return results
    
    def _enrich_bm25_with_vector_data(
        self, keyword_results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Add vector store metadata (document_id, similarity) to BM25 results."""
        import sqlite3
        
        enriched = []
        conn = sqlite3.connect(self.vector_store.metadata_db_path)
        cursor = conn.cursor()
        
        try:
            for result in keyword_results:
                chunk_id = result.get("id", "")
                if not chunk_id:
                    continue
                
                cursor.execute(
                    "SELECT document_id, chunk_index, metadata FROM faiss_chunks WHERE chunk_id = ?",
                    (chunk_id,)
                )
                row = cursor.fetchone()
                if row:
                    result["document_id"] = row[0]
                    result["chunk_index"] = row[1]
                    try:
                        result["metadata"] = json.loads(row[2]) if row[2] else {}
                    except (json.JSONDecodeError, TypeError):
                        result["metadata"] = {}
                    result["similarity"] = result.get("score", 0.0)
                
                enriched.append(result)
        finally:
            conn.close()
        
        return enriched
    
    def _apply_filters(
        self, results: List[Dict[str, Any]], filters: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Apply metadata filters to a result list."""
        if not filters:
            return results
        
        filtered = []
        for result in results:
            metadata = result.get("metadata", {})
            match = True
            
            for key, value in filters.items():
                if key == "tags" and isinstance(value, list):
                    result_tags = metadata.get("tags", [])
                    if not all(tag in result_tags for tag in value):
                        match = False
                        break
                elif key in metadata:
                    stored = metadata[key]
                    if isinstance(stored, str) and isinstance(value, str):
                        if stored.lower() != value.lower():
                            match = False
                            break
                    elif stored != value:
                        match = False
                        break
                else:
                    match = False
                    break
            
            if match:
                filtered.append(result)
        
        return filtered
    
    def add_chunks_to_bm25(self, chunks: List):
        """Add chunks to the BM25 index."""
        self.bm25_indexer.add_chunks(chunks)
    
    def remove_chunks_from_bm25(self, chunk_ids: set):
        """Remove chunks from the BM25 index."""
        self.bm25_indexer.remove_chunks_by_ids(chunk_ids)
