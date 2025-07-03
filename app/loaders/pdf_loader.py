from typing import List, Dict, Any
import fitz  # PyMuPDF
import os

from app.utils.chunking import Document

class PDFLoader:
    """Loader for PDF documents."""
    
    @staticmethod
    def load(file_path: str) -> Document:
        """Load PDF file and convert to Document object."""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        try:
            # Extract text from PDF
            text = ""
            with fitz.open(file_path) as pdf:
                for page_num, page in enumerate(pdf):
                    text += page.get_text()
            
            # Extract metadata
            filename = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            
            # Create metadata
            metadata = {
                "source": file_path,
                "filename": filename,
                "file_size": file_size,
                "file_type": "pdf",
                "page_count": pdf.page_count if "pdf" in locals() else None
            }
            
            return Document(content=text, metadata=metadata)
            
        except Exception as e:
            raise Exception(f"Failed to load PDF: {str(e)}")