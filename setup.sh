#!/bin/bash

# Vector Indexing System setup script
echo "Setting up Vector Indexing System..."

# Set up Python environment
echo "Setting up Python backend..."
python -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Set up frontend
echo "Setting up React frontend..."
cd frontend
npm install

echo "Setup complete!"
echo ""
echo "To start the system:"
echo "1. Start the backend API server:"
echo "   source venv/bin/activate"
echo "   python main.py --serve"
echo ""
echo "2. In another terminal, start the frontend:"
echo "   cd frontend"
echo "   npm start"
echo ""
echo "The UI will be available at http://localhost:3001"
echo "The API will be available at http://localhost:8000/api"
echo "API Documentation will be available at http://localhost:8000/docs"
