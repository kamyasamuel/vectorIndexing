import os
import json
import sqlite3
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import asdict

from app.utils.chunking import DocumentChunk
from app.ai.ollama_client import OllamaClient
from config import VECTOR_DB_PATH, METADATA_DB_PATH

class VectorStore:
    """Store and retrieve document chunks by vector similarity."""
    
    def __init__(self, vector_db_path: str = VECTOR_DB_PATH, 
                metadata_db_path: str = METADATA_DB_PATH):
        self.vector_db_path = vector_db_path
        self.metadata_db_path = metadata_db_path
        self.ollama_client = OllamaClient()
        
        # Ensure directories exist
        os.makedirs(os.path.dirname(vector_db_path), exist_ok=True)
        os.makedirs(os.path.dirname(metadata_db_path), exist_ok=True)
        
        # Initialize databases
        self._init_metadata_db()
        
    def _init_metadata_db(self):
        """Initialize SQLite database for metadata."""
        conn = sqlite3.connect(self.metadata_db_path)
        cursor = conn.cursor()
        
        # Create tables if they don't exist — matches MetadataStore schema
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            content TEXT,
            metadata TEXT
        )
        ''')
        
        # Add missing columns for backwards compatibility
        for col_def in [
            "ALTER TABLE documents ADD COLUMN title TEXT",
            "ALTER TABLE documents ADD COLUMN source TEXT",
            "ALTER TABLE documents ADD COLUMN file_type TEXT",
            "ALTER TABLE documents ADD COLUMN created_at TIMESTAMP",
        ]:
            try:
                cursor.execute(col_def)
            except sqlite3.OperationalError:
                pass
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            content TEXT,
            document_id TEXT,
            chunk_index INTEGER,
            metadata TEXT,
            embedding_file TEXT,
            FOREIGN KEY (document_id) REFERENCES documents (id)
        )
        ''')
        
        conn.commit()
        conn.close()
        
    def add_document_chunks(self, chunks: List[DocumentChunk]) -> List[str]:
        """Add document chunks to the vector store."""
        chunk_ids = []
        conn = sqlite3.connect(self.metadata_db_path)
        cursor = conn.cursor()
        
        try:
            for chunk in chunks:
                # Generate embedding
                embedding = self.ollama_client.get_embedding(chunk.content)
                
                # Save embedding to file
                embedding_file = f"{self.vector_db_path}/{chunk.id}.npy"
                os.makedirs(os.path.dirname(embedding_file), exist_ok=True)
                np.save(embedding_file, np.array(embedding))
                
                # Save metadata to SQLite
                cursor.execute(
                    "INSERT INTO chunks VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        chunk.id,
                        chunk.content,
                        chunk.document_id,
                        chunk.chunk_index,
                        json.dumps(chunk.metadata),
                        embedding_file
                    )
                )
                
                chunk_ids.append(chunk.id)
                
            conn.commit()
            
        except Exception as e:
            conn.rollback()
            raise e
            
        finally:
            conn.close()
            
        return chunk_ids
    
    def get_chunk_count(self) -> int:
        """Get the total number of chunks in the vector store."""
        conn = sqlite3.connect(self.metadata_db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT COUNT(*) FROM chunks")
            result = cursor.fetchone()
            return result[0] if result else 0
        except Exception:
            return 0
        finally:
            conn.close()
    
    def add_document(self, document_id: str, content: str, metadata: Dict[str, Any]):
        """Add document metadata to the database."""
        conn = sqlite3.connect(self.metadata_db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "INSERT INTO documents (id, content, metadata) VALUES (?, ?, ?)",
                (document_id, content, json.dumps(metadata))
            )
            conn.commit()
            
        except Exception as e:
            conn.rollback()
            raise e
            
        finally:
            conn.close()
    
    def similarity_search(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Find chunks most similar to the query."""
        # Generate query embedding
        query_embedding = np.array(self.ollama_client.get_embedding(query))
        
        # Get all chunk embeddings and calculate similarity
        results = []
        conn = sqlite3.connect(self.metadata_db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT id, content, document_id, chunk_index, metadata, embedding_file FROM chunks")
            chunks = cursor.fetchall()
            
            for chunk in chunks:
                chunk_id, content, document_id, chunk_index, metadata_str, embedding_file = chunk
                
                # Load embedding
                if os.path.exists(embedding_file):
                    chunk_embedding = np.load(embedding_file)
                    
                    # Calculate cosine similarity — guard against zero vectors
                    q_norm = np.linalg.norm(query_embedding)
                    c_norm = np.linalg.norm(chunk_embedding)
                    if q_norm == 0 or c_norm == 0:
                        similarity = 0.0
                    else:
                        similarity = float(np.dot(query_embedding, chunk_embedding) / (q_norm * c_norm))
                    
                    results.append({
                        "id": chunk_id,
                        "content": content,
                        "document_id": document_id,
                        "chunk_index": chunk_index,
                        "metadata": json.loads(metadata_str),
                        "similarity": float(similarity)
                    })
            
            # Sort by similarity (highest first)
            results = sorted(results, key=lambda x: x["similarity"], reverse=True)
            
            # Return top-k results
            return results[:top_k]
            
        finally:
            conn.close()
            
    def update_document_metadata(self, document_id: str, metadata: Dict[str, Any]):
        """Update document metadata in the vector store database.
        
        Merges the provided metadata keys into the existing metadata JSON.
        Also updates the top-level source column if 'source' is in metadata.
        """
        conn = sqlite3.connect(self.metadata_db_path)
        cursor = conn.cursor()
        
        try:
            # Get existing metadata
            cursor.execute("SELECT metadata FROM documents WHERE id = ?", (document_id,))
            result = cursor.fetchone()
            
            if result:
                existing_metadata = json.loads(result[0])
                existing_metadata.update(metadata)
                
                cursor.execute(
                    "UPDATE documents SET metadata = ? WHERE id = ?",
                    (json.dumps(existing_metadata), document_id)
                )
                
                # Also update the source column if provided
                if "source" in metadata:
                    cursor.execute(
                        "UPDATE documents SET source = ? WHERE id = ?",
                        (metadata["source"], document_id)
                    )
                
                conn.commit()
                
        except Exception as e:
            conn.rollback()
            raise e
            
        finally:
            conn.close()
    
    def delete_document(self, document_id: str) -> bool:
        """Delete a document and its chunks from the vector store."""
        conn = sqlite3.connect(self.metadata_db_path)
        cursor = conn.cursor()
        
        try:
            # Delete chunks first
            cursor.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
            
            # Delete document
            cursor.execute("DELETE FROM documents WHERE id = ?", (document_id,))
            deleted = cursor.rowcount > 0
            
            conn.commit()
            return deleted
            
        except Exception as e:
            conn.rollback()
            raise e
            
        finally:
            conn.close()
    
    def get_document_by_id(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get document metadata by ID."""
        conn = sqlite3.connect(self.metadata_db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute("SELECT id, content, metadata FROM documents WHERE id = ?", (document_id,))
            result = cursor.fetchone()
            
            if result:
                doc_id, content, metadata_str = result
                return {
                    "id": doc_id,
                    "content": content,
                    "metadata": json.loads(metadata_str)
                }
            else:
                return None
                
        finally:
            conn.close()
