from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.searcher import DocumentSearcher
from app.core.indexer import DocumentIndexer
from app.ai.ollama_client import OllamaClient
from app.ai.agentic_qa import AgenticQATuner
import os
import shutil
import uuid
import json
import time
import psutil
from datetime import datetime

from config import UPLOAD_DIR

router = APIRouter()
searcher = DocumentSearcher()
indexer = DocumentIndexer()
agentic_qa = AgenticQATuner()

# Track server start time for uptime calculation
_server_start_time = time.time()

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

class AgenticQuery(BaseModel):
    query: str
    max_iterations: int = 3
    history: List[Dict[str, str]] = []

class AgenticResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]]
    iterations: List[Dict[str, Any]]
    confidence: float
    total_iterations: int
    compressed_history: Optional[List[Dict[str, str]]] = None

class Category(BaseModel):
    name: str
    path: str

class UpdateCategoryRequest(BaseModel):
    old_path: str
    new_path: str

class AddDocumentToCategoryRequest(BaseModel):
    document_id: str
    category_path: str


def _enrich_search_result(result: Dict[str, Any]) -> Dict[str, Any]:
    """Add download_url and formatted fields to a search result."""
    doc_id = result.get("document_id", "")
    metadata = result.get("metadata", {})
    source = metadata.get("source", result.get("source", ""))
    
    result["download_url"] = f"/api/documents/{doc_id}/download" if doc_id else None
    result["filename"] = os.path.basename(source) if source else "Unknown"
    result["file_type"] = metadata.get("file_type", "")
    
    # Format file size
    file_size = metadata.get("file_size", 0)
    try:
        file_size = int(file_size)
    except (TypeError, ValueError):
        file_size = 0
    result["file_size"] = file_size
    
    # Add other useful metadata at the top level
    for key in ("page_count", "extraction_method", "chunk_index"):
        if key in metadata:
            result[key] = metadata[key]
    
    return result


def _prune_stale_documents():
    """Remove documents whose source file no longer exists on disk."""
    try:
        documents = indexer.metadata_store.list_documents(10000, 0)
        pruned = 0
        for doc in documents:
            source = doc.get("source", "")
            if source and source.startswith("/tmp/") and not os.path.exists(source):
                # Stale temp document — remove from both stores
                try:
                    indexer.metadata_store.delete_document(doc["id"])
                except Exception:
                    pass
                try:
                    indexer.vector_store.delete_document(doc["id"])
                except Exception:
                    pass
                pruned += 1
        if pruned:
            print(f"Pruned {pruned} stale document(s) with missing source files")
    except Exception as e:
        print(f"Error pruning stale documents: {e}")


# Prune stale temp docs on module load
_prune_stale_documents()


def _get_uptime() -> str:
    """Calculate server uptime from start time."""
    elapsed = time.time() - _server_start_time
    days = int(elapsed // 86400)
    hours = int((elapsed % 86400) // 3600)
    minutes = int((elapsed % 3600) // 60)
    
    parts = []
    if days > 0:
        parts.append(f"{days} day{'s' if days != 1 else ''}")
    if hours > 0:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if minutes > 0 or not parts:
        parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
    
    return ", ".join(parts)


def _get_data_directory_size() -> int:
    """Calculate the total size of the data directory in bytes."""
    from config import VECTOR_DB_PATH
    base_path = os.path.dirname(VECTOR_DB_PATH)
    total = 0
    if os.path.exists(base_path):
        for dirpath, dirnames, filenames in os.walk(base_path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                try:
                    total += os.path.getsize(fp)
                except OSError:
                    pass
    return total


def _format_size(size_bytes: int) -> str:
    """Convert bytes to human-readable size."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes // 1024} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.2f} GB"


def _get_last_indexed_date() -> str:
    """Get the most recent document's indexed date."""
    try:
        documents = indexer.metadata_store.list_documents(1, 0)
        if documents:
            doc = documents[0]
            created_at = doc.get("created_at")
            if created_at:
                if isinstance(created_at, str):
                    try:
                        date_obj = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        return date_obj.strftime("%Y-%m-%d %H:%M:%S")
                    except:
                        return created_at
                return str(created_at)
        return "Never"
    except Exception:
        return "Never"


@router.get("/status")
async def get_system_status():
    """Get real-time system status data."""
    try:
        # Count documents from metadata store
        documents = indexer.metadata_store.list_documents(10000, 0)
        total_documents = len(documents)
        
        # Count vectors (chunks) from vector store
        vector_count = indexer.vector_store.get_chunk_count()
        
        # Calculate index size
        index_size_bytes = _get_data_directory_size()
        index_size = _format_size(index_size_bytes)
        
        # Get last indexed date
        last_indexed = _get_last_indexed_date()
        
        # Get system resource usage
        cpu_usage = psutil.cpu_percent(interval=0.1)
        memory_usage = psutil.virtual_memory().percent
        
        # Get uptime
        uptime = _get_uptime()
        
        return {
            "totalDocuments": total_documents,
            "vectorCount": vector_count,
            "indexSize": index_size,
            "lastIndexed": last_indexed,
            "cpuUsage": cpu_usage,
            "memoryUsage": memory_usage,
            "uptime": uptime
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search", response_model=SearchResponse)
async def search(query: SearchQuery):
    """Search for documents similar to the query."""
    try:
        if query.filters:
            results = searcher.filter_by_metadata(query.query, query.filters, query.top_k)
        else:
            results = searcher.similarity_search(query.query, query.top_k)
        
        # Enrich results with download URLs and formatted fields
        enriched = [_enrich_search_result(r) for r in results]
        
        return {"results": enriched}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/answer", response_model=CompletionResponse)
async def answer_query(query: CompletionQuery):
    """Answer a query using retrieved context (single-shot)."""
    try:
        response = searcher.answer_question(query.query, query.context_window)
        return response
    except Exception as e:
        print(f"Error answering query: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/agentic-answer", response_model=AgenticResponse)
async def agentic_answer_query(query: AgenticQuery):
    """Answer a query using the agentic multi-turn Q&A engine.
    
    The engine iteratively retrieves context, critiques it for sufficiency,
    refines the search query when information is missing, and synthesizes
    a comprehensive answer across multiple rounds.
    """
    try:
        response = searcher.agentic_answer_question(
            query.query,
            max_iterations=query.max_iterations,
            history=query.history,
        )
        return response
    except Exception as e:
        print(f"Error in agentic answer: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/index/file")
async def index_file(file: UploadFile = File(...)):
    """Index an uploaded file, persisted to the uploads directory."""
    print("Received file for indexing:", file.filename)
    
    # Create a unique directory under uploads
    doc_uuid = str(uuid.uuid4())
    dest_dir = os.path.join(UPLOAD_DIR, doc_uuid)
    os.makedirs(dest_dir, exist_ok=True)
    
    # Preserve the original filename
    original_filename = file.filename or "unnamed_file"
    dest_path = os.path.join(dest_dir, original_filename)
    
    try:
        # Save uploaded file to persistent storage
        content = await file.read()
        with open(dest_path, "wb") as f:
            f.write(content)
        
        # Index the file from its persistent location
        doc_id = indexer.index_file(dest_path)
        
        # Update metadata to reflect the persistent path and add download info
        doc_meta = indexer.metadata_store.get_document(doc_id)
        if doc_meta:
            metadata = doc_meta.get("metadata", {})
            metadata["source"] = dest_path
            metadata["filename"] = original_filename
            metadata["file_size"] = os.path.getsize(dest_path)
            indexer.metadata_store.add_document(doc_id, "", metadata)
        
        # Update vector store metadata
        indexer.vector_store.update_document_metadata(
            doc_id,
            {"source": dest_path, "filename": original_filename}
        )
        
        return {
            "status": "success",
            "document_id": doc_id,
            "filename": original_filename,
            "message": f"Successfully indexed {original_filename}"
        }
        
    except Exception as e:
        print(f"Error indexing file {file.filename}: {str(e)}")
        # Clean up the uploaded file on failure
        if os.path.exists(dest_path):
            os.remove(dest_path)
        if os.path.exists(dest_dir) and not os.listdir(dest_dir):
            os.rmdir(dest_dir)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/documents/{document_id}/download")
async def download_document(document_id: str):
    """Download the original file for an indexed document."""
    try:
        doc = indexer.metadata_store.get_document(document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        source = doc.get("source", "")
        if not source or not os.path.exists(source):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        filename = doc.get("title") or os.path.basename(source) or "download"
        
        return FileResponse(
            path=source,
            filename=filename,
            media_type="application/octet-stream"
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/index/url")
async def index_url(url: str = Form(...)):
    """Index content from a URL (placeholder)."""
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
            else:
                doc["filename"] = doc.get("filename", doc.get("id", "Unknown"))
            
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
                else:
                    doc["file_type"] = "unknown"
            
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
                
            # Add download URL
            doc["download_url"] = f"/api/documents/{doc['id']}/download"
                
            # Convert created_at to ISO format if it exists
            if "created_at" in doc and doc["created_at"]:
                try:
                    from datetime import datetime
                    if isinstance(doc["created_at"], str):
                        try:
                            date_obj = datetime.fromisoformat(doc["created_at"].replace('Z', '+00:00'))
                            doc["date_indexed"] = date_obj.strftime("%Y-%m-%d %H:%M:%S")
                        except:
                            doc["date_indexed"] = doc["created_at"]
                    else:
                        doc["date_indexed"] = doc["created_at"]
                except:
                    doc["date_indexed"] = "Unknown"
            else:
                doc["date_indexed"] = "Unknown"
            
            # Ensure file_size_formatted always has a value
            doc.setdefault("file_size_formatted", "Unknown")
            
        return documents
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/categories")
async def list_categories():
    """List all document categories."""
    try:
        documents = indexer.metadata_store.list_documents(1000, 0)
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
        os.makedirs(category.path, exist_ok=True)
        return {"status": "success", "message": f"Category '{category.name}' created successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/categories")
async def update_category(update_request: UpdateCategoryRequest):
    """Update a category path."""
    try:
        if not os.path.exists(update_request.old_path):
            raise HTTPException(status_code=404, detail=f"Category path '{update_request.old_path}' not found")
        
        os.makedirs(os.path.dirname(update_request.new_path), exist_ok=True)
        shutil.move(update_request.old_path, update_request.new_path)
        
        documents = indexer.metadata_store.list_documents(1000, 0)
        for doc in documents:
            source = doc.get("source", "")
            if source and source.startswith(update_request.old_path):
                new_source = source.replace(update_request.old_path, update_request.new_path, 1)
                doc_meta = indexer.metadata_store.get_document(doc["id"])
                if doc_meta:
                    metadata = doc_meta.get("metadata", {})
                    metadata["source"] = new_source
                    metadata["filename"] = os.path.basename(new_source)
                    indexer.metadata_store.add_document(
                        doc["id"],
                        "",
                        metadata
                    )
                indexer.vector_store.update_document_metadata(doc["id"], {"source": new_source})
                
        return {"status": "success", "message": f"Category updated successfully"}
    except PermissionError:
        raise HTTPException(status_code=500, detail="Permission denied. Cannot rename category.")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to rename category: {str(e)}")
    except Exception as e:
        print(f"Error renaming category: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/documents/category")
async def add_document_to_category(request: AddDocumentToCategoryRequest):
    """Move a document to a different category."""
    try:
        doc = indexer.metadata_store.get_document(request.document_id)
        if not doc:
            raise HTTPException(status_code=404, detail=f"Document '{request.document_id}' not found")
        
        if not os.path.exists(request.category_path):
            os.makedirs(request.category_path, exist_ok=True)
        
        old_path = doc.get("source", "")
        if not old_path:
            raise HTTPException(status_code=400, detail="Document has no source file path")
        
        new_path = os.path.join(request.category_path, os.path.basename(old_path))
        
        if os.path.exists(old_path):
            shutil.move(old_path, new_path)
            
            indexer.metadata_store.add_document(
                request.document_id,
                "",
                {"source": new_path, "filename": os.path.basename(new_path)}
            )
            
            indexer.vector_store.update_document_metadata(
                request.document_id,
                {"source": new_path}
            )
            
        return {"status": "success", "message": f"Document moved to category successfully"}
    except Exception as e:
        print(f"Error moving document: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))