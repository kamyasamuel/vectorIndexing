from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from pydantic import BaseModel

from app.core.searcher import DocumentSearcher
from app.core.indexer import DocumentIndexer
from app.ai.ollama_client import OllamaClient
import os
import tempfile
import json

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

class Category(BaseModel):
    name: str
    path: str

class UpdateCategoryRequest(BaseModel):
    old_path: str
    new_path: str

class AddDocumentToCategoryRequest(BaseModel):
    document_id: str
    category_path: str

@router.post("/search", response_model=SearchResponse)
async def search(query: SearchQuery):
    """Search for documents similar to the query."""
    #print(f"Received search query: {query.query} with top_k={query.top_k} and filters={query.filters}")
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
    #print(f"Received completion query: {query.query} with context_window={query.context_window}")
    """Answer a query using retrieved context."""
    try:
        # Get RAG response
        response = searcher.answer_question(query.query, query.context_window)
        return response
    except Exception as e:
        print(f"Error answering query: {str(e)}")
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

@router.get("/documents", response_model=List[Dict[str, Any]])
async def list_documents(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    """List all indexed documents."""
    try:
        documents = indexer.metadata_store.list_documents(limit, offset)
        
        # Enhance document information
        for doc in documents:
            # Try to extract filename from source or path
            if "source" in doc and doc["source"]:
                doc["filename"] = os.path.basename(doc["source"])
            
            # Get file size if available
            if "source" in doc and os.path.exists(doc["source"]):
                try:
                    doc["file_size"] = os.path.getsize(doc["source"])
                    # Convert to human-readable format
                    if doc["file_size"] < 1024:
                        doc["file_size_formatted"] = f"{doc['file_size']} B"
                    elif doc["file_size"] < 1024 * 1024:
                        doc["file_size_formatted"] = f"{doc['file_size'] // 1024} KB"
                    else:
                        doc["file_size_formatted"] = f"{doc['file_size'] // (1024 * 1024):.1f} MB"
                except:
                    doc["file_size"] = 0
                    doc["file_size_formatted"] = "Unknown"
            
            # Get file type from metadata or extension
            if "file_type" not in doc or not doc["file_type"]:
                if "source" in doc and doc["source"] and "." in doc["source"]:
                    doc["file_type"] = doc["source"].split(".")[-1].lower()
            
            # Extract category/path info
            if "source" in doc and doc["source"]:
                path = os.path.dirname(doc["source"])
                if path:
                    doc["path"] = path
                    doc["category"] = os.path.basename(path)
                else:
                    doc["path"] = "/"
                    doc["category"] = "Uncategorized"
            else:
                doc["path"] = "/"
                doc["category"] = "Uncategorized"
                
            # Convert created_at to ISO format if it exists
            if "created_at" in doc and doc["created_at"]:
                # Handle different date formats
                try:
                    from datetime import datetime
                    if isinstance(doc["created_at"], str):
                        # Try to parse the date
                        try:
                            date_obj = datetime.fromisoformat(doc["created_at"].replace('Z', '+00:00'))
                            doc["date_indexed"] = date_obj.strftime("%Y-%m-%d %H:%M:%S")
                        except:
                            doc["date_indexed"] = doc["created_at"]
                    else:
                        doc["date_indexed"] = doc["created_at"]
                except:
                    doc["date_indexed"] = "Unknown"
            
        return documents
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/categories")
async def list_categories():
    """List all document categories."""
    try:
        # Get all documents
        documents = indexer.metadata_store.list_documents(1000, 0)
        
        # Extract unique categories
        categories = {}
        for doc in documents:
            path = "/"
            if "source" in doc and doc["source"]:
                path = os.path.dirname(doc["source"])
                
            if path not in categories:
                categories[path] = {
                    "path": path,
                    "name": os.path.basename(path) if path and path != "/" else "Uncategorized",
                    "count": 0
                }
            categories[path]["count"] += 1
            
        return list(categories.values())
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/categories")
async def create_category(category: Category):
    """Create a new category."""
    try:
        # Create directory if it doesn't exist
        os.makedirs(category.path, exist_ok=True)
        return {"status": "success", "message": f"Category '{category.name}' created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/categories")
async def update_category(update_request: UpdateCategoryRequest):
    """Update a category path."""
    try:
        # Check if old path exists
        if not os.path.exists(update_request.old_path):
            raise HTTPException(status_code=404, detail=f"Category path '{update_request.old_path}' not found")
        
        # Create new directory
        os.makedirs(os.path.dirname(update_request.new_path), exist_ok=True)
        
        # Rename directory
        os.rename(update_request.old_path, update_request.new_path)
        
        # Update all documents with this path
        documents = indexer.metadata_store.list_documents(1000, 0)
        for doc in documents:
            if "source" in doc and doc["source"] and doc["source"].startswith(update_request.old_path):
                new_source = doc["source"].replace(update_request.old_path, update_request.new_path)
                # Update document metadata
                # This would need to be implemented in the metadata store
                
        return {"status": "success", "message": f"Category updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/documents/category")
async def add_document_to_category(request: AddDocumentToCategoryRequest):
    """Move a document to a different category."""
    try:
        # Get document
        doc = indexer.metadata_store.get_document(request.document_id)
        if not doc:
            raise HTTPException(status_code=404, detail=f"Document '{request.document_id}' not found")
        
        # Check if category exists
        if not os.path.exists(request.category_path):
            os.makedirs(request.category_path, exist_ok=True)
        
        # Move file
        old_path = doc["source"]
        new_path = os.path.join(request.category_path, os.path.basename(old_path))
        
        if os.path.exists(old_path):
            # Physically move the file
            os.rename(old_path, new_path)
            
            # Update document metadata
            # This would need to be implemented in the metadata store
            
        return {"status": "success", "message": f"Document moved to category successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
