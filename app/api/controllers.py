from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel

from app.core.searcher import DocumentSearcher
from app.core.indexer import DocumentIndexer
from app.ai.ollama_client import OllamaClient
import os
import tempfile

router = APIRouter()
searcher = DocumentSearcher()
indexer = DocumentIndexer()

class SearchQuery(BaseModel):
    query: str
    top_k: int = 5
    filters: Optional[Dict[str, Any]] = None

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
        if query.filters:
            results = searcher.filter_by_metadata(query.query, query.filters, query.top_k)
        else:
            results = searcher.similarity_search(query.query, query.top_k)
        
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/answer", response_model=CompletionResponse)
async def answer_query(query: CompletionQuery):
    """Answer a query using retrieved context."""
    try:
        # Get RAG response
        response = searcher.answer_question(query.query, query.context_window)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/index/file")
async def index_file(file: UploadFile = File(...)):
    """Index an uploaded file."""
    print("Received file for indexing:", file.filename)
    try:
        # Save uploaded file to temp directory
        with tempfile.NamedTemporaryFile(delete=False, suffix=file.filename) as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        
        # Index the file
        try:
            doc_id = indexer.index_file(tmp_path)
            
            # Clean up temp file
            os.unlink(tmp_path)
            print(doc_id)
            return {
                "status": "success",
                "document_id": doc_id,
                "message": f"Successfully indexed {file.filename}"
            }
        
        finally:
            # Ensure temp file is removed
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
                
    except Exception as e:
        print(f"Error indexing file {file.filename}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/index/url")
async def index_url(url: str = Form(...)):
    """Index content from a URL (placeholder)."""
    # This is a placeholder - in a real implementation you'd:
    # 1. Fetch the content from the URL
    # 2. Determine the content type
    # 3. Process accordingly
    # 4. Index the content
    
    return {
        "status": "error",
        "message": "URL indexing not yet implemented"
    }
