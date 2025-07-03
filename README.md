# Vector Indexing System

A powerful document indexing and retrieval system that uses vector embeddings and Ollama for semantic search and question answering. This system can process various document formats (PDF, DOCX, TXT, MD) and provides both CLI and REST API interfaces.

## Features

- **Multi-format Document Support**: Process PDF, DOCX, TXT, and Markdown files
- **Vector Embeddings**: Uses Ollama for generating high-quality embeddings
- **Semantic Search**: Find relevant documents using similarity search
- **Question Answering**: RAG (Retrieval-Augmented Generation) capabilities
- **REST API**: FastAPI-based web service
- **CLI Interface**: Command-line tools for indexing and querying
- **Chunking Strategy**: Intelligent document chunking with configurable overlap
- **Metadata Storage**: Persistent storage for document metadata

## Architecture

```
vectorIndexing/
├── main.py                 # Entry point with CLI and API server
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
│
├── ai/                    # AI/ML components
│   ├── ollama_client.py   # Ollama API client
│   └── embedding_utils.py # Embedding utilities
│
├── api/                   # REST API layer
│   ├── controllers.py     # API endpoints and logic
│   └── routes.py          # Route definitions
│
├── app/                   # Core application logic
│   ├── core/
│   │   ├── embedder.py    # Document embedding logic
│   │   ├── indexer.py     # Document indexing pipeline
│   │   └── searcher.py    # Search functionality
│   └── loaders/           # Document loaders
│       ├── pdf_loader.py  # PDF document processing
│       ├── docx_loader.py # DOCX document processing
│       ├── text_loader.py # Text file processing
│       └── audio_loader.py # Audio file processing
│
├── storage/               # Data persistence layer
│   ├── vector_store.py    # Vector database operations
│   └── metadata_store.py  # Document metadata storage
│
└── utils/                 # Utility functions
    ├── chunking.py        # Document chunking strategies
    └── text_processing.py # Text preprocessing utilities
```

## Prerequisites

- **Python 3.8+**
- **Ollama**: Install and run Ollama locally or on a remote server
  ```bash
  # Install Ollama (macOS/Linux)
  curl -fsSL https://ollama.ai/install.sh | sh
  
  # Pull required models
  ollama pull granite-embedding:latest
  ollama pull granite3.3:2b
  ```

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd vectorIndexing
   ```

2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

   **If you encounter issues with Python 3.12+**:
   ```bash
   # Upgrade pip and setuptools first
   pip install --upgrade pip setuptools wheel
   
   # Then install requirements
   pip install -r requirements.txt
   ```

4. **Configure environment** (optional):
   Create a `.env` file in the project root:
   ```env
   OLLAMA_BASE_URL=http://localhost:11434
   EMBEDDING_MODEL=granite-embedding:latest
   COMPLETION_MODEL=granite3.3:2b
   VECTOR_DB_PATH=data/vector_store
   METADATA_DB_PATH=data/metadata.db
   CHUNK_SIZE=512
   CHUNK_OVERLAP=128
   ```

## Usage

### Command Line Interface

**Index a single file**:
```bash
python main.py --index /path/to/document.pdf
```

**Index a directory**:
```bash
python main.py --index /path/to/documents/
```

**Start the API server**:
```bash
python main.py --serve
```

### REST API

Start the server and access the API at `http://localhost:8000`

**API Documentation**: Visit `http://localhost:8000/docs` for interactive Swagger documentation

#### Endpoints

**Search for similar documents**:
```bash
curl -X POST "http://localhost:8000/api/search" \
     -H "Content-Type: application/json" \
     -d '{"query": "machine learning algorithms", "top_k": 5}'
```

**Answer questions using RAG**:
```bash
curl -X POST "http://localhost:8000/api/answer" \
     -H "Content-Type: application/json" \
     -d '{"query": "What are the benefits of neural networks?", "context_window": 5}'
```

## Configuration

The system can be configured through environment variables or the `config.py` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `EMBEDDING_MODEL` | `granite-embedding:latest` | Model for generating embeddings |
| `COMPLETION_MODEL` | `granite3.3:2b` | Model for text generation |
| `VECTOR_DB_PATH` | `data/vector_store` | Vector database storage path |
| `METADATA_DB_PATH` | `data/metadata.db` | Metadata database path |
| `CHUNK_SIZE` | `512` | Size of document chunks (tokens) |
| `CHUNK_OVERLAP` | `128` | Overlap between chunks (tokens) |

## Supported File Formats

- **PDF**: `.pdf` files using PyMuPDF
- **Word Documents**: `.docx`, `.doc` files using python-docx
- **Text Files**: `.txt`, `.md`, `.rst` files
- **Audio**: `.mp3`, `.wav` files (with transcription support)

## How It Works

1. **Document Loading**: Files are processed by format-specific loaders
2. **Text Chunking**: Documents are split into overlapping chunks
3. **Embedding Generation**: Each chunk is converted to vector embeddings using Ollama
4. **Storage**: Vectors and metadata are stored in persistent databases
5. **Search**: Query embeddings are compared with stored vectors using similarity search
6. **Generation**: Retrieved context is used with LLMs to generate answers

## Development

**Project Structure**:
- `app/core/`: Core business logic
- `app/loaders/`: Document format handlers
- `storage/`: Data persistence layer
- `ai/`: AI/ML integration
- `api/`: REST API layer
- `utils/`: Shared utilities

**Running Tests**:
```bash
# Add test commands when test suite is implemented
pytest tests/
```

## Performance Tips

- **Chunk Size**: Smaller chunks (256-512 tokens) work better for specific queries
- **Overlap**: 20-25% overlap helps maintain context between chunks
- **Model Selection**: Choose embedding models based on your language and domain
- **Batch Processing**: Index multiple documents together for better performance

## Troubleshooting

**Installation Issues (Python 3.12+)**:
- **distutils ModuleNotFoundError**: Upgrade pip and setuptools before installing:
  ```bash
  pip install --upgrade pip setuptools wheel
  pip install -r requirements.txt
  ```
- **PyMuPDF build errors**: Install system dependencies:
  ```bash
  # Ubuntu/Debian
  sudo apt-get update && sudo apt-get install -y build-essential python3-dev
  
  # macOS (with Homebrew)
  brew install python@3.12
  ```

**Ollama Connection Issues**:
- Ensure Ollama is running: `ollama serve`
- Check the base URL in configuration
- Verify models are downloaded: `ollama list`

**Memory Issues**:
- Reduce `CHUNK_SIZE` for large documents
- Process documents in smaller batches
- Consider using a remote Ollama instance

**Slow Performance**:
- Use faster embedding models for development
- Implement caching for repeated queries
- Consider GPU acceleration for Ollama

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Commit your changes: `git commit -am 'Add feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- **Ollama** for providing local LLM capabilities
- **FastAPI** for the web framework
- **PyMuPDF** for PDF processing
- **Granite Models** for embeddings and completions