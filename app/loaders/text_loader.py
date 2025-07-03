from typing import List, Dict, Any
import os

from app.utils.chunking import Document

class TextLoader:
    """Loader for text documents."""
    
    @staticmethod
    def load(file_path: str) -> Document:
        """Load text file and convert to Document object."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        try:
            # Read text file
            with open(file_path, 'r', encoding='utf-8') as file:
                text = file.read()
            
            # Extract metadata
            filename = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            file_ext = os.path.splitext(file_path)[1].lower()
            
            # Create metadata
            metadata = {
                "source": file_path,
                "filename": filename,
                "file_size": file_size,
                "file_type": file_ext[1:] if file_ext.startswith('.') else file_ext
            }
            
            return Document(content=text, metadata=metadata)
            
        except Exception as e:
            raise Exception(f"Failed to load text file: {str(e)}")
