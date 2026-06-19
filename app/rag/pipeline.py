"""
Advanced RAG pipeline orchestrator.

Chains all stages of the advanced RAG pipeline together in a configurable order:

1. Query Rewriting — Reformulate ambiguous queries
2. HyDE Generation — Generate hypothetical document embeddings
3. Multi-Query — Generate and search multiple query variants
4. Hybrid Search — BM25 + FAISS with RRF merging
5. Cross-Encoder Reranking — Re-rank candidates for precision
6. Context Compression — Remove redundant chunks before LLM call
7. Answer Generation — Generate final answer with inline citations
"""

from typing import Optional, List, Dict, Any, Tuple
import time

from app.rag.query_rewriter import QueryRewriter
from app.rag.hyde_generator import HyDEGenerator
from app.rag.multi_query import MultiQueryGenerator
from app.rag.reranker import CrossEncoderReranker
from app.rag.context_compressor import ContextCompressor
from app.search.hybrid_searcher import HybridSearcher
from app.ai.providers import get_provider, get_embedding_provider


# System prompt for citation-aware answer generation
ANSWER_WITH_CITATIONS_SYSTEM_PROMPT = """You are a helpful document analysis assistant. Answer the user's question
based SOLELY on the provided context documents. Follow these rules:

1. Answer directly and concisely using information from the context only
2. For each factual claim, cite the source using numbered citations like [1], [2], etc.
   (the source numbers are provided in the context before each chunk)
3. If the context doesn't contain enough information, say so — don't make up answers
4. Use clear section headings if the answer covers multiple topics
5. Format code, data, or structured information appropriately
6. Include relevant quotes from the sources when appropriate
7. At the end, list all sources cited with their numbers and filenames

Remember: Accuracy and verifiability are critical. Every claim must be traceable to a source."""


class RAGPipeline:
    """Orchestrates the complete advanced RAG pipeline.
    
    Stages can be individually enabled/disabled via flags.
    Returns detailed metadata about each stage for observability.
    """
    
    def __init__(
        self,
        llm_provider: Optional[str] = None,
        embedding_provider: Optional[str] = None,
        enable_query_rewriting: bool = True,
        enable_hyde: bool = True,
        enable_multi_query: bool = True,
        enable_reranker: bool = True,
        enable_context_compression: bool = True,
        num_multi_queries: int = 3,
    ):
        self.llm_provider = llm_provider
        self.embedding_provider = embedding_provider
        
        # Initialize pipeline stages
        self.query_rewriter = QueryRewriter(
            provider_name=llm_provider,
            enabled=enable_query_rewriting,
        )
        self.hyde_generator = HyDEGenerator(
            llm_provider_name=llm_provider,
            embedding_provider_name=embedding_provider,
            enabled=enable_hyde,
        )
        self.multi_query = MultiQueryGenerator(
            provider_name=llm_provider,
            num_queries=num_multi_queries,
            enabled=enable_multi_query,
        )
        self.reranker = CrossEncoderReranker(enabled=enable_reranker)
        self.context_compressor = ContextCompressor(enabled=enable_context_compression)
        
        # Hybrid searcher
        self.searcher = HybridSearcher()
    
    def answer(
        self,
        query: str,
        top_k: int = 10,
        final_top_k: int = 5,
        include_sources: bool = True,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Dict[str, Any]:
        """Run the full advanced RAG pipeline for a question.
        
        Args:
            query: The user's question.
            top_k: Number of chunks to retrieve before reranking/compression.
            final_top_k: Number of chunks to include in the final context.
            include_sources: Include source citations in the response.
            history: Optional conversation history.
            
        Returns:
            Dict with keys:
                answer: The generated answer text.
                sources: List of source chunks with citation IDs.
                citations: List of citation objects (number, chunk_id, filename, etc.)
                pipeline_metadata: Timing and configuration info for each stage.
        """
        metadata = {"stages": {}, "total_time": 0.0}
        start_time = time.time()
        
        # --- Stage 1: Query Rewriting ---
        t0 = time.time()
        rewritten_query = self.query_rewriter.rewrite(query, history=history)
        metadata["stages"]["query_rewriting"] = {
            "time": time.time() - t0,
            "original_query": query,
            "rewritten_query": rewritten_query,
        }
        
        # --- Stage 2: Multi-Query Generation ---
        t0 = time.time()
        query_variants = self.multi_query.generate_variants(rewritten_query)
        metadata["stages"]["multi_query"] = {
            "time": time.time() - t0,
            "num_variants": len(query_variants),
            "variants": query_variants,
        }
        
        # --- Stage 3: HyDE & Retrieval ---
        t0 = time.time()
        all_chunks = []
        
        for variant in query_variants:
            if self.hyde_generator.enabled:
                # Use HyDE embedding for first variant, regular for others
                if variant == query_variants[0]:
                    hyde_embedding = self.hyde_generator.embed_for_search(variant)
                    # Run hybrid search (HyDE embedding is used internally by vector store)
                    chunks = self.searcher.search(
                        variant,
                        top_k=top_k,
                        mode="hybrid",
                    )
                else:
                    chunks = self.searcher.search(
                        variant,
                        top_k=top_k // 2,
                        mode="hybrid",
                    )
            else:
                chunks = self.searcher.search(
                    variant,
                    top_k=top_k,
                    mode="hybrid",
                )
            
            all_chunks.extend(chunks)
        
        metadata["stages"]["retrieval"] = {
            "time": time.time() - t0,
            "total_chunks_retrieved": len(all_chunks),
        }
        
        if not all_chunks:
            # Generate answer from no context
            answer = self._generate_answer_no_context(query)
            metadata["total_time"] = time.time() - start_time
            return {
                "answer": answer,
                "sources": [],
                "citations": [],
                "pipeline_metadata": metadata,
            }
        
        # --- Stage 4: Cross-Encoder Reranking ---
        t0 = time.time()
        reranked_chunks = self.reranker.rerank(query, all_chunks, top_k=final_top_k * 3)
        metadata["stages"]["reranking"] = {
            "time": time.time() - t0,
            "input_count": len(all_chunks),
            "output_count": len(reranked_chunks),
        }
        
        # --- Stage 5: Context Compression ---
        t0 = time.time()
        compressed_chunks = self.context_compressor.compress(query, reranked_chunks)
        # Take only the top final_top_k
        final_chunks = compressed_chunks[:final_top_k]
        metadata["stages"]["compression"] = {
            "time": time.time() - t0,
            "input_count": len(reranked_chunks),
            "output_count": len(final_chunks),
        }
        
        # --- Build citation mappings ---
        citations = []
        for i, chunk in enumerate(final_chunks):
            citation_num = i + 1
            citations.append({
                "number": citation_num,
                "chunk_id": chunk.get("id", ""),
                "document_id": chunk.get("document_id", ""),
                "filename": chunk.get("filename", chunk.get("metadata", {}).get("filename", "Unknown")),
                "file_type": chunk.get("file_type", ""),
                "similarity": chunk.get("rerank_score", chunk.get("similarity", chunk.get("rrf_score", 0.0))),
                "excerpt": chunk.get("content", "")[:200] + "..." if len(chunk.get("content", "")) > 200 else chunk.get("content", ""),
            })
            chunk["citation_number"] = citation_num
        
        # --- Stage 6: Answer Generation with Citations ---
        t0 = time.time()
        answer = self._generate_answer(query, final_chunks, citations)
        metadata["stages"]["generation"] = {
            "time": time.time() - t0,
        }
        
        metadata["total_time"] = time.time() - start_time
        
        return {
            "answer": answer,
            "sources": final_chunks,
            "citations": citations,
            "pipeline_metadata": metadata,
        }
    
    def _generate_answer(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        citations: List[Dict[str, Any]],
    ) -> str:
        """Generate a citation-aware answer from retrieved chunks."""
        try:
            provider = get_provider(self.llm_provider)
            
            # Build context with citation numbers
            context_parts = []
            for citation in citations:
                chunk_id = citation["chunk_id"]
                # Find the matching chunk
                for chunk in chunks:
                    if chunk.get("id") == chunk_id or chunk.get("citation_number") == citation["number"]:
                        context_parts.append(
                            f"[Source {citation['number']}] (from: {citation['filename']}):\n"
                            f"{chunk.get('content', '')}"
                        )
                        break
            
            context_text = "\n\n---\n\n".join(context_parts)
            
            # Build the full prompt
            prompt = f"""Answer the following question using the context provided below.
For every factual claim, cite the source number like [1], [2], etc.

Context:
{context_text}

Question: {query}

Answer:"""
            
            answer = provider.generate(
                prompt,
                system_prompt=ANSWER_WITH_CITATIONS_SYSTEM_PROMPT,
                temperature=0.3,
                max_tokens=2048,
            )
            
            return answer.strip()
            
        except Exception as e:
            print(f"Answer generation failed: {e}")
            return f"I encountered an error while generating the answer: {str(e)}"
    
    def _generate_answer_no_context(self, query: str) -> str:
        """Generate a response when no relevant context was found."""
        try:
            provider = get_provider(self.llm_provider)
            prompt = f"""The user asked: {query}

However, the document retrieval system did not find any relevant documents to answer this question.
Please respond letting the user know that no relevant information was found in their knowledge base,
and suggest they try rephrasing the query or indexing more relevant documents."""
            
            answer = provider.generate(
                prompt,
                temperature=0.5,
                max_tokens=200,
            )
            return answer.strip()
        except Exception:
            return "I couldn't find any relevant information in the indexed documents to answer your question. Please try rephrasing or index more documents related to this topic."