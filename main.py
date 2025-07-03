import argparse
from fastapi import FastAPI
import uvicorn

from app.core.indexer import DocumentIndexer
from app.api.controllers import router

app = FastAPI(title="Textual Data Indexer API")
app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Textual Data Indexer API is running"}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Textual Data Indexer")
    parser.add_argument("--index", help="Index a file or directory")
    parser.add_argument("--serve", action="store_true", help="Start the API server")
    
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
    
    if args.serve:
        print("Starting API server...")
        uvicorn.run(app, host="0.0.0.0", port=8000)