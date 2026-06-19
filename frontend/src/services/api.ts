import axios from 'axios';

// Create axios instance with base URL and default headers
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Important for CORS
});

// System status type
export interface SystemStatus {
  totalDocuments: number;
  vectorCount: number;
  indexSize: string;
  lastIndexed: string;
  cpuUsage: number;
  memoryUsage: number;
  uptime: string;
}

// Types based on the API schema
export interface SearchResult {
  id: string;
  text: string;
  content?: string;
  score: number;
  metadata: Record<string, any>;
  source?: string;
  document_id?: string;
  download_url?: string;
  filename?: string;
  file_type?: string;
  file_size?: number;
  page_count?: number;
  extraction_method?: string;
  chunk_index?: number;
  similarity?: number;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface CompletionResponse {
  answer: string;
  sources: SearchResult[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgenticIteration {
  query: string;
  sources: SearchResult[];
  confidence: number;
}

export interface AgenticResponse {
  answer: string;
  sources: SearchResult[];
  iterations: AgenticIteration[];
  confidence: number;
  total_iterations: number;
  compressed_history?: ChatMessage[];
}

// Types for indexed files and categories
export interface IndexedFile {
  id: string;
  filename: string;
  file_type: string;
  file_size_formatted: string;
  date_indexed: string;
  path: string;
  category: string;
  source: string;
  title?: string;
  download_url?: string;
  file_size?: number;
}

export interface Category {
  path: string;
  name: string;
  count: number;
}

// Document view response type
export interface DocumentViewResponse {
  document_id: string;
  filename: string;
  file_type: string;
  file_size: number;
  source: string;
  metadata: Record<string, any>;
  content_type: string;
  view_type: 'text' | 'pdf' | 'image' | 'audio' | 'video' | 'binary';
  is_binary: boolean;
  content?: string;
  content_base64?: string;
  extracted_text?: string;
  download_url?: string;
  image_info?: { width: number; height: number; mode: string };
  error?: string;
}

// API functions
export const apiService = {
  // Search for documents
  search: async (query: string, topK: number = 5, filters?: Record<string, any>): Promise<SearchResponse> => {
    const response = await api.post('/search', {
      query,
      top_k: topK,
      filters,
    });
    return response.data;
  },
  
  // Question answering (single-shot, legacy)
  answerQuestion: async (query: string, contextWindow: number = 5): Promise<CompletionResponse> => {
    const response = await api.post('/answer', {
      query,
      context_window: contextWindow,
    });
    return response.data;
  },

  // Agentic question answering (multi-turn, self-refining, with history)
  agenticAnswer: async (
    query: string,
    maxIterations: number = 3,
    history?: ChatMessage[],
  ): Promise<AgenticResponse> => {
    const response = await api.post('/agentic-answer', {
      query,
      max_iterations: maxIterations,
      history: history || [],
    });
    return response.data;
  },
  
  // Upload and index a file
  indexFile: async (file: File): Promise<{status: string; document_id: string; message: string}> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/index/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  // Index a URL
  indexUrl: async (url: string): Promise<{status: string; document_id?: string; message: string}> => {
    const formData = new FormData();
    formData.append('url', url);
    
    const response = await api.post('/index/url', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  // List indexed files
  getIndexedFiles: async (): Promise<IndexedFile[]> => {
    const response = await api.get('/documents');
    return response.data;
  },
  
  // List categories
  getCategories: async (): Promise<Category[]> => {
    const response = await api.get('/categories');
    return response.data;
  },
  
  // Create a new category
  createCategory: async (name: string, path: string): Promise<{status: string; message: string}> => {
    const response = await api.post('/categories', { name, path });
    return response.data;
  },
  
  // Update a category
  updateCategory: async (oldPath: string, newPath: string): Promise<{status: string; message: string}> => {
    const response = await api.put('/categories', { old_path: oldPath, new_path: newPath });
    return response.data;
  },
  
  // Move document to category
  moveDocumentToCategory: async (documentId: string, categoryPath: string): Promise<{status: string; message: string}> => {
    const response = await api.post('/documents/category', { document_id: documentId, category_path: categoryPath });
    return response.data;
  },
  
  // View a document (get content for inline display)
  viewDocument: async (documentId: string): Promise<DocumentViewResponse> => {
    const response = await api.get(`/documents/${documentId}/view`);
    return response.data;
  },
  
  // Download a document
  downloadDocument: (documentId: string): string => {
    return `${api.defaults.baseURL || 'http://localhost:8000/api'}/documents/${documentId}/download`;
  },
  
  // Get system status
  getSystemStatus: async (): Promise<SystemStatus> => {
    const response = await api.get('/status');
    return response.data;
  },
};

export default apiService;
