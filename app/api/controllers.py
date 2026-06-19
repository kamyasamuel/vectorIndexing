from typing import List, Dict, Any, Optional
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.core.searcher import DocumentSearcher
from app.core.indexer import DocumentIndexer
from app.search.hybrid_searcher import HybridSearcher
from app.ai.ollama_client import OllamaClient
from app.ai.agentic_qa import AgenticQATuner
from app.evaluation import RAGEvaluator
from app.collections import CollectionManager
from app.auth.auth_handler import AuthHandler, get_optional_user
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
rag_evaluator = RAGEvaluator()
collection_manager = CollectionManager()
auth_handler = AuthHandler()

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


# Hybrid searcher instance
hybrid_searcher = HybridSearcher()

class HybridSearchQuery(BaseModel):
    query: str
    top_k: int = 5
    mode: str = "hybrid"  # "hybrid", "semantic", "keyword"
    filters: Optional[Dict[str, Any]] = None


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


@router.post("/hybrid-search", response_model=SearchResponse)
async def hybrid_search(query: HybridSearchQuery):
    """Search using hybrid (BM25 + vector), semantic-only, or keyword-only mode.
    
    Args:
        query: The search text.
        top_k: Number of results.
        mode: "hybrid" (default), "semantic" (FAISS only), "keyword" (BM25 only).
        filters: Optional metadata filters.
    """
    try:
        results = hybrid_searcher.search(
            query=query.query,
            top_k=query.top_k,
            mode=query.mode,
            filters=query.filters,
        )
        
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
async def download_document(document_id: str, inline: bool = Query(False)):
    """Download the original file for an indexed document.
    
    Query params:
      - inline: If true, serves with Content-Disposition: inline for browser preview.
                If false, serves as downloadable attachment.
    """
    try:
        doc = indexer.metadata_store.get_document(document_id)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        
        source = doc.get("source", "")
        if not source or not os.path.exists(source):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        filename = doc.get("title") or os.path.basename(source) or "download"
        
        # Use proper MIME type based on file extension
        from app.api.controllers_view import _get_mime_type
        media_type = _get_mime_type(source)
        
        headers = {}
        if inline:
            # Content-Disposition: inline tells the browser to display the file
            headers["Content-Disposition"] = f'inline; filename="{filename}"'
        else:
            # Let FastAPI's FileResponse handle attachment disposition via filename parameter
            pass
        
        return FileResponse(
            path=source,
            filename=None if inline else filename,
            media_type=media_type,
            headers=headers if headers else None,
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


# ═══════════════════════════════════════════════════════════════════
# RAG Evaluation Endpoints
# ═══════════════════════════════════════════════════════════════════

class EvaluationRequest(BaseModel):
    query: str
    answer: str
    contexts: List[Dict[str, Any]]
    relevant_chunk_ids: Optional[List[str]] = None


@router.post("/evaluate", response_model=Dict[str, Any])
async def evaluate_rag(request: EvaluationRequest):
    """Evaluate a RAG pipeline output on faithfulness, relevance, precision, and recall.
    
    Args:
        query: The original user query.
        answer: The generated answer.
        contexts: List of context chunks used (each with 'content' key).
        relevant_chunk_ids: Optional ground truth relevant chunk IDs for exact recall.
        
    Returns:
        Dict with overall_score, per-metric breakdowns, and timing info.
    """
    try:
        result = rag_evaluator.evaluate(
            query=request.query,
            answer=request.answer,
            contexts=request.contexts,
            relevant_chunk_ids=request.relevant_chunk_ids,
        )
        return result
    except Exception as e:
        print(f"Evaluation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class BatchEvalRequest(BaseModel):
    examples: List[Dict[str, Any]]


@router.post("/evaluate/batch", response_model=Dict[str, Any])
async def evaluate_batch(request: BatchEvalRequest):
    """Evaluate multiple RAG examples and return per-example + summary statistics."""
    try:
        results = rag_evaluator.evaluate_batch(request.examples)
        summary = rag_evaluator.summarize_batch(results)
        return {
            "results": results,
            "summary": summary,
            "count": len(results),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════
# Collection Management Endpoints
# ═══════════════════════════════════════════════════════════════════

class CreateCollectionRequest(BaseModel):
    name: str
    description: str = ""


class UpdateCollectionRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class AddToCollectionRequest(BaseModel):
    collection_id: str
    document_ids: List[str]


class ReorderCollectionRequest(BaseModel):
    collection_id: str
    document_ids: List[str]


class ShareCollectionRequest(BaseModel):
    collection_id: str
    shared_with_user_id: str
    permission: str = "read"


class RevokeShareRequest(BaseModel):
    collection_id: str
    shared_with_user_id: str


@router.post("/collections", response_model=Dict[str, Any])
async def create_collection(
    request: CreateCollectionRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """Create a new document collection.
    
    Requires authentication. Uses user_id from JWT token.
    """
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        collection = collection_manager.create_collection(
            name=request.name,
            owner_id=current_user["id"],
            description=request.description,
        )
        return {"status": "success", "collection": collection.to_dict()}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collections", response_model=List[Dict[str, Any]])
async def list_collections(
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """List all collections accessible to the current user."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        collections = collection_manager.list_collections(user_id=current_user["id"])
        return [c.to_dict() for c in collections]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collections/{collection_id}", response_model=Dict[str, Any])
async def get_collection(
    collection_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """Get a collection by ID."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        collection = collection_manager.get_collection(collection_id, current_user["id"])
        if not collection:
            raise HTTPException(status_code=404, detail="Collection not found")
        return collection.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/collections/{collection_id}")
async def update_collection(
    collection_id: str,
    request: UpdateCollectionRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """Update a collection's name and/or description."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        collection = collection_manager.update_collection(
            collection_id=collection_id,
            user_id=current_user["id"],
            name=request.name,
            description=request.description,
        )
        return {"status": "success", "collection": collection.to_dict()}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/collections/{collection_id}")
async def delete_collection(
    collection_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """Delete a collection (owner only)."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        collection_manager.delete_collection(collection_id, current_user["id"])
        return {"status": "success", "message": "Collection deleted"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collections/documents/add")
async def add_to_collection(
    request: AddToCollectionRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """Add documents to a collection."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        collection = collection_manager.add_documents(
            collection_id=request.collection_id,
            user_id=current_user["id"],
            document_ids=request.document_ids,
        )
        return {"status": "success", "collection": collection.to_dict()}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collections/documents/remove")
async def remove_from_collection(
    request: AddToCollectionRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """Remove documents from a collection."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        collection = collection_manager.remove_documents(
            collection_id=request.collection_id,
            user_id=current_user["id"],
            document_ids=request.document_ids,
        )
        return {"status": "success", "collection": collection.to_dict()}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/collections/documents/reorder")
async def reorder_collection(
    request: ReorderCollectionRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """Reorder documents in a collection (drag-drop support)."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        collection = collection_manager.reorder_documents(
            collection_id=request.collection_id,
            user_id=current_user["id"],
            document_ids=request.document_ids,
        )
        return {"status": "success", "collection": collection.to_dict()}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collections/share")
async def share_collection(
    request: ShareCollectionRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """Share a collection with another user."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        share = collection_manager.share_collection(
            collection_id=request.collection_id,
            owner_id=current_user["id"],
            shared_with_user_id=request.shared_with_user_id,
            permission=request.permission,
        )
        return {"status": "success", "share": share.to_dict()}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/collections/revoke")
async def revoke_share(
    request: RevokeShareRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """Revoke a share grant on a collection."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        collection_manager.revoke_share(
            collection_id=request.collection_id,
            owner_id=current_user["id"],
            shared_with_user_id=request.shared_with_user_id,
        )
        return {"status": "success", "message": "Share revoked"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/collections/{collection_id}/shares")
async def get_collection_shares(
    collection_id: str,
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """Get all shares for a collection (owner only)."""
    try:
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        shares = collection_manager.get_shares(collection_id, current_user["id"])
        return {"shares": [s.to_dict() for s in shares]}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════════
# Audio Transcription Endpoint
# ═══════════════════════════════════════════════════════════════════

@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """Transcribe an audio file using Whisper and return the text.
    
    The transcribed text can then be used for indexing or other purposes.
    Supports mp3, wav, ogg, flac, m4a, and other common formats.
    """
    try:
        # Save uploaded file temporarily
        doc_uuid = str(uuid.uuid4())
        dest_dir = os.path.join(UPLOAD_DIR, "transcriptions", doc_uuid)
        os.makedirs(dest_dir, exist_ok=True)
        
        original_filename = file.filename or "audio_file"
        dest_path = os.path.join(dest_dir, original_filename)
        
        content = await file.read()
        with open(dest_path, "wb") as f:
            f.write(content)
        
        # Transcribe
        from app.loaders.audio_loader import AudioLoader
        result = AudioLoader.load_with_timestamps(dest_path, language=language)
        
        return {
            "status": "success",
            "text": result["document"].content,
            "segments": result["segments"],
            "duration_seconds": result["duration"],
            "detected_language": result["language"],
            "word_count": len(result["document"].content.split()),
            "metadata": result["document"].metadata,
        }
        
    except Exception as e:
        print(f"Transcription error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up temp file
        if 'dest_path' in dir() and os.path.exists(dest_path):
            os.remove(dest_path)
        if 'dest_dir' in dir() and os.path.exists(dest_dir):
            try:
                os.rmdir(dest_dir)
            except OSError:
                pass


# ═══════════════════════════════════════════════════════════════════
# Model & Provider Information
# ═══════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════
# Authentication Endpoints
# ═══════════════════════════════════════════════════════════════════

from app.auth.auth_handler import UserCreate, UserLogin


@router.post("/auth/register")
async def register(user_data: UserCreate):
    """Register a new user."""
    try:
        result = auth_handler.register_user(user_data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/auth/login")
async def login(login_data: UserLogin):
    """Login and receive JWT token."""
    try:
        result = auth_handler.login_user(login_data)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auth/me")
async def get_me(
    current_user: Optional[Dict[str, Any]] = Depends(get_optional_user),
):
    """Get current user info from JWT token."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "full_name": current_user["full_name"],
        "role": current_user["role"],
        "is_active": current_user["is_active"],
    }


@router.get("/providers")
async def list_providers():
    """List configured LLM and embedding providers with their status."""
    try:
        from app.ai.providers import list_providers as get_providers
        return get_providers()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/config")
async def get_app_config():
    """Return the current app configuration (non-sensitive settings)."""
    try:
        from config import (
            OLLAMA_BASE_URL,
            EMBEDDING_MODEL,
            COMPLETION_MODEL,
            VECTOR_DB_PATH,
            METADATA_DB_PATH,
            UPLOAD_DIR,
            CHUNK_SIZE,
            CHUNK_OVERLAP,
        )

        # Compute data directory size
        base_path = os.path.dirname(VECTOR_DB_PATH)
        total_size = 0
        if os.path.exists(base_path):
            for dirpath, dirnames, filenames in os.walk(base_path):
                for f in filenames:
                    fp = os.path.join(dirpath, f)
                    try:
                        total_size += os.path.getsize(fp)
                    except OSError:
                        pass

        return {
            "ollama_base_url": OLLAMA_BASE_URL,
            "embedding_model": EMBEDDING_MODEL,
            "completion_model": COMPLETION_MODEL,
            "vector_db_path": VECTOR_DB_PATH,
            "metadata_db_path": METADATA_DB_PATH,
            "upload_dir": UPLOAD_DIR,
            "chunk_size": CHUNK_SIZE,
            "chunk_overlap": CHUNK_OVERLAP,
            "data_size_bytes": total_size,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
