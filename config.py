import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Ollama settings
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "nomic-embed-text:latest")
COMPLETION_MODEL = os.getenv("COMPLETION_MODEL", "granite3.3:2b")

# DeepSeek API settings
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")

# Vector database settings
VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", "data/vector_store")
METADATA_DB_PATH = os.getenv("METADATA_DB_PATH", "data/metadata.db")

# Upload directory for persistent file storage
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

# Document processing settings
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "512"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "128"))