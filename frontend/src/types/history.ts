export type HistoryEntryType = 'search' | 'qa' | 'metadata' | 'upload';

export interface HistoryEntry {
  id: string;
  type: HistoryEntryType;
  timestamp: number;
  // Common fields
  query?: string;
  resultCount?: number;
  // Search-specific
  topK?: number;
  // QA-specific
  contextWindow?: number;
  answer?: string;
  answerPreview?: string;
  sources?: { filename: string; score?: number }[];
  conversationId?: string;
  followUpSuggestions?: string[];
  feedback?: 'up' | 'down' | null;
  // Metadata-specific
  filters?: Record<string, any>;
  filterLabels?: string[];
  // Upload-specific
  filename?: string;
  fileType?: string;
  uploadStatus?: 'success' | 'failed' | 'pending';
  uploadMessage?: string;
  // Cached response data for instant restore without re-fetching
  cachedResults?: any;
}

export const HISTORY_STORAGE_KEY = 'vectorIndexing_history';
export const MAX_HISTORY_ENTRIES = 50;
export const DEFAULT_VISIBLE_COUNT = 5;