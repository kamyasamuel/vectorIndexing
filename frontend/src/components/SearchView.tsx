import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService, { SearchResult } from '../services/api';

const SearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Handle search form submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsSearching(true);
    setError(null);
    
    try {
      const response = await apiService.search(query, topK);
      setSearchResults(response.results);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to perform search. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4"
    >
      <h2 className="text-2xl font-bold text-secondary-900 mb-4">Semantic Search</h2>
      
      {/* Search form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              className="block w-full px-4 py-3 border border-secondary-300 rounded-md shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              disabled={isSearching}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value))}
              className="block w-24 px-3 py-3 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
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
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
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
                  <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </>
              )}
            </button>
          </div>
        </div>
      </form>
      
      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-3 mb-4 rounded-md bg-red-50 text-red-800"
        >
          {error}
        </motion.div>
      )}
      
      {/* Search results */}
      <div className="space-y-4">
        <AnimatePresence>
          {isSearching ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex justify-center py-12"
            >
              <div className="animate-pulse flex space-x-4">
                <div className="flex-1 space-y-4 py-1">
                  <div className="h-4 bg-secondary-200 rounded w-3/4"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-secondary-200 rounded"></div>
                    <div className="h-4 bg-secondary-200 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            searchResults.map((result, index) => (
              <motion.div
                key={result.id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-white p-4 rounded-lg border border-secondary-200 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-secondary-900">
                      {result.source || `Document ${result.id.substring(0, 8)}`}
                    </h3>
                    <div className="mt-1 text-sm text-secondary-700">
                      <p>{result.text}</p>
                    </div>
                    <div className="mt-2 flex items-center text-xs text-secondary-500 space-x-4">
                      {result.metadata && Object.entries(result.metadata).map(([key, value]) => (
                        <span key={key} className="flex items-center">
                          <span className="font-medium text-secondary-600 mr-1">{key}:</span>
                          <span>{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                      {(result.score * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
        
        {!isSearching && searchResults.length === 0 && query.trim() !== '' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-secondary-500"
          >
            No results found for "{query}"
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default SearchView;
