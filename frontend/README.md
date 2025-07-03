# Vector Indexing UI

A modern, minimalist frontend for the Vector Indexing System.

## Features

- **Modern UI**: Built with React, TypeScript, and TailwindCSS
- **Three query modes**: Semantic search, question answering, and metadata search
- **Animations**: Smooth transitions and loading animations
- **System monitoring**: Real-time system status view
- **File upload**: Drag-and-drop document indexing

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm start
   ```

3. Build for production:
   ```bash
   npm run build
   ```

## Project Structure

```
src/
├── components/              # UI components
│   ├── Header.tsx           # App header
│   ├── Sidebar.tsx          # Navigation sidebar
│   ├── SearchView.tsx       # Semantic search interface
│   ├── QuestionAnswerView.tsx # Q&A interface
│   ├── MetadataSearchView.tsx # Metadata search interface
│   ├── UploadArea.tsx       # File upload component
│   └── StatusDrawer.tsx     # System status panel
│
├── services/                # API services
│   └── api.ts               # API client
│
├── App.tsx                  # Main app component
└── index.tsx                # Entry point
```

## API Integration

The UI connects to the backend API at `http://localhost:8000/api` by default. You can change this by setting the `REACT_APP_API_URL` environment variable.
