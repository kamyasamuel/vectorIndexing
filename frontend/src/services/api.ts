import axios from 'axios';

// Create axios instance with base URL and default headers
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Important for CORS
});

// Add auth token to all requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

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

// ─── RAG Evaluation Types ───────────────────────────────────────

export interface EvaluationRequest {
  query: string;
  answer: string;
  contexts: Record<string, any>[];
  relevant_chunk_ids?: string[];
}

export interface EvaluationResult {
  overall_score: number;
  metrics: {
    faithfulness: { score: number; total_claims: number; supported_claims: number; unsupported_claims: number; details: any[] };
    relevance: { score: number; responsiveness: number; completeness: number; focus: number; strengths: string[]; weaknesses: string[] };
    context_precision: { precision: number; relevant_count: number; total_count: number; judgments: any[] };
    context_recall: { recall: number; retrieved_relevant: number; total_relevant: number | string; method: string };
  };
  summary: Record<string, string>;
  total_time: number;
}

// ─── Collection Types ──────────────────────────────────────────

export interface Collection {
  id: string;
  name: string;
  description: string;
  owner_id: string;
  document_count: number;
  document_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface CollectionShare {
  collection_id: string;
  shared_with_user_id: string;
  permission: string;
  shared_by_user_id: string;
  shared_at: string;
}

// ─── Transcription Types ────────────────────────────────────────

export interface TranscriptionResult {
  status: string;
  text: string;
  segments: { start: number; end: number; text: string }[];
  duration_seconds: number;
  detected_language: string;
  word_count: number;
  metadata: Record<string, any>;
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
  
  // Resolve a possibly-relative download URL to an absolute URL
  resolveUrl: (url: string): string => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const base = api.defaults.baseURL || 'http://localhost:8000/api';
    // If url starts with /api/, strip that since base already has /api
    if (url.startsWith('/api/')) {
      return `${base}${url.replace('/api', '')}`;
    }
    return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
  },

  // Download a document
  downloadDocument: (documentId: string, inline: boolean = false): string => {
    const base = api.defaults.baseURL || 'http://localhost:8000/api';
    return `${base}/documents/${documentId}/download${inline ? '?inline=true' : ''}`;
  },
  
  // Get system status
  getSystemStatus: async (): Promise<SystemStatus> => {
    const response = await api.get('/status');
    return response.data;
  },

  // ─── Hybrid Search ────────────────────────────────────────────
  hybridSearch: async (
    query: string,
    topK: number = 5,
    mode: 'hybrid' | 'semantic' | 'keyword' = 'hybrid',
    filters?: Record<string, any>,
  ): Promise<SearchResponse> => {
    const response = await api.post('/hybrid-search', {
      query,
      top_k: topK,
      mode,
      filters,
    });
    return response.data;
  },

  // ─── RAG Evaluation ───────────────────────────────────────────
  evaluateRag: async (request: EvaluationRequest): Promise<EvaluationResult> => {
    const response = await api.post('/evaluate', request);
    return response.data;
  },

  evaluateBatch: async (examples: EvaluationRequest[]): Promise<{ results: EvaluationResult[]; summary: Record<string, number>; count: number }> => {
    const response = await api.post('/evaluate/batch', { examples });
    return response.data;
  },

  // ─── Collections ──────────────────────────────────────────────
  createCollection: async (name: string, description: string = ''): Promise<{ status: string; collection: Collection }> => {
    const response = await api.post('/collections', { name, description });
    return response.data;
  },

  getCollections: async (): Promise<Collection[]> => {
    const response = await api.get('/collections');
    return response.data;
  },

  getCollection: async (collectionId: string): Promise<Collection> => {
    const response = await api.get(`/collections/${collectionId}`);
    return response.data;
  },

  updateCollection: async (collectionId: string, name?: string, description?: string): Promise<{ status: string; collection: Collection }> => {
    const response = await api.put(`/collections/${collectionId}`, { name, description });
    return response.data;
  },

  deleteCollection: async (collectionId: string): Promise<{ status: string; message: string }> => {
    const response = await api.delete(`/collections/${collectionId}`);
    return response.data;
  },

  addDocumentsToCollection: async (collectionId: string, documentIds: string[]): Promise<{ status: string; collection: Collection }> => {
    const response = await api.post('/collections/documents/add', { collection_id: collectionId, document_ids: documentIds });
    return response.data;
  },

  removeDocumentsFromCollection: async (collectionId: string, documentIds: string[]): Promise<{ status: string; collection: Collection }> => {
    const response = await api.post('/collections/documents/remove', { collection_id: collectionId, document_ids: documentIds });
    return response.data;
  },

  reorderCollection: async (collectionId: string, documentIds: string[]): Promise<{ status: string; collection: Collection }> => {
    const response = await api.put('/collections/documents/reorder', { collection_id: collectionId, document_ids: documentIds });
    return response.data;
  },

  shareCollection: async (collectionId: string, sharedWithUserId: string, permission: string = 'read'): Promise<{ status: string; share: CollectionShare }> => {
    const response = await api.post('/collections/share', { collection_id: collectionId, shared_with_user_id: sharedWithUserId, permission });
    return response.data;
  },

  revokeCollectionShare: async (collectionId: string, sharedWithUserId: string): Promise<{ status: string; message: string }> => {
    const response = await api.post('/collections/revoke', { collection_id: collectionId, shared_with_user_id: sharedWithUserId });
    return response.data;
  },

  getCollectionShares: async (collectionId: string): Promise<{ shares: CollectionShare[] }> => {
    const response = await api.get(`/collections/${collectionId}/shares`);
    return response.data;
  },

  // ─── Audio Transcription ─────────────────────────────────────
  transcribeAudio: async (file: File, language?: string): Promise<TranscriptionResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (language) formData.append('language', language);

    const response = await api.post('/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // ─── Auth ──────────────────────────────────────────────────────
  login: async (username: string, password: string): Promise<any> => {
    const response = await api.post('/auth/login', { username, password });
    if (response.data.access_token) {
      localStorage.setItem('auth_token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  register: async (username: string, email: string, password: string, fullName?: string): Promise<any> => {
    const response = await api.post('/auth/register', {
      username,
      email,
      password,
      full_name: fullName || '',
    });
    if (response.data.access_token) {
      localStorage.setItem('auth_token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  getMe: async (): Promise<any> => {
    const token = localStorage.getItem('auth_token');
    if (!token) throw new Error('Not authenticated');
    const response = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  },

  logout: (): void => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('auth_token');
  },

  // ─── Providers Info ───────────────────────────────────────────
  getProviders: async (): Promise<Record<string, Record<string, string>>> => {
    const response = await api.get('/providers');
    return response.data;
  },

  // ─── App Config ───────────────────────────────────────────────
  getConfig: async (): Promise<{
    ollama_base_url: string;
    embedding_model: string;
    completion_model: string;
    vector_db_path: string;
    metadata_db_path: string;
    upload_dir: string;
    chunk_size: number;
    chunk_overlap: number;
    data_size_bytes: number;
  }> => {
    const response = await api.get('/config');
    return response.data;
  },
};

export default apiService;
