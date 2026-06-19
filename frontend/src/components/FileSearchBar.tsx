import React from 'react';

interface FileSearchBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onClear: () => void;
  resultCount: number;
}

const FileSearchBar: React.FC<FileSearchBarProps> = ({
  searchTerm,
  onSearchChange,
  onClear,
  resultCount,
}) => {
  return (
    <div className="mt-2">
      <div className="relative rounded-md">
        <input
          type="text"
          className="block w-full pl-8 p-1.5 border text-xs border-secondary-300 rounded-md focus:ring-primary-500 focus:border-primary-500 bg-secondary-50"
          placeholder="Search files by name..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        {searchTerm && (
          <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
            <button 
              onClick={onClear}
              className="text-secondary-400 hover:text-secondary-600 focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
      
      {searchTerm && (
        <div className="mt-1 text-xs text-secondary-500">
          Found {resultCount} {resultCount === 1 ? 'file' : 'files'} matching "{searchTerm}"
        </div>
      )}
    </div>
  );
};

export default FileSearchBar;