import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService, { SearchResult } from '../services/api';

interface MetadataFilter {
  field: string;
  value: string;
}

const MetadataSearchView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<MetadataFilter[]>([{ field: '', value: '' }]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Add a new filter field
  const addFilter = () => {
    setFilters([...filters, { field: '', value: '' }]);
  };

  // Remove a filter field
  const removeFilter = (index: number) => {
    const newFilters = [...filters];
    newFilters.splice(index, 1);
    setFilters(newFilters.length ? newFilters : [{ field: '', value: '' }]);
  };

  // Update filter field
  const updateFilter = (index: number, field: string, value: string) => {
    const newFilters = [...filters];
    newFilters[index] = { field, value };
    setFilters(newFilters);
  };

  // Handle search form submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Convert filters to object format
    const filterObj: Record<string, any> = {};
    filters.forEach(filter => {
      if (filter.field && filter.value) {
        filterObj[filter.field] = filter.value;
      }
    });
    
    setIsSearching(true);
    setError(null);
    
    try {
      const response = await apiService.search(query, 5, Object.keys(filterObj).length > 0 ? filterObj : undefined);
      setSearchResults(response.results);
    } catch (err) {
      console.error('Metadata search error:', err);
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
      <h2 className="text-2xl font-bold text-secondary-900 mb-4">Metadata Search</h2>
      
      {/* Search form */}
      <form onSubmit={handleSearch} className="mb-6 bg-white p-5 rounded-lg border border-secondary-200 shadow-sm">
        <div className="mb-4">
          <label htmlFor="query" className="block text-sm font-medium text-secondary-700 mb-1">
            Search Query
          </label>
          <input
            id="query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your search query..."
            className="block w-full px-4 py-2 border border-secondary-300 rounded-md shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            disabled={isSearching}
          />
        </div>
        
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-secondary-700">
              Metadata Filters
            </label>
            <button
              type="button"
              onClick={addFilter}
              className="inline-flex items-center text-sm text-primary-600 hover:text-primary-800 focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Add Filter
            </button>
          </div>
          
          {filters.map((filter, index) => (
            <div key={index} className="flex items-center space-x-2 mb-2">
              <div className="flex-1">
                <input
                  type="text"
                  value={filter.field}
                  onChange={(e) => updateFilter(index, e.target.value, filter.value)}
                  placeholder="Field name"
                  className="block w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                  disabled={isSearching}
                />
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={filter.value}
                  onChange={(e) => updateFilter(index, filter.field, e.target.value)}
                  placeholder="Value"
                  className="block w-full px-3 py-2 border border-secondary-300 rounded-md shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
                  disabled={isSearching}
                />
              </div>
              <button
                type="button"
                onClick={() => removeFilter(index)}
                className="p-2 text-secondary-500 hover:text-secondary-700 focus:outline-none"
                disabled={filters.length === 1}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
          
          <p className="mt-1 text-xs text-secondary-500">
            Example filters: type, author, date, source, etc.
          </p>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            disabled={isSearching}
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
              'Search with Filters'
            )}
          </button>
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
      <div className="space-y-3">
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
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className="bg-white p-4 rounded-lg border border-secondary-200 shadow-sm"
              >
                <div className="flex items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-secondary-900">
                      {result.source || `Document ${result.id.substring(0, 8)}`}
                    </h3>
                    <div className="mt-1 text-sm text-secondary-700">
                      <p>{result.text}</p>
                    </div>
                    
                    {result.metadata && Object.keys(result.metadata).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(result.metadata).map(([key, value]) => (
                          <span 
                            key={key} 
                            className="inline-flex items-center rounded-md bg-secondary-100 px-2.5 py-0.5 text-xs font-medium text-secondary-800"
                          >
                            {key}: {typeof value === 'string' ? value : JSON.stringify(value)}
                          </span>
                        ))}
                      </div>
                    )}
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
        
        {!isSearching && searchResults.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-secondary-500"
          >
            {query.trim() !== '' || filters.some(f => f.field && f.value) ? (
              <div>
                <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="mt-2 text-lg">No results found for your search criteria.</p>
              </div>
            ) : (
              <div>
                <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                <p className="mt-2 text-lg">Enter search terms and metadata filters to find documents.</p>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default MetadataSearchView;
