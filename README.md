# Vector Indexing System

A powerful document indexing and retrieval system that uses vector embeddings and Ollama for semantic search and question answering. This system can process various document formats (PDF, DOCX, TXT, MD) and provides a minimalist modern UI, CLI and REST API interfaces.

## Features

- **Multi-format Document Support**: Process PDF, DOCX, TXT, and Markdown files
- **Vector Embeddings**: Uses Ollama for generating high-quality embeddings
- **Semantic Search**: Find relevant documents using similarity search
- **Question Answering**: RAG (Retrieval-Augmented Generation) capabilities
- **Modern UI**: Minimalist React-based user interface with animations
- **REST API**: FastAPI-based web service
- **CLI Interface**: Command-line tools for indexing and querying
- **Chunking Strategy**: Intelligent document chunking with configurable overlap
- **Metadata Storage**: Persistent storage for document metadata
- **Multiple Search Modes**: Simple search, question answering, and metadata-based filtering

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
├── frontend/              # React-based UI
│   ├── package.json       # Frontend dependencies
│   ├── tsconfig.json      # TypeScript configuration
│   └── src/
│       ├── components/    # UI components
│       └── services/      # API services
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

**Start the frontend UI**:
```bash
# Install dependencies
cd frontend
npm install

# Start the development server
npm start
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

**Upload and index a file**:
```bash
curl -X POST "http://localhost:8000/api/index/file" \
     -F "file=@/path/to/document.pdf"
```

## Frontend UI

The system includes a minimalist, modern UI for intuitive interaction with the vector search functionality.

![UI Screenshot](https://via.placeholder.com/800x450?text=Vector+Search+UI)

### Frontend Features

- **Minimalist Design**: Clean interface with focus on current search/operation
- **Three Query Modes**:
  - Simple semantic search
  - Question answering (RAG)
  - Metadata-filtered search
- **Real-time Animations**:
  - Elegant loading states for search operations
  - Vector visualization for result similarity
  - Document preview transitions
- **System Status Monitor**: Compact, expandable dashboard for system metrics

### UI Screenshot Walkthrough

#### Search Interface
![Search Interface](https://via.placeholder.com/800x450?text=Search+Interface)
*The main search interface with query mode selection*

#### Results View
![Results View](https://via.placeholder.com/800x450?text=Results+View)
*Document results with similarity visualization*

#### System Monitor
![System Monitor](https://via.placeholder.com/800x450?text=System+Monitor)
*Expandable system status dashboard*

### Tech Stack

- **Frontend**: React with TypeScript
- **Styling**: TailwindCSS for minimal, responsive design
- **Animations**: Framer Motion for fluid transitions
- **Charts**: D3.js for vector visualizations
- **API Integration**: Axios for backend communication

### Installation & Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Default frontend URL: http://localhost:3000

## System Usage Guide

### Setting Up Your Document Collection

For optimal performance when building your knowledge base:

1. **Prepare your documents**:
   - Remove unnecessary headers, footers, and metadata
   - Split very large documents (100+ pages) into logical sections
   - Ensure text is properly encoded and doesn't contain OCR errors

2. **Organize document directories**:
   ```
   documents/
   ├── technical/          # Technical documentation
   ├── research-papers/    # Academic papers
   └── knowledge-base/     # General knowledge
   ```

3. **Batch indexing**:
   ```bash
   # Index specific document types
   find ./documents -name "*.pdf" | xargs -I{} python main.py --index {}
   
   # Index recursively with specific naming
   python main.py --index ./documents/research-papers
   ```

### Querying Strategies

**Simple Search vs. Question Answering**:

- **Use search** for finding relevant documents:
  ```bash
  curl -X POST "http://localhost:8000/api/search" \
       -H "Content-Type: application/json" \
       -d '{"query": "tornado", "top_k": 5}'
  ```

- **Use question answering** for specific information:
  ```bash
  curl -X POST "http://localhost:8000/api/answer" \
       -H "Content-Type: application/json" \
       -d '{"query": "What are the key differences between random forests and gradient boosting?", "context_window": 5}'
  ```

**Filter by Metadata**:
```bash
curl -X POST "http://localhost:8000/api/search" \
     -H "Content-Type: application/json" \
     -d '{
       "query": "neural networks",
       "top_k": 5,
       "filters": {
         "file_type": "pdf",
         "tags": ["research", "ai"]
       }
     }'
```

### Monitoring and Maintenance

**Check System Status**:
```bash
# View indexed document count
sqlite3 data/metadata.db "SELECT COUNT(*) FROM documents;"

# Check vector storage size
du -sh data/vector_store/
```

**Backup Your Data**:
```bash
# Backup metadata database
cp data/metadata.db data/backups/metadata_$(date +%Y%m%d).db

# Backup vector store
tar -czf data/backups/vector_store_$(date +%Y%m%d).tar.gz data/vector_store/
```

### Integration Examples

**Python Client**:
```python
import requests
import json

def search_documents(query, top_k=5):
    url = "http://localhost:8000/api/search"
    payload = {
        "query": query,
        "top_k": top_k
    }
    response = requests.post(url, json=payload)
    return response.json()

def answer_question(query, context_window=5):
    url = "http://localhost:8000/api/answer"
    payload = {
        "query": query,
        "context_window": context_window
    }
    response = requests.post(url, json=payload)
    return response.json()

# Example usage
results = search_documents("quantum computing algorithms")
answer = answer_question("How does Shor's algorithm work?")
```

**Bash Script for Batch Processing**:
```bash
#!/bin/bash
# batch_index.sh - Index multiple directories

DIRS=("./docs/technical" "./docs/manuals" "./docs/research")

for dir in "${DIRS[@]}"; do
  echo "Indexing $dir..."
  python main.py --index "$dir"
  echo "Finished indexing $dir"
done

echo "Starting API server..."
python main.py --serve
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

- **PDF**: `.pdf` files with hybrid extraction (PyPDF2 + OCR fallback)
- **Word Documents**: `.docx`, `.doc` files using python-docx
- **Text Files**: `.txt`, `.md`, `.rst` files
- **Audio**: `.mp3`, `.wav` files (with transcription support)

### Advanced PDF Processing

The system uses a robust two-step approach for PDF processing:

1. **Standard Text Extraction**: First attempts to extract text directly using PyPDF2
2. **OCR Fallback**: For scanned documents or problematic PDFs that yield limited text, the system automatically falls back to OCR using Tesseract

This hybrid approach ensures high-quality text extraction from various PDF types including:
- Native digital PDFs with embedded text
- Scanned documents
- Image-heavy PDFs
- Documents with complex layouts

**Note**: For OCR functionality to work, you must install Tesseract OCR on your system:
```bash
# Ubuntu/Debian
sudo apt-get install -y tesseract-ocr

# macOS with Homebrew
brew install tesseract

# Windows
# Download installer from: https://github.com/UB-Mannheim/tesseract/wiki
```

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

## User Interface

The Vector Indexing System includes a modern, minimalist frontend built with React, TypeScript, and Tailwind CSS. The UI focuses on the current operation, bringing the most important elements to the forefront while minimizing distractions.

### UI Features

- **Three Query Modes**: 
  - **Semantic Search**: Find documents by semantic similarity to queries
  - **Question & Answer**: Get direct answers with cited sources
  - **Metadata Search**: Filter documents by various metadata properties

- **Animated Transitions**: Smooth animations between views and during loading states provide visual feedback for operations in progress

- **System Status View**: A slide-out drawer shows detailed system information including indexed document count, resource usage, and system actions

- **File Upload**: Drag-and-drop interface for document uploading with progress indicators and feedback

### UI Screenshots

**Semantic Search View**
![Semantic Search UI](https://example.com/screenshots/semantic-search.png)

**Question & Answer View**
![Question Answer UI](https://example.com/screenshots/question-answer.png)

**Metadata Search View**
![Metadata Search UI](https://example.com/screenshots/metadata-search.png)

**System Status View**
![System Status UI](https://example.com/screenshots/system-status.png)

### Running the Frontend

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The UI will be available at `http://localhost:3001` and will automatically connect to the backend API running at `http://localhost:8000/api`.

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- **Ollama** for providing local LLM capabilities
- **FastAPI** for the web framework
- **PyPDF2** for PDF processing
- **React** and **Framer Motion** for the UI
- **Tailwind CSS** for styling
- **Granite Models** for embeddings and completions