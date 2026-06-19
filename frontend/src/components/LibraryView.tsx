import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import apiService, { IndexedFile } from '../services/api';
import FileIcon from './FileIcon';
import DocumentViewer from './DocumentViewer';

const LibraryView: React.FC = () => {
  const [files, setFiles] = useState<IndexedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewerDoc, setViewerDoc] = useState<{ id: string; filename: string; fileType: string } | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      setIsLoading(true);
      try {
        const data = await apiService.getIndexedFiles();
        setFiles(data);
      } catch (error) {
        console.error('Error fetching files:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFiles();
  }, []);

  const filteredFiles = files.filter(file =>
    (file.filename || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (file.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (file.file_type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string): string => {
    if (!dateStr || dateStr === 'Unknown') return '';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      if (days === 0) return 'Today';
      if (days === 1) return 'Yesterday';
      if (days < 7) return `${days}d ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-secondary-900">Document Library</h1>
        <p className="mt-1 text-sm text-secondary-600">
          Browse and view all indexed documents
        </p>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search files by name, type, or title..."
            className="w-full pl-10 pr-10 py-2.5 border border-secondary-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary-400 hover:text-secondary-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {!isLoading && (
          <p className="mt-2 text-xs text-secondary-500">
            {filteredFiles.length} of {files.length} files
          </p>
        )}
      </div>

      {/* File grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-secondary-200 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary-200 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-secondary-200 rounded w-3/4" />
                  <div className="h-2 bg-secondary-100 rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-secondary-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-secondary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <p className="mt-3 text-sm text-secondary-600">
            {searchTerm ? 'No files match your search' : 'No files have been indexed yet'}
          </p>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="mt-2 text-sm text-primary-600 hover:text-primary-500 font-medium">
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFiles.map((file) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg border border-secondary-200 hover:border-primary-300 hover:shadow-sm transition-all group"
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <FileIcon fileType={file.file_type} size="lg" />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-secondary-900 truncate" title={file.filename}>
                      {file.filename}
                    </h3>
                    {file.title && (
                      <p className="text-xs text-secondary-600 truncate mt-0.5" title={file.title}>
                        {file.title}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-secondary-500">
                      <span className="font-medium bg-secondary-100 rounded px-1.5 py-0.5">
                        {(file.file_type || 'unknown').toUpperCase()}
                      </span>
                      <span>{file.file_size_formatted}</span>
                      <span className="text-secondary-300">•</span>
                      <span>{formatDate(file.date_indexed)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-secondary-100 px-4 py-2.5 flex items-center gap-2">
                <button
                  onClick={() => setViewerDoc({ id: file.id, filename: file.filename, fileType: file.file_type })}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  View
                </button>
                {file.download_url && (
                  <a
                    href={file.download_url}
                    download
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-secondary-700 bg-secondary-50 hover:bg-secondary-100 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

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

export default LibraryView;