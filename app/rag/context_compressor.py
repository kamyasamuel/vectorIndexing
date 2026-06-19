"""
Context compression module for the advanced RAG pipeline.

Before sending retrieved chunks to the LLM for answer generation,
this module compresses the context by:
1. Removing near-duplicate chunks (high similarity, low information gain)
2. Truncating verbose chunks to their most relevant sentences
3. Reordering chunks for logical coherence
4. Limiting total token count to avoid exceeding LLM context windows

This reduces LLM costs and latency while often improving answer quality
by removing redundant or irrelevant information.
"""

from typing import List, Dict, Any, Optional, Tuple
import re
import numpy as np


class ContextCompressor:
    """Compresses and optimizes retrieved context before LLM generation.
    
    Removes redundancy, truncates verbose content, and ensures the
    context fits within token limits.
    """
    
    def __init__(
        self,
        max_tokens: int = 4000,
        similarity_threshold: float = 0.85,
        min_chunk_length: int = 50,
        enabled: bool = True,
    ):
        self.max_tokens = max_tokens
        self.similarity_threshold = similarity_threshold
        self.min_chunk_length = min_chunk_length
        self.enabled = enabled
    
    def compress(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Compress a list of retrieved chunks.
        
        Args:
            query: The original query (for relevance filtering).
            chunks: List of chunk dicts with at least "content" key.
            
        Returns:
            Compressed and deduplicated list of chunks.
        """
        if not self.enabled or not chunks:
            return chunks
        
        # Step 1: Remove chunks that are too short to be useful
        chunks = [c for c in chunks if len(c.get("content", "")) >= self.min_chunk_length]
        
        if not chunks:
            return []
        
        # Step 2: Sort by relevance score (highest first)
        chunks = sorted(
            chunks,
            key=lambda c: max(
                c.get("rerank_score", 0.0),
                c.get("similarity", 0.0),
                c.get("rrf_score", 0.0),
                c.get("score", 0.0),
            ),
            reverse=True,
        )
        
        # Step 3: Remove near-duplicate chunks
        unique_chunks = self._remove_near_duplicates(chunks)
        
        # Step 4: Truncate verbose chunks
        truncated = self._truncate_chunks(unique_chunks)
        
        # Step 5: Fit within token limit
        fitted = self._fit_to_token_limit(truncated)
        
        # Step 6: Reorder by relevance again after truncation
        fitted = sorted(
            fitted,
            key=lambda c: max(
                c.get("rerank_score", 0.0),
                c.get("similarity", 0.0),
                c.get("rrf_score", 0.0),
                c.get("score", 0.0),
            ),
            reverse=True,
        )
        
        return fitted
    
    def _remove_near_duplicates(
        self, chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Remove chunks that are very similar to each other.
        
        Uses simple word-overlap Jaccard similarity for speed.
        For chunks from the same document that overlap significantly,
        only the highest-scoring one is kept.
        """
        if len(chunks) <= 1:
            return chunks
        
        unique = [chunks[0]]
        
        for chunk in chunks[1:]:
            content = chunk.get("content", "").lower()
            is_duplicate = False
            
            for existing in unique:
                existing_content = existing.get("content", "").lower()
                
                # Tokenize
                words_a = set(content.split())
                words_b = set(existing_content.split())
                
                if not words_a or not words_b:
                    continue
                
                # Jaccard similarity
                intersection = words_a & words_b
                union = words_a | words_b
                jaccard = len(intersection) / len(union) if union else 0
                
                if jaccard > self.similarity_threshold:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                unique.append(chunk)
        
        return unique
    
    def _truncate_chunks(
        self, chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Truncate overly verbose chunks to their most relevant sentences.
        
        For chunks longer than ~500 words, keeps only the first 3 sentences
        (assuming the most relevant information is stated early).
        """
        truncated = []
        for chunk in chunks:
            content = chunk.get("content", "")
            word_count = len(content.split())
            
            if word_count > 500:
                # Keep first 3-5 sentences
                sentences = re.split(r'(?<=[.!?])\s+', content)
                kept = sentences[:min(5, max(3, len(sentences) // 2))]
                chunk["content"] = " ".join(kept)
                chunk["_truncated"] = True
                chunk["_original_word_count"] = word_count
            
            truncated.append(chunk)
        
        return truncated
    
    def _fit_to_token_limit(
        self, chunks: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Ensure total token count fits within the limit.
        
        Uses a rough token estimate (~4 chars per token).
        Removes lowest-scoring chunks if over the limit.
        """
        total_chars = sum(len(c.get("content", "")) for c in chunks)
        estimated_tokens = total_chars / 4
        
        if estimated_tokens <= self.max_tokens:
            return chunks
        
        # Remove lowest-scoring chunks until under limit
        fitted = []
        running_tokens = 0
        
        for chunk in chunks:
            chunk_tokens = len(chunk.get("content", "")) / 4
            if running_tokens + chunk_tokens <= self.max_tokens:
                fitted.append(chunk)
                running_tokens += chunk_tokens
        
        return fitted
    
    def extract_relevant_sentences(
        self, query: str, text: str, max_sentences: int = 5
    ) -> str:
        """Extract the most query-relevant sentences from a text block.
        
        Args:
            query: The query to match against.
            text: The full text to extract from.
            max_sentences: Maximum sentences to keep.
            
        Returns:
            Extracted relevant sentences as a single string.
        """
        sentences = re.split(r'(?<=[.!?])\s+', text)
        if len(sentences) <= max_sentences:
            return text
        
        # Score sentences by query word overlap
        query_words = set(query.lower().split())
        scored = []
        
        for i, sentence in enumerate(sentences):
            sentence_words = set(sentence.lower().split())
            overlap = len(query_words & sentence_words)
            scored.append((sentence, overlap, i))
        
        # Sort by overlap score, take top, reorder by position
        top = sorted(scored, key=lambda x: x[1], reverse=True)[:max_sentences]
        top = sorted(top, key=lambda x: x[2])  # Reorder by position
        
        return " ".join(s[0] for s in top if s[1] > 0) or text[:500]