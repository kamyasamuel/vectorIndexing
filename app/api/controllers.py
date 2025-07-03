from typing import List, Dict, Any
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from app.storage.vector_store import VectorStore
from app.ai.ollama_client import OllamaClient

router = APIRouter()
vector_store = VectorStore()
ollama_client = OllamaClient()

class SearchQuery(BaseModel):
    query: str
    top_k: int = 5

class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    
class CompletionQuery(BaseModel):
    query: str
    context_window: int = 5

class CompletionResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]]

@router.post("/search", response_model=SearchResponse)
async def search(query: SearchQuery):
    """Search for documents similar to the query."""
    try:
        results = vector_store.similarity_search(query.query, query.top_k)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/answer", response_model=CompletionResponse)
async def answer_query(query: CompletionQuery):
    """Answer a query using retrieved context."""
    try:
        # Get relevant chunks
        results = vector_store.similarity_search(query.query, query.context_window)
        
        # Build context from chunks
        context = "\n\n".join([r["content"] for r in results])
        
        # Generate prompt with context
        prompt = f"""Answer the question based on the following context:

Context:
{context}

Question: {query.query}

Answer:"""
        
        # Get completion
        answer = ollama_client.get_completion(prompt)
        
        return {
            "answer": answer,
            "sources": results
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))