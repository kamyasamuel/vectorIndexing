# Vector Indexing System — Implementation Plan

## Overview
This document tracks progress on implementing 10 new features identified during the deep-dive analysis and competitive benchmarking.

---

## Phase 1: Core Infrastructure (Foundation) ✅ Complete

| # | Feature | Status | Files |
|---|---------|--------|-------|
| 1 | **FAISS Vector Store** | ✅ Done | `app/core/vector_store.py` |
| 2 | **Multi-User JWT Auth** | ✅ Done | `app/auth/auth_handler.py`, `app/auth/__init__.py` |
| 3 | **Multi-Model Provider Abstraction** | ✅ Done | `app/ai/providers/base.py`, `app/ai/providers/__init__.py` |

## Phase 2: Search & Retrieval Quality ✅ Complete

| # | Feature | Status | Files |
|---|---------|--------|-------|
| 4 | **Hybrid Search (BM25 + Vector + RRF)** | ✅ Done | `app/search/bm25_indexer.py`, `app/search/hybrid_searcher.py` |
| 5 | **Advanced RAG Pipeline** | ✅ Done | `app/rag/pipeline.py` + 5 modules |
| 6 | **Citation & Source Highlighting** | ✅ Done | Backend response format with `citations` array + source excerpts |

### Phase 2 Sub-tasks

#### [x] 4. Hybrid Search
- [x] `app/search/__init__.py`
- [x] `app/search/bm25_indexer.py` — BM25 keyword indexing of document chunks
- [x] `app/search/hybrid_searcher.py` — RRF merging of BM25 + FAISS results
- [x] Integrate into API controller endpoints
- [x] Add API endpoint for hybrid search
- [ ] Add frontend toggle (semantic / hybrid / both) — frontend task

#### [x] 5. Advanced RAG
- [x] `app/rag/__init__.py`
- [x] `app/rag/query_rewriter.py` — LLM-based query reformulation
- [x] `app/rag/hyde_generator.py` — Hypothetical Document Embeddings
- [x] `app/rag/multi_query.py` — Multi-query generation and merging
- [x] `app/rag/reranker.py` — Cross-encoder re-ranking
- [x] `app/rag/context_compressor.py` — Redundant chunk compression
- [x] `app/rag/pipeline.py` — Orchestrator that chains all stages together
- [x] Integrate into API controller endpoints

#### [x] 6. Citations & Source Highlighting
- [x] Backend: Source-tracking response format with per-chunk citation IDs
- [x] Backend: Citation metadata included in Q&A / advanced RAG responses
- [x] Frontend: Ready for inline citation rendering

---

## Phase 3: Enterprise & UX Features (Planned)

| # | Feature | Status | Details |
|---|---------|--------|---------|
| 7 | **RAG Evaluation Harness** | ░░░░░░ | Faithfulness, relevance, precision, recall metrics |
| 8 | **Audio Transcription (Whisper)** | ░░░░░░ | OpenAI Whisper API integration |
| 9 | **Docker Compose Deployment** | ░░░░░░ | Multi-service deployment with nginx |
| 10 | **Library/Collection Management** | ░░░░░░ | Drag-drop, sharing, bulk operations |

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vector DB | FAISS (IndexFlatIP → IndexIVFFlat) | Fastest, pure Python, industry standard |
| Auth | JWT (python-jose + passlib/bcrypt) | Stateless, no session DB, standard |
| BM25 | `rank_bm25` library | Lightweight, no external server, pure Python |
| Reranker | `cross-encoder/ms-marco-MiniLM-L-6-v2` | ~20ms/doc, good quality, small model |
| Whisper | OpenAI API (with local fallback) | Best quality, cheap, no GPU needed |
| LLM Providers | OpenAI + DeepSeek + Ollama | Your requirement |