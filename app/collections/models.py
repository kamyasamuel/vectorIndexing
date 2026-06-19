"""
Collection management models for organizing documents into named collections.

Supports:
- CRUD operations on collections
- Document membership (many-to-many)
- Sort order (drag-drop support)
- Sharing between users
- Bulk operations
"""

from typing import List, Dict, Any, Optional
import os
import json
import sqlite3
import uuid
from datetime import datetime

from config import METADATA_DB_PATH


class CollectionShare:
    """Represents a share grant for a collection to another user."""

    def __init__(
        self,
        collection_id: str,
        shared_with_user_id: str,
        permission: str = "read",  # "read" or "edit"
        shared_by_user_id: Optional[str] = None,
        shared_at: Optional[str] = None,
    ):
        self.collection_id = collection_id
        self.shared_with_user_id = shared_with_user_id
        self.permission = permission
        self.shared_by_user_id = shared_by_user_id
        self.shared_at = shared_at or datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "collection_id": self.collection_id,
            "shared_with_user_id": self.shared_with_user_id,
            "permission": self.permission,
            "shared_by_user_id": self.shared_by_user_id,
            "shared_at": self.shared_at,
        }


class Collection:
    """A named collection of documents with sortable order."""

    def __init__(
        self,
        name: str,
        owner_id: str,
        description: str = "",
        collection_id: Optional[str] = None,
        document_ids: Optional[List[str]] = None,
        created_at: Optional[str] = None,
        updated_at: Optional[str] = None,
    ):
        self.id = collection_id or str(uuid.uuid4())
        self.name = name
        self.description = description
        self.owner_id = owner_id
        self.document_ids = document_ids or []
        self.created_at = created_at or datetime.utcnow().isoformat()
        self.updated_at = updated_at or self.created_at

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "owner_id": self.owner_id,
            "document_count": len(self.document_ids),
            "document_ids": self.document_ids,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class CollectionManager:
    """Manages collections of documents with SQLite persistence.

    Operations are user-scoped: users can only see/modify their own
    collections and collections shared with them.
    """

    def __init__(self, db_path: str = METADATA_DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize the collections database schema."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Collections table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS collections (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            owner_id TEXT NOT NULL,
            document_ids TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_collections_owner
        ON collections(owner_id)
        ''')

        # Collection shares table
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS collection_shares (
            collection_id TEXT NOT NULL,
            shared_with_user_id TEXT NOT NULL,
            permission TEXT DEFAULT 'read',
            shared_by_user_id TEXT,
            shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (collection_id, shared_with_user_id),
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
        )
        ''')
        cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_shares_user
        ON collection_shares(shared_with_user_id)
        ''')

        conn.commit()
        conn.close()

    # ─── CRUD Operations ────────────────────────────────────────

    def create_collection(
        self,
        name: str,
        owner_id: str,
        description: str = "",
    ) -> Collection:
        """Create a new collection.

        Args:
            name: Display name for the collection.
            owner_id: The ID of the user who owns this collection.
            description: Optional description.

        Returns:
            The created Collection object.
        """
        collection = Collection(name=name, owner_id=owner_id, description=description)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO collections (id, name, description, owner_id, document_ids) "
                "VALUES (?, ?, ?, ?, ?)",
                (collection.id, collection.name, collection.description,
                 collection.owner_id, json.dumps(collection.document_ids)),
            )
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise ValueError(f"Failed to create collection: {e}")
        finally:
            conn.close()

        return collection

    def get_collection(self, collection_id: str, user_id: str) -> Optional[Collection]:
        """Get a collection by ID (must be owner or shared with user).

        Args:
            collection_id: The collection UUID.
            user_id: The requesting user's ID.

        Returns:
            Collection if found and accessible, None otherwise.
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                """SELECT id, name, description, owner_id, document_ids, created_at, updated_at
                   FROM collections WHERE id = ?""",
                (collection_id,),
            )
            row = cursor.fetchone()
            if not row:
                return None

            collection = self._row_to_collection(row)

            # Check access: owner or shared
            if collection.owner_id != user_id:
                cursor.execute(
                    "SELECT permission FROM collection_shares "
                    "WHERE collection_id = ? AND shared_with_user_id = ?",
                    (collection_id, user_id),
                )
                share = cursor.fetchone()
                if not share:
                    return None

            return collection

        finally:
            conn.close()

    def list_collections(self, user_id: str) -> List[Collection]:
        """List all collections accessible to a user.

        Returns both owned collections and collections shared with the user.

        Args:
            user_id: The user's ID.

        Returns:
            List of Collection objects.
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            # Owned collections
            cursor.execute(
                """SELECT id, name, description, owner_id, document_ids, created_at, updated_at
                   FROM collections WHERE owner_id = ?
                   ORDER BY updated_at DESC""",
                (user_id,),
            )
            owned = [self._row_to_collection(r) for r in cursor.fetchall()]

            # Shared collections
            cursor.execute(
                """SELECT c.id, c.name, c.description, c.owner_id, c.document_ids,
                          c.created_at, c.updated_at
                   FROM collections c
                   JOIN collection_shares s ON c.id = s.collection_id
                   WHERE s.shared_with_user_id = ?
                   ORDER BY c.updated_at DESC""",
                (user_id,),
            )
            shared = [self._row_to_collection(r) for r in cursor.fetchall()]

            # Deduplicate by ID (in case user is both owner and shared with)
            seen = set()
            all_collections = []
            for c in owned + shared:
                if c.id not in seen:
                    seen.add(c.id)
                    all_collections.append(c)

            return all_collections

        finally:
            conn.close()

    def update_collection(
        self,
        collection_id: str,
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
    ) -> Collection:
        """Update a collection's metadata.

        Args:
            collection_id: The collection UUID.
            user_id: The requesting user's ID (must be owner).
            name: New name (optional).
            description: New description (optional).

        Returns:
            Updated Collection.
        """
        collection = self.get_collection(collection_id, user_id)
        if not collection:
            raise ValueError(f"Collection '{collection_id}' not found or not accessible")

        if collection.owner_id != user_id:
            raise PermissionError("Only the collection owner can update metadata")

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            if name is not None:
                cursor.execute(
                    "UPDATE collections SET name = ?, updated_at = ? WHERE id = ?",
                    (name, datetime.utcnow().isoformat(), collection_id),
                )
            if description is not None:
                cursor.execute(
                    "UPDATE collections SET description = ?, updated_at = ? WHERE id = ?",
                    (description, datetime.utcnow().isoformat(), collection_id),
                )
            conn.commit()
        finally:
            conn.close()

        return self.get_collection(collection_id, user_id)  # type: ignore

    def delete_collection(self, collection_id: str, user_id: str):
        """Delete a collection (owner only).

        Args:
            collection_id: The collection UUID.
            user_id: The requesting user's ID (must be owner).
        """
        collection = self.get_collection(collection_id, user_id)
        if not collection:
            raise ValueError(f"Collection '{collection_id}' not found")

        if collection.owner_id != user_id:
            raise PermissionError("Only the collection owner can delete")

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM collection_shares WHERE collection_id = ?", (collection_id,))
            cursor.execute("DELETE FROM collections WHERE id = ?", (collection_id,))
            conn.commit()
        finally:
            conn.close()

    # ─── Document Membership ────────────────────────────────────

    def add_documents(self, collection_id: str, user_id: str, document_ids: List[str]) -> Collection:
        """Add documents to a collection.

        Args:
            collection_id: The collection UUID.
            user_id: The requesting user's ID (must have edit permission).
            document_ids: List of document UUIDs to add.

        Returns:
            Updated Collection.
        """
        self._check_edit_permission(collection_id, user_id)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT document_ids FROM collections WHERE id = ?", (collection_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Collection '{collection_id}' not found")

            current_ids = set(json.loads(row[0]))
            current_ids.update(document_ids)
            new_ids = sorted(current_ids)  # Maintain deterministic order

            cursor.execute(
                "UPDATE collections SET document_ids = ?, updated_at = ? WHERE id = ?",
                (json.dumps(new_ids), datetime.utcnow().isoformat(), collection_id),
            )
            conn.commit()
        finally:
            conn.close()

        return self._load_collection(collection_id)

    def remove_documents(self, collection_id: str, user_id: str, document_ids: List[str]) -> Collection:
        """Remove documents from a collection.

        Args:
            collection_id: The collection UUID.
            user_id: The requesting user's ID (must have edit permission).
            document_ids: List of document UUIDs to remove.

        Returns:
            Updated Collection.
        """
        self._check_edit_permission(collection_id, user_id)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT document_ids FROM collections WHERE id = ?", (collection_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Collection '{collection_id}' not found")

            remove_set = set(document_ids)
            current_ids = json.loads(row[0])
            new_ids = [did for did in current_ids if did not in remove_set]

            cursor.execute(
                "UPDATE collections SET document_ids = ?, updated_at = ? WHERE id = ?",
                (json.dumps(new_ids), datetime.utcnow().isoformat(), collection_id),
            )
            conn.commit()
        finally:
            conn.close()

        return self._load_collection(collection_id)

    def reorder_documents(self, collection_id: str, user_id: str, document_ids: List[str]) -> Collection:
        """Reorder documents in a collection (for drag-drop support).

        Args:
            collection_id: The collection UUID.
            user_id: The requesting user's ID (must have edit permission).
            document_ids: The complete ordered list of document UUIDs.

        Returns:
            Updated Collection.
        """
        self._check_edit_permission(collection_id, user_id)

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "UPDATE collections SET document_ids = ?, updated_at = ? WHERE id = ?",
                (json.dumps(document_ids), datetime.utcnow().isoformat(), collection_id),
            )
            conn.commit()
        finally:
            conn.close()

        return self._load_collection(collection_id)

    # ─── Sharing ────────────────────────────────────────────────

    def share_collection(
        self,
        collection_id: str,
        owner_id: str,
        shared_with_user_id: str,
        permission: str = "read",
    ) -> CollectionShare:
        """Share a collection with another user.

        Args:
            collection_id: The collection UUID.
            owner_id: The owner's user ID.
            shared_with_user_id: The user to share with.
            permission: "read" or "edit".

        Returns:
            The CollectionShare object.
        """
        # Verify ownership
        collection = self.get_collection(collection_id, owner_id)
        if not collection or collection.owner_id != owner_id:
            raise PermissionError("Only the collection owner can share")

        share = CollectionShare(
            collection_id=collection_id,
            shared_with_user_id=shared_with_user_id,
            permission=permission,
            shared_by_user_id=owner_id,
        )

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT OR REPLACE INTO collection_shares "
                "(collection_id, shared_with_user_id, permission, shared_by_user_id) "
                "VALUES (?, ?, ?, ?)",
                (share.collection_id, share.shared_with_user_id,
                 share.permission, share.shared_by_user_id),
            )
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise ValueError(f"Failed to share collection: {e}")
        finally:
            conn.close()

        return share

    def revoke_share(self, collection_id: str, owner_id: str, shared_with_user_id: str):
        """Revoke a share grant.

        Args:
            collection_id: The collection UUID.
            owner_id: The owner's user ID.
            shared_with_user_id: The user to revoke access from.
        """
        collection = self.get_collection(collection_id, owner_id)
        if not collection or collection.owner_id != owner_id:
            raise PermissionError("Only the collection owner can revoke shares")

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "DELETE FROM collection_shares "
                "WHERE collection_id = ? AND shared_with_user_id = ?",
                (collection_id, shared_with_user_id),
            )
            conn.commit()
        finally:
            conn.close()

    def get_shares(self, collection_id: str, user_id: str) -> List[CollectionShare]:
        """Get all shares for a collection (owner only).

        Args:
            collection_id: The collection UUID.
            user_id: The requesting user's ID (must be owner).

        Returns:
            List of CollectionShare objects.
        """
        collection = self.get_collection(collection_id, user_id)
        if not collection or collection.owner_id != user_id:
            raise PermissionError("Only the collection owner can view shares")

        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT collection_id, shared_with_user_id, permission, "
                "shared_by_user_id, shared_at FROM collection_shares "
                "WHERE collection_id = ?",
                (collection_id,),
            )
            shares = []
            for row in cursor.fetchall():
                shares.append(CollectionShare(
                    collection_id=row[0],
                    shared_with_user_id=row[1],
                    permission=row[2],
                    shared_by_user_id=row[3],
                    shared_at=row[4],
                ))
            return shares
        finally:
            conn.close()

    # ─── Helpers ────────────────────────────────────────────────

    def _check_edit_permission(self, collection_id: str, user_id: str):
        """Check if a user has edit permission on a collection.

        Raises PermissionError if not.
        """
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                "SELECT owner_id FROM collections WHERE id = ?",
                (collection_id,),
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Collection '{collection_id}' not found")

            if row[0] == user_id:
                return  # Owner has full access

            cursor.execute(
                "SELECT permission FROM collection_shares "
                "WHERE collection_id = ? AND shared_with_user_id = ?",
                (collection_id, user_id),
            )
            share = cursor.fetchone()
            if not share:
                raise PermissionError("Collection not shared with this user")
            if share[0] not in ("edit", "admin"):
                raise PermissionError("Read-only collection — edit permission required")
        finally:
            conn.close()

    def _load_collection(self, collection_id: str) -> Collection:
        """Reload a collection from the database."""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute(
                """SELECT id, name, description, owner_id, document_ids,
                          created_at, updated_at
                   FROM collections WHERE id = ?""",
                (collection_id,),
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError(f"Collection '{collection_id}' not found")
            return self._row_to_collection(row)
        finally:
            conn.close()

    @staticmethod
    def _row_to_collection(row) -> Collection:
        """Convert a SQLite row to a Collection object."""
        return Collection(
            collection_id=row[0],
            name=row[1],
            description=row[2],
            owner_id=row[3],
            document_ids=json.loads(row[4]) if row[4] else [],
            created_at=row[5],
            updated_at=row[6],
        )