import axios from 'axios';

// Create axios instance with base URL and default headers
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Important for CORS
});

// Types based on the API schema
export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, any>;
  source?: string;
}

export interface SearchResponse {
  results: SearchResult[];
}

export interface CompletionResponse {
  answer: string;
  sources: SearchResult[];
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
  
  // Question answering
  answerQuestion: async (query: string, contextWindow: number = 5): Promise<CompletionResponse> => {
    const response = await api.post('/answer', {
      query,
      context_window: contextWindow,
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
};

export default apiService;
