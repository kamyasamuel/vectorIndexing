import argparse
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.core.indexer import DocumentIndexer
from app.api.routes import router
from config import UPLOAD_DIR

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="Textual Data Indexer API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Allows the frontend to access the API
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Textual Data Indexer API is running"}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Textual Data Indexer")
    parser.add_argument("--index", help="Index a file or directory")
    parser.add_argument("--serve", action="store_true", help="Start the API server")
    parser.add_argument("--dev", action="store_true", help="Run server in development mode with auto-reload")
    
    args = parser.parse_args()
    
    if args.index:
        indexer = DocumentIndexer()
        path = args.index
        
        import os
        if os.path.isdir(path):
            print(f"Indexing directory: {path}")
            doc_ids = indexer.index_directory(path)
            print(f"Successfully indexed {len(doc_ids)} documents")
        elif os.path.isfile(path):
            print(f"Indexing file: {path}")
            doc_id = indexer.index_file(path)
            print(f"Successfully indexed document with ID: {doc_id}")
        else:
            print(f"Path not found: {path}")
    
    if args.serve or args.dev:
        print("Starting API server...")
        if args.dev:
            print("Development mode: Auto-reload enabled")
            # Use string reference to app to enable auto-reload
            uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
        else:
            uvicorn.run(app, host="0.0.0.0", port=8000)