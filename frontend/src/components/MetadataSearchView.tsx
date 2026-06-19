import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService, { SearchResult } from '../services/api';
import SearchResultCard from './SearchResultCard';
import ViewHistory from './ViewHistory';
import { useHistory } from '../hooks/useHistory';
import { HistoryEntry } from '../types/history';

interface MetadataFilter {
  field: string;
  value: string;
}

interface FilterPreset {
  id: string;
  name: string;
  filters: MetadataFilter[];
  operators: string[];
}

const PRESETS_STORAGE_KEY = 'vectorIndexing_filterPresets';

// Known metadata fields with their types and example values
const KNOWN_FIELDS: Record<string, { type: string; examples: string[]; description: string }> = {
  'file_type': { type: 'string', examples: ['pdf', 'txt', 'docx', 'md', 'mp3'], description: 'File extension (lowercase)' },
  'filename': { type: 'string', examples: ['report.pdf', 'notes.txt'], description: 'Original filename' },
  'page_count': { type: 'number', examples: ['5', '10', '42'], description: 'Number of pages' },
  'file_size': { type: 'number', examples: ['1024', '51200'], description: 'File size in bytes' },
  'extraction_method': { type: 'string', examples: ['pdfminer', 'tesseract', 'docx'], description: 'Text extraction method' },
  'tags': { type: 'tag', examples: ['important', 'draft', 'final'], description: 'Document tags' },
  'category': { type: 'string', examples: ['reports', 'invoices'], description: 'Document category' },
  'title': { type: 'string', examples: ['Annual Report'], description: 'Document title' },
  'date_indexed': { type: 'date', examples: ['2024-01-01', '2024-12-31'], description: 'Index date (YYYY-MM-DD)' },
};

// Operators available for filter fields
const FILTER_OPERATORS: { value: string; label: string }[] = [
  { value: '', label: 'matches exactly' },
  { value: '__icontains', label: 'contains (case-insensitive)' },
  { value: '__iexact', label: 'is exactly (case-insensitive)' },
  { value: '__gt', label: 'greater than (numeric/date)' },
  { value: '__lt', label: 'less than (numeric/date)' },
];

const TAG_EXAMPLES = ['important', 'draft', 'final', 'archive', 'confidential', 'reviewed'];

// Tag colors for visual distinction
const TAG_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
];

// Load filter presets from localStorage
const loadPresets = (): FilterPreset[] => {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save filter presets to localStorage
const savePresets = (presets: FilterPreset[]) => {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // ignore
  }
};

const MetadataSearchView: React.FC = () => {
  const { addEntry, clearHistory } = useHistory();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<MetadataFilter[]>([{ field: '', value: '' }]);
  const [filterOperators, setFilterOperators] = useState<string[]>(['']);
  const [filterLogic, setFilterLogic] = useState<'AND' | 'OR'>('AND');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showFieldSuggestions, setShowFieldSuggestions] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [presets, setPresets] = useState<FilterPreset[]>(loadPresets);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  const addFilter = () => {
    setFilters([...filters, { field: '', value: '' }]);
    setFilterOperators([...filterOperators, '']);
  };

  const removeFilter = (index: number) => {
    const newFilters = [...filters];
    newFilters.splice(index, 1);
    setFilters(newFilters.length ? newFilters : [{ field: '', value: '' }]);
    
    const newOperators = [...filterOperators];
    newOperators.splice(index, 1);
    setFilterOperators(newOperators.length ? newOperators : ['']);
  };

  const updateFilter = useCallback((index: number, field: string, value: string) => {
    const newFilters = [...filters];
    newFilters[index] = { field, value };
    setFilters(newFilters);
  }, [filters]);

  const updateFilterOperator = (index: number, operator: string) => {
    const newOperators = [...filterOperators];
    newOperators[index] = operator;
    setFilterOperators(newOperators);
  };

  const applySuggestion = (index: number, field: string) => {
    const newFilters = [...filters];
    newFilters[index] = { field, value: '' };
    setFilters(newFilters);
    setShowFieldSuggestions(null);
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Save current filter as a preset
  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName.trim(),
      filters: filters.filter(f => f.field && f.value),
      operators: filterOperators,
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    savePresets(updated);
    setPresetName('');
    setShowSavePreset(false);
  };

  const handleApplyPreset = (preset: FilterPreset) => {
    setFilters(preset.filters.length > 0 ? preset.filters : [{ field: '', value: '' }]);
    setFilterOperators(preset.operators);
  };

  const handleDeletePreset = (presetId: string) => {
    const updated = presets.filter(p => p.id !== presetId);
    setPresets(updated);
    savePresets(updated);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const filterObj: Record<string, any> = {};
    const activeFilterLabels: string[] = [];
    
    // Build filter object from text filters
    filters.forEach((filter, index) => {
      if (filter.field && filter.value) {
        const operator = filterOperators[index] || '';
        filterObj[`${filter.field}${operator}`] = filter.value;
        activeFilterLabels.push(`${filter.field}: ${filter.value}`);
      }
    });
    
    // Add tag filters
    if (selectedTags.length > 0) {
      filterObj['tags'] = selectedTags;
      activeFilterLabels.push(`tags: ${selectedTags.join(', ')}`);
    }
    
    // Add date range filters
    if (dateRange.start) {
      filterObj['date_indexed__gte'] = dateRange.start;
      activeFilterLabels.push(`from: ${dateRange.start}`);
    }
    if (dateRange.end) {
      filterObj['date_indexed__lte'] = dateRange.end;
      activeFilterLabels.push(`to: ${dateRange.end}`);
    }
    
    setIsSearching(true);
    setError(null);
    
    try {
      const response = await apiService.search(query, 5, Object.keys(filterObj).length > 0 ? filterObj : undefined);
      setSearchResults(response.results);
      
      // Add to history with cached results
      addEntry({
        type: 'metadata',
        query: query.trim() || undefined,
        filters: Object.keys(filterObj).length > 0 ? filterObj : undefined,
        filterLabels: activeFilterLabels.length > 0 ? activeFilterLabels : undefined,
        resultCount: response.results.length,
        cachedResults: response.results,
      });
    } catch (err) {
      console.error('Metadata search error:', err);
      setError('Failed to perform search. Please try again.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setFilters([{ field: '', value: '' }]);
    setFilterOperators(['']);
    setSelectedTags([]);
    setDateRange({ start: '', end: '' });
  };

  // Remove a single active filter badge
  const removeFilterBadge = (label: string) => {
    // Remove from text filters
    const idx = filters.findIndex(f => `${f.field}: ${f.value}` === label);
    if (idx >= 0) {
      removeFilter(idx);
    }
    // Handle tags
    if (label.startsWith('tags:')) {
      setSelectedTags([]);
    }
    if (label.startsWith('from:')) setDateRange(prev => ({ ...prev, start: '' }));
    if (label.startsWith('to:')) setDateRange(prev => ({ ...prev, end: '' }));
  };

  // Restore history entry
  const handleRestore = useCallback((entry: HistoryEntry) => {
    if (entry.query) setQuery(entry.query);

    // If we have cached results, render them instantly without re-fetching
    if (entry.cachedResults && Array.isArray(entry.cachedResults)) {
      setSearchResults(entry.cachedResults);
      return;
    }

    // Try to restore known patterns from labels (fallback)
    if (entry.filterLabels && entry.filterLabels.length > 0) {
      entry.filterLabels.forEach(label => {
        if (label.startsWith('type:')) {
          const ft = label.replace('type: ', '');
          updateFilter(0, 'file_type', ft);
        }
      });
    }
  }, [updateFilter]);

  // Build list of active filter badges for display
  const activeFilterBadges: string[] = [];
  filters.forEach((f, i) => {
    if (f.field && f.value) {
      activeFilterBadges.push(`${f.field}: ${f.value}`);
    }
  });
  if (selectedTags.length > 0) activeFilterBadges.push(`tags: ${selectedTags.join(', ')}`);
  if (dateRange.start) activeFilterBadges.push(`from: ${dateRange.start}`);
  if (dateRange.end) activeFilterBadges.push(`to: ${dateRange.end}`);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4"
    >
      <h2 className="text-lg font-bold text-secondary-900 mb-4">Metadata Search</h2>
      
      {/* Search form */}
      <form onSubmit={handleSearch} className="mb-6 bg-white rounded-xl border border-secondary-200 shadow-sm p-4">
        <div className="mb-3">
          <label htmlFor="mds-query" className="block text-xs font-medium text-secondary-700 mb-1.5">
            Search Query
          </label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              id="mds-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter your search query..."
              className="block w-full pl-9 pr-3 py-2 border border-secondary-300 rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              disabled={isSearching}
            />
          </div>
        </div>

        {/* Active filter badges */}
        {activeFilterBadges.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="text-[10px] font-medium text-secondary-400 self-center tracking-wider">Active filters:</span>
            {activeFilterBadges.map((badge, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 text-primary-700 border border-primary-200"
              >
                {badge}
                <button
                  type="button"
                  onClick={() => removeFilterBadge(badge)}
                  className="text-primary-400 hover:text-primary-700"
                >
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
            {activeFilterBadges.length > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[10px] text-red-500 hover:text-red-700 font-medium ml-1"
              >
                Clear all
              </button>
            )}
          </div>
        )}
        
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-secondary-700">
              Metadata Filters
            </label>
            <div className="flex items-center gap-2">
              {/* AND/OR toggle */}
              <div className="flex items-center gap-1 text-[10px]">
                <span className="text-secondary-400">Logic:</span>
                <button
                  type="button"
                  onClick={() => setFilterLogic('AND')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    filterLogic === 'AND'
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-secondary-500 hover:bg-secondary-100'
                  }`}
                >
                  AND
                </button>
                <button
                  type="button"
                  onClick={() => setFilterLogic('OR')}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    filterLogic === 'OR'
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-secondary-500 hover:bg-secondary-100'
                  }`}
                >
                  OR
                </button>
              </div>
              <span className="text-secondary-300">|</span>
              <button
                type="button"
                onClick={addFilter}
                className="inline-flex items-center text-xs text-primary-600 hover:text-primary-800 font-medium focus:outline-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Add Filter
              </button>
            </div>
          </div>
          
          {filters.map((filter, index) => {
            const knownField = KNOWN_FIELDS[filter.field];
            return (
              <div key={index} className="space-y-1.5 mb-3">
                <div className="flex items-stretch space-x-2">
                  {/* Field name input with suggestions */}
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={filter.field}
                      onChange={(e) => {
                        updateFilter(index, e.target.value, filter.value);
                        setShowFieldSuggestions(index);
                      }}
                      onFocus={() => setShowFieldSuggestions(index)}
                      onBlur={() => setTimeout(() => setShowFieldSuggestions(null), 200)}
                      placeholder="Field name (e.g. file_type)"
                      className="block w-full px-2.5 py-1.5 border border-secondary-300 rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-xs"
                      disabled={isSearching}
                    />
                    
                    {/* Field suggestion dropdown */}
                    {showFieldSuggestions === index && filter.field && (
                      <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-secondary-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {Object.entries(KNOWN_FIELDS)
                          .filter(([key]) => key.includes(filter.field.toLowerCase()))
                          .map(([key, info]) => (
                            <button
                              key={key}
                              type="button"
                              onMouseDown={() => applySuggestion(index, key)}
                              className="w-full text-left px-3 py-2 hover:bg-primary-50 border-b border-secondary-100 last:border-b-0 text-xs"
                            >
                              <span className="font-medium text-secondary-800">{key}</span>
                              <span className="text-secondary-400 ml-1">— {info.description}</span>
                            </button>
                          ))}
                        {Object.entries(KNOWN_FIELDS).filter(([key]) =>
                          key.includes(filter.field.toLowerCase())
                        ).length === 0 && (
                          <div className="px-3 py-2 text-xs text-secondary-400">
                            No matching fields. You can type any custom field name.
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Field type hint */}
                    {knownField && (
                      <div className="mt-1 text-[10px] text-secondary-400 pl-1">
                        {knownField.type === 'number' ? 'numeric field' : knownField.type === 'date' ? 'date field (YYYY-MM-DD)' : knownField.type === 'tag' ? 'tag field' : 'text field'}
                        {knownField.examples.length > 0 && (
                          <span> — e.g. <span className="font-mono text-secondary-500">{knownField.examples[0]}</span></span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Operator selector */}
                  <div className="flex-shrink-0">
                    <select
                      value={filterOperators[index] || ''}
                      onChange={(e) => updateFilterOperator(index, e.target.value)}
                      className="px-2 py-1.5 border border-secondary-300 rounded-lg shadow-sm text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      disabled={isSearching}
                    >
                      {FILTER_OPERATORS.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  {/* Value input */}
                  <div className="flex-[2]">
                    <input
                      type={knownField?.type === 'number' ? 'number' : knownField?.type === 'date' ? 'date' : 'text'}
                      value={filter.value}
                      onChange={(e) => updateFilter(index, filter.field, e.target.value)}
                      placeholder={knownField ? `e.g. ${knownField.examples[0]}` : "Value"}
                      className="block w-full px-2.5 py-1.5 border border-secondary-300 rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-xs"
                      disabled={isSearching}
                    />
                  </div>
                  
                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeFilter(index)}
                    className="p-1.5 text-secondary-400 hover:text-red-500 focus:outline-none transition-colors self-start mt-0.5"
                    disabled={filters.length === 1}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
          
          {/* Quick field chips */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-[10px] text-secondary-400 mr-1 self-center">Quick fields:</span>
            {Object.entries(KNOWN_FIELDS).map(([field, info]) => (
              <button
                key={field}
                type="button"
                onClick={() => {
                  const emptyIndex = filters.findIndex(f => !f.field);
                  if (emptyIndex >= 0) {
                    updateFilter(emptyIndex, field, '');
                  } else {
                    setFilters([...filters, { field, value: '' }]);
                    setFilterOperators([...filterOperators, '']);
                  }
                }}
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-secondary-100 text-secondary-600 hover:bg-primary-100 hover:text-primary-700 transition-colors cursor-pointer"
                title={info.description}
              >
                {field}
                <svg className="w-3 h-3 ml-0.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            ))}
          </div>

          {/* Date range picker */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[10px] font-medium text-secondary-500 uppercase tracking-wider">Date Range:</span>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="block w-40 px-2 py-1 border border-secondary-300 rounded-md shadow-sm text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={isSearching}
            />
            <span className="text-[10px] text-secondary-400">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="block w-40 px-2 py-1 border border-secondary-300 rounded-md shadow-sm text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={isSearching}
            />
          </div>

          {/* Tag chip selector */}
          <div className="mt-3">
            <span className="text-[10px] font-medium text-secondary-500 uppercase tracking-wider block mb-1.5">Tags:</span>
            <div className="flex flex-wrap gap-1.5">
              {TAG_EXAMPLES.map((tag, idx) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagToggle(tag)}
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                    selectedTags.includes(tag)
                      ? TAG_COLORS[idx % TAG_COLORS.length] + ' ring-1 ring-offset-1 ring-primary-300'
                      : 'bg-white text-secondary-500 border-secondary-200 hover:border-secondary-300'
                  }`}
                >
                  {selectedTags.includes(tag) && (
                    <svg className="w-2.5 h-2.5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Filter presets */}
          {presets.length > 0 && (
            <div className="mt-3">
              <span className="text-[10px] font-medium text-secondary-500 uppercase tracking-wider block mb-1.5">Saved Presets:</span>
              <div className="flex flex-wrap gap-1">
                {presets.map(preset => (
                  <div key={preset.id} className="group inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="px-2 py-0.5 rounded-l text-[10px] font-medium bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition-colors"
                      title={preset.filters.map(f => `${f.field}: ${f.value}`).join(', ')}
                    >
                      {preset.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(preset.id)}
                      className="px-1 py-0.5 rounded-r text-[10px] font-medium bg-teal-50 text-teal-400 border border-l-0 border-teal-200 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowSavePreset(!showSavePreset)}
            className="inline-flex items-center text-xs text-secondary-500 hover:text-primary-600 font-medium transition-colors"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            Save as Preset
          </button>

          {showSavePreset && (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Preset name..."
                className="px-2 py-1 border border-secondary-300 rounded text-[10px] w-32 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                className="px-2 py-1 text-[10px] font-medium bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
                disabled={!presetName.trim()}
              >
                Save
              </button>
            </div>
          )}
          
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors ml-auto"
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
              <>
                <svg className="mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search with Filters
              </>
            )}
          </button>
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
            searchResults.map((result, index) => (
              <SearchResultCard
                key={result.id || index}
                result={result}
                index={index}
                query={query}
              />
            ))
          )}
        </AnimatePresence>
        
        {!isSearching && searchResults.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-secondary-100 mb-4">
              <svg className="w-8 h-8 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            {query.trim() !== '' || activeFilterBadges.length > 0 ? (
              <div>
                <p className="text-secondary-500 text-sm">No matching documents found for your search criteria.</p>
                <p className="text-secondary-400 text-xs mt-1">Try adjusting your filters or search terms</p>
              </div>
            ) : (
              <div>
                <p className="text-secondary-500 text-sm">Enter search terms and metadata filters to find documents.</p>
                <p className="text-secondary-400 text-xs mt-1">Use filters like <span className="font-medium">file_type: pdf</span> or <span className="font-medium">page_count: 10</span></p>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* History panel */}
      <ViewHistory
        type="metadata"
        title="Search History"
        onRestore={handleRestore}
        onClear={() => clearHistory('metadata')}
        renderExtra={(entry) => (
          <>
            {entry.filterLabels && entry.filterLabels.length > 0 && (
              <span className="text-secondary-400">
                {entry.filterLabels.length} filter{entry.filterLabels.length !== 1 ? 's' : ''}
              </span>
            )}
          </>
        )}
      />
    </motion.div>
  );
};

export default MetadataSearchView;