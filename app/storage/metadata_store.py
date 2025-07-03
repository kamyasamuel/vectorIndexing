import os
import json
import sqlite3
from typing import List, Dict, Any, Optional

from config import METADATA_DB_PATH

class MetadataStore:
    """Store and retrieve document metadata."""
    
    def __init__(self, db_path: str = METADATA_DB_PATH):
        self.db_path = db_path
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        # Initialize database
        self._init_db()
        
    def _init_db(self):
        """Initialize SQLite database for metadata."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create tables if they don't exist
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            title TEXT,
            source TEXT,
            file_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS document_tags (
            document_id TEXT,
            tag TEXT,
            FOREIGN KEY (document_id) REFERENCES documents (id),
            PRIMARY KEY (document_id, tag)
        )
        ''')
        
        conn.commit()
        conn.close()
    
    def add_document(self, document_id: str, title: str, source: str, 
                    file_type: str, metadata: Dict[str, Any]) -> str:
        """Add document metadata to the database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "INSERT INTO documents (id, title, source, file_type, metadata) VALUES (?, ?, ?, ?, ?)",
                (document_id, title, source, file_type, json.dumps(metadata))
            )
            
            # Add tags if present
            if "tags" in metadata and isinstance(metadata["tags"], list):
                for tag in metadata["tags"]:
                    cursor.execute(
                        "INSERT OR IGNORE INTO document_tags VALUES (?, ?)",
                        (document_id, tag)
                    )
                    
            conn.commit()
            return document_id
            
        except Exception as e:
            conn.rollback()
            raise e
            
        finally:
            conn.close()
    
    def get_document(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get document metadata by ID."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "SELECT id, title, source, file_type, created_at, metadata FROM documents WHERE id = ?", 
                (document_id,)
            )
            result = cursor.fetchone()
            
            if result:
                doc_id, title, source, file_type, created_at, metadata_str = result
                
                # Get tags
                cursor.execute(
                    "SELECT tag FROM document_tags WHERE document_id = ?",
                    (doc_id,)
                )
                tags = [row[0] for row in cursor.fetchall()]
                
                # Parse metadata
                metadata = json.loads(metadata_str)
                metadata["tags"] = tags
                
                return {
                    "id": doc_id,
                    "title": title,
                    "source": source,
                    "file_type": file_type,
                    "created_at": created_at,
                    "metadata": metadata
                }
                
            return None
            
        finally:
            conn.close()
            
    def list_documents(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """List all documents with pagination."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                "SELECT id, title, source, file_type, created_at FROM documents ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset)
            )
            results = cursor.fetchall()
            
            documents = []
            for row in results:
                doc_id, title, source, file_type, created_at = row
                documents.append({
                    "id": doc_id,
                    "title": title,
                    "source": source,
                    "file_type": file_type,
                    "created_at": created_at
                })
                
            return documents
            
        finally:
            conn.close()
            
    def search_by_tag(self, tag: str) -> List[Dict[str, Any]]:
        """Search documents by tag."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                """
                SELECT d.id, d.title, d.source, d.file_type, d.created_at
                FROM documents d
                JOIN document_tags t ON d.id = t.document_id
                WHERE t.tag = ?
                ORDER BY d.created_at DESC
                """,
                (tag,)
            )
            results = cursor.fetchall()
            
            documents = []
            for row in results:
                doc_id, title, source, file_type, created_at = row
                documents.append({
                    "id": doc_id,
                    "title": title,
                    "source": source,
                    "file_type": file_type,
                    "created_at": created_at
                })
                
            return documents
            
        finally:
            conn.close()
            
    def delete_document(self, document_id: str) -> bool:
        """Delete a document and its tags."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Delete tags first (foreign key constraint)
            cursor.execute("DELETE FROM document_tags WHERE document_id = ?", (document_id,))
            
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
