import re
from typing import List, Optional

def clean_text(text: str) -> str:
    """Clean and normalize text."""
    # Replace multiple newlines with a single one
    text = re.sub(r'\n+', '\n', text)
    
    # Replace multiple spaces with a single one
    text = re.sub(r'\s+', ' ', text)
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    return text

def extract_sentences(text: str) -> List[str]:
    """Split text into sentences."""
    # Simple sentence splitter (can be improved with NLP libraries)
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]

def normalize_whitespace(text: str) -> str:
    """Normalize whitespace in text."""
    # Replace tabs and multiple spaces
    text = re.sub(r'\t', ' ', text)
    text = re.sub(r' +', ' ', text)
    
    # Normalize line endings
    text = re.sub(r'\r\n', '\n', text)
    text = re.sub(r'\r', '\n', text)
    
    return text.strip()

def remove_special_characters(text: str, keep_punctuation: bool = True) -> str:
    """Remove special characters from text."""
    if keep_punctuation:
        # Keep alphanumeric and basic punctuation
        pattern = r'[^a-zA-Z0-9\s.,;:!?"\'()-]'
    else:
        # Keep only alphanumeric
        pattern = r'[^a-zA-Z0-9\s]'
        
    return re.sub(pattern, '', text)

def truncate_text(text: str, max_length: int, add_ellipsis: bool = True) -> str:
    """Truncate text to maximum length."""
    if len(text) <= max_length:
        return text
        
    truncated = text[:max_length]
    
    # Try to truncate at word boundary
    last_space = truncated.rfind(' ')
    if last_space > max_length * 0.8:  # Only if we don't lose too much text
        truncated = truncated[:last_space]
        
    if add_ellipsis:
        truncated += "..."
        
    return truncated
