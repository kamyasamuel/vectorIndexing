import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService, { SearchResult } from '../services/api';
import SearchResultCard from './SearchResultCard';
import DocumentViewer from './DocumentViewer';
import ViewHistory from './ViewHistory';
import { useHistory } from '../hooks/useHistory';
import { HistoryEntry } from '../types/history';

// Quick file type filters
const FILE_TYPE_OPTIONS = ['pdf', 'txt', 'docx', 'md', 'mp3'];

const SearchView: React.FC = () => {
  const { addEntry, clearHistory, getEntries } = useHistory();
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [isSearching, setIsSearching] = useState(false);
  const [, setSearchResults] = useState<SearchResult[]>([]);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [viewerDoc, setViewerDoc] = useState<{ id: string; filename: string; fileType: string } | null>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);
  
  // Load more pagination
  const resultsPerPage = 5;
  const displayedResults = allResults.slice(0, topK);
  const hasMore = allResults.length > topK;

  // Handle keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        queryInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    const startTime = performance.now();
    setIsSearching(true);
    setError(null);
    setShowSuggestions(false);
    
    try {
      // Build filters
      const filters: Record<string, any> = {};
      if (fileTypeFilter) {
        filters['file_type'] = fileTypeFilter;
      }
      
      const response = await apiService.search(query, 20, Object.keys(filters).length > 0 ? filters : undefined);
      setAllResults(response.results);
      setSearchResults(response.results.slice(0, topK));
      setSearchTime(performance.now() - startTime);
      
      // Add to history
      addEntry({
        type: 'search',
        query: query.trim(),
        topK,
        resultCount: response.results.length,
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        filterLabels: fileTypeFilter ? [`type: ${fileTypeFilter}`] : undefined,
        cachedResults: response.results,
      });
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to perform search. Please try again.');
      setAllResults([]);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = () => {
    setTopK(prev => Math.min(prev + 5, allResults.length));
  };

  const handleExport = (format: 'csv' | 'json') => {
    const results = allResults;
    if (results.length === 0) return;
    
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = ['id', 'text', 'score', 'filename', 'file_type', 'source'];
      const csvRows = [headers.join(',')];
      results.forEach(r => {
        csvRows.push([
          r.id || '',
          `"${(r.text || '').replace(/"/g, '""').substring(0, 200)}"`,
          r.score?.toFixed(3) || '',
          r.filename || r.metadata?.filename || '',
          r.file_type || r.metadata?.file_type || '',
          r.source || r.metadata?.source || '',
        ].join(','));
      });
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `search-results-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Restore history entry
  const handleRestore = useCallback((entry: HistoryEntry) => {
    if (entry.query) setQuery(entry.query);
    if (entry.topK) setTopK(entry.topK);
    if (entry.filterLabels && entry.filterLabels.length > 0) {
      const typeFilter = entry.filterLabels.find(f => f.startsWith('type:'));
      if (typeFilter) setFileTypeFilter(typeFilter.replace('type: ', ''));
    }

    // If we have cached results, render them instantly without re-fetching
    if (entry.cachedResults && Array.isArray(entry.cachedResults)) {
      setAllResults(entry.cachedResults);
      const k = entry.topK || topK;
      setSearchResults(entry.cachedResults.slice(0, k));
      return;
    }

    // Fall back: trigger a new search
    setTimeout(() => {
      if (queryInputRef.current) {
        const form = queryInputRef.current.closest('form');
        if (form) form.requestSubmit();
      }
    }, 100);
  }, [topK]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4"
    >
      <h2 className="text-lg font-bold text-secondary-900 mb-4">Semantic Search</h2>
      
      {/* Search form */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="bg-white rounded-xl border border-secondary-200 shadow-sm p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={queryInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search your documents... (Ctrl+K)"
                className="block w-full pl-9 pr-3 py-2.5 border border-secondary-300 rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                disabled={isSearching}
              />
              
              {/* Auto-suggest dropdown from history */}
              <AnimatePresence>
                {showSuggestions && !isSearching && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute z-20 left-0 right-0 mt-1 bg-white border border-secondary-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
                  >
                    {(() => {
                      const recentSearches = getEntries('search', 5);
                      if (recentSearches.length === 0) return null;
                      return (
                        <div>
                          <div className="px-3 py-1.5 text-[10px] font-medium text-secondary-400 uppercase tracking-wider border-b border-secondary-100">
                            Recent Searches
                          </div>
                          {recentSearches.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onMouseDown={() => {
                                if (entry.query) setQuery(entry.query);
                                setShowSuggestions(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-primary-50 text-xs flex items-center gap-2 border-b border-secondary-50 last:border-b-0"
                            >
                              <svg className="w-3 h-3 text-secondary-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="truncate text-secondary-700">{entry.query}</span>
                              <span className="text-[10px] text-secondary-400 flex-shrink-0 ml-auto">
                                {entry.resultCount} results
                              </span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={topK}
                onChange={(e) => setTopK(parseInt(e.target.value))}
                className="block w-20 px-2 py-2.5 border border-secondary-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-xs"
                disabled={isSearching}
              >
                {[3, 5, 10, 15, 20].map((value) => (
                  <option key={value} value={value}>
                    Top {value}
                  </option>
                ))}
              </select>
              
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
                disabled={isSearching || !query.trim()}
              >
                {isSearching ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
                  </>
                ) : (
                  <>
                    <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Inline file type filter chips */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium text-secondary-400 uppercase tracking-wider mr-1">Type:</span>
            <button
              type="button"
              onClick={() => setFileTypeFilter('')}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                fileTypeFilter === ''
                  ? 'bg-primary-100 text-primary-700'
                  : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
              }`}
            >
              All
            </button>
            {FILE_TYPE_OPTIONS.map(ft => (
              <button
                key={ft}
                type="button"
                onClick={() => setFileTypeFilter(ft === fileTypeFilter ? '' : ft)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  fileTypeFilter === ft
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-secondary-100 text-secondary-600 hover:bg-secondary-200'
                }`}
              >
                .{ft}
              </button>
            ))}
          </div>
        </div>
      </form>
      
      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </motion.div>
      )}
      
      {/* Search results */}
      <div className="space-y-3">
        <AnimatePresence>
          {isSearching ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-secondary-200 p-4 animate-pulse">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-secondary-200 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-secondary-200 rounded w-1/3" />
                      <div className="h-3 bg-secondary-100 rounded w-2/3" />
                    </div>
                    <div className="w-16 h-10 bg-secondary-100 rounded-lg" />
                  </div>
                  <div className="mt-3 h-16 bg-secondary-50 rounded-lg" />
                  <div className="mt-3 flex gap-2">
                    <div className="h-5 bg-secondary-100 rounded w-14" />
                    <div className="h-5 bg-secondary-100 rounded w-20" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            displayedResults.map((result, index) => (
              <SearchResultCard
                key={result.id || index}
                result={result}
                index={index}
                query={query}
                onViewDocument={result.document_id ? (id, filename, fileType) => setViewerDoc({ id, filename, fileType }) : undefined}
              />
            ))
          )}
        </AnimatePresence>
        
        {/* Result metadata */}
        {!isSearching && allResults.length > 0 && (
          <div className="flex items-center justify-between text-xs text-secondary-400 pt-1 pb-2">
            <div className="flex items-center gap-3">
              <span>Found {allResults.length} result{allResults.length !== 1 ? 's' : ''}</span>
              {searchTime != null && (
                <span className="text-secondary-300">({searchTime.toFixed(0)}ms)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {allResults.length > resultsPerPage && hasMore && (
                <button
                  onClick={handleLoadMore}
                  className="text-primary-600 hover:text-primary-800 font-medium transition-colors"
                >
                  Show more ({allResults.length - topK} remaining)
                </button>
              )}
              <div className="flex items-center gap-1 border-l border-secondary-200 pl-2">
                <span className="text-secondary-400 mr-1">Export</span>
                <button
                  onClick={() => handleExport('csv')}
                  className="p-1 rounded hover:bg-secondary-100 text-secondary-500 hover:text-secondary-700 transition-colors"
                  title="Export as CSV"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleExport('json')}
                  className="p-1 rounded hover:bg-secondary-100 text-secondary-500 hover:text-secondary-700 transition-colors"
                  title="Export as JSON"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* No results message */}
        {!isSearching && allResults.length === 0 && query.trim() !== '' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary-100 mb-4">
              <svg className="w-8 h-8 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-secondary-500 text-sm">No matching documents found for "<span className="font-medium">{query}</span>"</p>
            <p className="text-secondary-400 text-xs mt-1">Try different keywords, broaden your search, or adjust the file type filter</p>
          </motion.div>
        )}
        
        {/* Empty state */}
        {!isSearching && allResults.length === 0 && query.trim() === '' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary-100 mb-4">
              <svg className="w-8 h-8 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-secondary-500 text-sm">Enter a search query to find documents.</p>
            <p className="text-secondary-400 text-xs mt-1">Use <kbd className="px-1 py-0.5 bg-secondary-100 rounded text-[10px] font-mono">Ctrl+K</kbd> to quickly focus the search bar</p>
          </motion.div>
        )}
      </div>

      {/* History panel */}
      <ViewHistory
        type="search"
        onRestore={handleRestore}
        onClear={() => clearHistory('search')}
      />

      {/* Document Viewer Modal */}
      {viewerDoc && (
        <DocumentViewer
          documentId={viewerDoc.id}
          filename={viewerDoc.filename}
          fileType={viewerDoc.fileType}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </motion.div>
  );
};

export default SearchView;