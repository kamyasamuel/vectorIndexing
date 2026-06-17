from typing import List, Dict, Any, Optional
import os
import logging
import tempfile
from PIL import Image
import io
import numpy as np
import PyPDF2  # Primary PDF processing library
import pytesseract  # For OCR fallback

# Try to import pdf2image for better image extraction
try:
    import pdf2image
    from pdf2image import convert_from_path
    HAS_PDF2IMAGE = True
except ImportError:
    HAS_PDF2IMAGE = False
    # Create a dummy function to avoid errors
    def convert_from_path(*args, **kwargs):
        raise ImportError("pdf2image is not installed")

from app.utils.chunking import Document

logger = logging.getLogger(__name__)

class PDFLoader:
    """Enhanced loader for PDF documents with OCR fallback."""
    
    @staticmethod
    def load(file_path: str, ocr_fallback: bool = True, min_text_length: int = 50) -> Document:
        """
        Load PDF file and convert to Document object with OCR support.
        
        Args:
            file_path: Path to the PDF file
            ocr_fallback: Whether to use OCR if normal text extraction yields poor results
            min_text_length: Minimum text length threshold for triggering OCR fallback
        
        Returns:
            Document object with extracted text and metadata
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        try:
            # Try regular PDF text extraction first
            text, page_count = PDFLoader._extract_text_with_pypdf2(file_path)
            
            # If text extraction is poor and OCR fallback is enabled, try OCR
            if ocr_fallback and (not text.strip() or len(text) < min_text_length):
                logger.info(f"Standard text extraction yielded little text ({len(text)} chars). Attempting OCR.")
                ocr_text = PDFLoader._extract_text_with_ocr(file_path)
                
                # Use OCR text if it's better than the original extraction
                if len(ocr_text) > len(text):
                    text = ocr_text
                    logger.info(f"Using OCR text ({len(text)} chars) as it's better than standard extraction.")
            
            # Extract metadata
            filename = os.path.basename(file_path)
            file_size = os.path.getsize(file_path)
            
            # Create metadata
            metadata = {
                "source": file_path,
                "filename": filename,
                "file_size": file_size,
                "file_type": "pdf",
                "page_count": page_count,
                "extraction_method": "pypdf2" if not (ocr_fallback and len(text) < min_text_length) else "ocr"
            }
            
            return Document(content=text, metadata=metadata)
            
        except Exception as e:
            logger.error(f"Failed to load PDF: {str(e)}")
            raise Exception(f"Failed to load PDF: {str(e)}")
    
    @staticmethod
    def _extract_text_with_pypdf2(file_path: str) -> tuple[str, int]:
        """Extract text from PDF using PyPDF2."""
        text = ""
        page_count = 0
        
        try:
            with open(file_path, 'rb') as file:
                # Create a PDF reader object
                pdf_reader = PyPDF2.PdfReader(file)
                page_count = len(pdf_reader.pages)
                
                # Extract text from each page
                for page_num in range(page_count):
                    page = pdf_reader.pages[page_num]
                    
                    # Try to extract text
                    try:
                        page_text = page.extract_text() or ""
                    except Exception as e:
                        logger.warning(f"Error extracting text from page {page_num}: {str(e)}")
                        page_text = ""
                    
                    # If the page has too little text, try to get annotations
                    if len(page_text) < 20:
                        try:
                            # Try to get annotations if available
                            if hasattr(page, '/Annots') and page['/Annots'] is not None:
                                for annotation in page['/Annots']:
                                    if annotation.get('/Contents'):
                                        page_text += annotation['/Contents'] + " "
                        except Exception:
                            pass
                    
                    text += page_text + "\n\n"
        
        except Exception as e:
            logger.error(f"Error in PyPDF2 processing: {str(e)}")
            # Return empty text but with correct page count if we can get it
            return "", page_count
            
        return text, page_count
    
    @staticmethod
    def _extract_text_with_ocr(file_path: str) -> str:
        """Extract text from PDF using OCR."""
        # Use PyPDF2 + OCR approach
        return PDFLoader._extract_text_with_pypdf_ocr(file_path)
    
    @staticmethod
    def _extract_text_with_pypdf_ocr(file_path: str) -> str:
        """Extract images from PDF using PyPDF2 and then apply OCR."""
        text = ""
        
        # For PyPDF2, we need to use pdf2image for good OCR results
        # If pdf2image is not available, recommend using it
        if not HAS_PDF2IMAGE:
            logger.warning("pdf2image is not installed. OCR quality will be limited.")
            return "OCR requires pdf2image library. Please install with: pip install pdf2image"
        
        try:
            # Convert PDF to images using pdf2image
            with tempfile.TemporaryDirectory() as temp_dir:
                images = convert_from_path(file_path)
                
                for i, image in enumerate(images):
                    # Convert PIL Image to text using pytesseract
                    page_text = pytesseract.image_to_string(image)
                    text += page_text + "\n\n"
        
        except Exception as e:
            logger.error(f"Error in OCR processing: {str(e)}")
            return f"OCR processing failed: {str(e)}"
                
        return text