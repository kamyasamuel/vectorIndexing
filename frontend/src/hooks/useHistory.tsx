import { useState, useCallback, useEffect, createContext, useContext, ReactNode } from 'react';
import {
  HistoryEntry,
  HistoryEntryType,
  HISTORY_STORAGE_KEY,
  MAX_HISTORY_ENTRIES,
  DEFAULT_VISIBLE_COUNT,
} from '../types/history';

// Load from localStorage
const loadHistory = (): HistoryEntry[] => {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load history from localStorage:', e);
  }
  return [];
};

// Save to localStorage
const saveHistory = (entries: HistoryEntry[]) => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('Failed to save history to localStorage:', e);
  }
};

// Generate a unique ID
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
};

// Get relative time string
export const getRelativeTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

// Context
interface HistoryContextValue {
  entries: HistoryEntry[];
  addEntry: (entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => string;
  getEntries: (type?: HistoryEntryType, limit?: number) => HistoryEntry[];
  getConversation: (conversationId: string) => HistoryEntry[];
  updateEntry: (id: string, updates: Partial<HistoryEntry>) => void;
  removeEntry: (id: string) => void;
  clearHistory: (type?: HistoryEntryType) => void;
  expanded: boolean;
  toggleExpanded: () => void;
  visibleCount: number;
  setVisibleCount: (count: number) => void;
}

const HistoryContext = createContext<HistoryContextValue | null>(null);

export const HistoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory);
  const [expanded, setExpanded] = useState(false);
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);

  // Persist to localStorage on change
  useEffect(() => {
    saveHistory(entries);
  }, [entries]);

  const addEntry = useCallback((entry: Omit<HistoryEntry, 'id' | 'timestamp'>): string => {
    const id = generateId();
    const newEntry: HistoryEntry = {
      ...entry,
      id,
      timestamp: Date.now(),
    } as HistoryEntry;

    setEntries(prev => {
      const updated = [newEntry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
      return updated;
    });

    return id;
  }, []);

  const getEntries = useCallback((type?: HistoryEntryType, limit?: number): HistoryEntry[] => {
    let filtered = type ? entries.filter(e => e.type === type) : entries;
    if (limit && limit > 0) {
      filtered = filtered.slice(0, limit);
    }
    return filtered;
  }, [entries]);

  const getConversation = useCallback((conversationId: string): HistoryEntry[] => {
    return entries
      .filter(e => e.conversationId === conversationId)
      .slice(0, 20); // max 20 turns
  }, [entries]);

  const updateEntry = useCallback((id: string, updates: Partial<HistoryEntry>) => {
    setEntries(prev =>
      prev.map(e => (e.id === id ? { ...e, ...updates } : e))
    );
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const clearHistory = useCallback((type?: HistoryEntryType) => {
    if (type) {
      setEntries(prev => prev.filter(e => e.type !== type));
    } else {
      setEntries([]);
    }
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const value: HistoryContextValue = {
    entries,
    addEntry,
    getEntries,
    getConversation,
    updateEntry,
    removeEntry,
    clearHistory,
    expanded,
    toggleExpanded,
    visibleCount,
    setVisibleCount,
  };

  return (
    <HistoryContext.Provider value={value}>
      {children}
    </HistoryContext.Provider>
  );
};

export const useHistory = (): HistoryContextValue => {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistory must be used within a HistoryProvider');
  }
  return context;
};

export default useHistory;