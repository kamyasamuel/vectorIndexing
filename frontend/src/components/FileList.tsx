import React from 'react';
import { motion } from 'framer-motion';
import { IndexedFile, apiService } from '../services/api';
import FileIcon from './FileIcon';

interface FileListProps {
  folders: Record<string, IndexedFile[]>;
  expandedFolders: Record<string, boolean>;
  onToggleFolder: (folderPath: string) => void;
  onMoveDocument: (fileId: string) => void;
  onSearchWithDocument: (fileId: string) => void;
  onShowFileDetails: (fileId: string) => void;
  onViewDocument?: (fileId: string, filename: string, fileType: string) => void;
  onRenameCategory: (folderPath: string) => void;
  onDeleteCategory: (folderPath: string) => void;
}

function formatDate(dateStr: string): string {
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
}

const FileList: React.FC<FileListProps> = ({
  folders,
  expandedFolders,
  onToggleFolder,
  onMoveDocument,
  onSearchWithDocument,
  onShowFileDetails,
  onViewDocument,
  onRenameCategory,
  onDeleteCategory,
}) => {
  const sortedFolderEntries = Object.entries(folders).sort(([a], [b]) => {
    if (a === '/') return -1;
    if (b === '/') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-2">
      {sortedFolderEntries.map(([folder, files]) => {
        const sortedFiles = [...files].sort((a, b) => 
          (a.filename || '').localeCompare(b.filename || '')
        );
        
        return (
          <div key={folder} className="bg-white rounded-lg border border-secondary-200 overflow-hidden">
            {/* Folder header */}
            <div className="flex items-center group">
              <button 
                onClick={() => onToggleFolder(folder)}
                className="flex-1 flex items-center p-2.5 hover:bg-secondary-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-3.5 w-3.5 text-secondary-500 mr-1.5 transition-transform ${expandedFolders[folder] ? 'transform rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500 mr-1.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                </svg>
                <span className="text-xs font-semibold text-secondary-900 truncate">
                  {folder === "/" ? "Uncategorized" : folder.split('/').filter(Boolean).pop()}
                </span>
                <span className="ml-auto text-xs text-secondary-500 bg-secondary-100 rounded-lg px-2 py-0.5 font-medium">
                  {sortedFiles.length} file{sortedFiles.length !== 1 ? 's' : ''}
                </span>
              </button>
              
              {folder !== "/" && (
                <div className="flex-shrink-0 flex pr-2">
                  <button 
                    onClick={() => onRenameCategory(folder)}
                    className="p-1.5 rounded-md hover:bg-secondary-100 text-secondary-400 hover:text-secondary-600 transition-colors" 
                    title="Rename category"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  
                  <button 
                    onClick={() => onDeleteCategory(folder)}
                    className="p-1.5 rounded-md hover:bg-secondary-100 text-secondary-400 hover:text-red-500 transition-colors" 
                    title="Delete category"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            
            {/* Folder contents */}
            {expandedFolders[folder] && (
              <div className="border-t border-secondary-100 divide-y divide-secondary-50">
                {sortedFiles.map((file) => (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center p-2.5 hover:bg-secondary-50 transition-colors group"
                  >
                    <div className="flex-shrink-0">
                      <FileIcon fileType={file.file_type} size="md" />
                    </div>
                    <div className="ml-2.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-secondary-900 truncate">
                          {file.filename}
                        </p>
                        <span className="flex-shrink-0 text-[10px] font-medium text-secondary-500 bg-secondary-100 rounded px-1.5 py-0.5">
                          {(file.file_type || 'unknown').toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-secondary-500 mt-0.5">
                        <span>{file.file_size_formatted}</span>
                        <span className="text-secondary-300">•</span>
                        <span>{formatDate(file.date_indexed)}</span>
                        {file.title && (
                          <>
                            <span className="text-secondary-300">•</span>
                            <span className="truncate text-secondary-600">{file.title}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0 flex items-center gap-0.5">
                      {/* View button */}
                      {onViewDocument && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewDocument(file.id, file.filename, file.file_type);
                          }}
                          className="p-1.5 rounded-md hover:bg-primary-50 text-secondary-400 hover:text-primary-600 transition-colors" 
                          title="View document"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      )}
                      
                      {file.download_url && (
                        <a
                          href={apiService.resolveUrl(file.download_url)}
                          download
                          className="p-1.5 rounded-md hover:bg-primary-50 text-secondary-400 hover:text-primary-600 transition-colors"
                          title="Download file"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </a>
                      )}
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveDocument(file.id);
                        }}
                        className="p-1.5 rounded-md hover:bg-secondary-100 text-secondary-400 hover:text-secondary-600 transition-colors" 
                        title="Move to category"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                        </svg>
                      </button>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onShowFileDetails(file.id);
                        }}
                        className="p-1.5 rounded-md hover:bg-secondary-100 text-secondary-400 hover:text-secondary-600 transition-colors" 
                        title="File details"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FileList;