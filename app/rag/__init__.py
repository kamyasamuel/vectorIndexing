"""
Advanced RAG (Retrieval-Augmented Generation) pipeline.

Provides multi-stage retrieval enhancement:
1. Query Rewriting — Reformulate ambiguous queries for better retrieval
2. HyDE — Hypothetical Document Embeddings for abstract queries
3. Multi-Query — Generate multiple query variations, search each, merge
4. Cross-Encoder Reranking — Re-rank candidates for precision
5. Context Compression — Remove redundant chunks before LLM call
"""

from app.rag.query_rewriter import QueryRewriter
from app.rag.hyde_generator import HyDEGenerator
from app.rag.multi_query import MultiQueryGenerator
from app.rag.reranker import CrossEncoderReranker
from app.rag.context_compressor import ContextCompressor