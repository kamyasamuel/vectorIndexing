import numpy as np
from typing import List, Dict, Any, Optional

def cosine_similarity(embedding1: List[float], embedding2: List[float]) -> float:
    """Calculate cosine similarity between two embeddings."""
    a = np.array(embedding1)
    b = np.array(embedding2)
    
    # Handle zero vectors
    if np.all(a == 0) or np.all(b == 0):
        return 0.0
    
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

def normalize_embedding(embedding: List[float]) -> List[float]:
    """Normalize embedding vector to unit length."""
    arr = np.array(embedding)
    norm = np.linalg.norm(arr)
    
    if norm == 0:
        return embedding
        
    return (arr / norm).tolist()

def average_embeddings(embeddings: List[List[float]]) -> List[float]:
    """Calculate average of multiple embeddings."""
    if not embeddings:
        return []
        
    # Convert to numpy array
    arr = np.array(embeddings)
    
    # Calculate average
    avg = np.mean(arr, axis=0)
    
    # Normalize
    return normalize_embedding(avg.tolist())
