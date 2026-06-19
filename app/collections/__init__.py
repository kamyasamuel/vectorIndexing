"""
Library/Collection Management for organizing documents.

Provides:
- Named collections (folders/lists of documents)
- Drag-drop support via sort-order tracking
- Collection sharing between users (read-only or edit)
- Bulk operations (add/remove/move multiple documents)
"""
from app.collections.models import CollectionManager, Collection, CollectionShare

__all__ = ["CollectionManager", "Collection", "CollectionShare"]