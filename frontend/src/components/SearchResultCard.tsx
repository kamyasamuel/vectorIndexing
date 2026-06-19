import React from 'react';
import { motion } from 'framer-motion';
import { SearchResult } from '../services/api';
import FileIcon from './FileIcon';
import apiService from '../services/api';

interface SearchResultCardProps {
  result: SearchResult;
  index: number;
  query?: string;
  onViewDocument?: (documentId: string, filename: string, fileType: string) => void;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getScoreColor(score: number): string {
  if (score >= 0.8) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (score >= 0.6) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function getScoreLabel(score: number): string {
  if (score >= 0.8) return 'High Match';
  if (score >= 0.6) return 'Medium Match';
  return 'Low Match';
}

const SearchResultCard: React.FC<SearchResultCardProps> = ({ result, index, query, onViewDocument }) => {
  const contentText = result.content || result.text || '';
  const fileType = result.file_type || (result.metadata?.file_type as string) || '';
  const filename = result.filename || (result.metadata?.filename as string) || result.source || 'Unknown';
  const pageCount = result.page_count || (result.metadata?.page_count as number);
  const extractionMethod = result.extraction_method || (result.metadata?.extraction_method as string);
  const fileSize = result.file_size || (result.metadata?.file_size as number);
  const chunkIndex = result.chunk_index ?? (result.metadata?.chunk_index as number);
  const similarity = result.score ?? result.similarity ?? 0;
  const downloadUrl = result.download_url || (result.document_id ? apiService.downloadDocument(result.document_id) : null);
  const source = result.source || (result.metadata?.source as string) || '';

  // Highlight query terms in text
  const highlightText = (text: string, query?: string): React.ReactNode => {
    if (!query || !query.trim()) return text;
    const words = query.trim().split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return text;
    
    const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 text-secondary-900 rounded-sm px-0.5">{part}</mark>
      ) : (
        part
      )
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.08 }}
      className="bg-white rounded-xl border border-secondary-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* Header row */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon fileType={fileType} size="lg" showLabel={false} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-secondary-900 truncate max-w-md">
              {highlightText(filename, query)}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-secondary-500 truncate max-w-xs">
                {source || 'No source path'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Score badge */}
        <div className={`flex-shrink-0 flex flex-col items-center px-2.5 py-1 rounded-lg border ${getScoreColor(similarity)}`}>
          <span className="text-sm font-bold leading-tight">
            {(similarity * 100).toFixed(1)}%
          </span>
          <span className="text-[10px] font-medium leading-tight opacity-75">
            {getScoreLabel(similarity)}
          </span>
        </div>
      </div>
      
      {/* Content snippet with query highlighting */}
      <div className="px-4 pb-2">
        <div className="bg-secondary-50 rounded-lg p-3 border border-secondary-100">
          <p className="text-xs text-secondary-700 leading-relaxed line-clamp-3">
            {highlightText(contentText, query)}
          </p>
        </div>
      </div>
      
      {/* Metadata badges row */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
        {fileType && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary-100 text-secondary-600">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {fileType.toUpperCase()}
          </span>
        )}
        {fileSize > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary-100 text-secondary-600">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            {formatFileSize(fileSize)}
          </span>
        )}
        {pageCount != null && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary-100 text-secondary-600">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {pageCount} {pageCount === 1 ? 'page' : 'pages'}
          </span>
        )}
        {extractionMethod && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-secondary-100 text-secondary-600">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {extractionMethod}
          </span>
        )}
        {chunkIndex != null && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-purple-100 text-purple-700">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Chunk #{chunkIndex}
          </span>
        )}
      </div>
      
      {/* Actions row */}
      <div className="px-4 pb-3 flex items-center justify-between border-t border-secondary-100 pt-2.5">
        <div className="flex items-center gap-2">
          {downloadUrl && (
            <a
              href={downloadUrl}
              download
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download
            </a>
          )}
          
          {/* View button */}
          {result.document_id && (
            <button
              onClick={() => onViewDocument && onViewDocument(result.document_id!, filename, fileType)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-secondary-700 bg-secondary-50 hover:bg-secondary-100 transition-colors"
              title="View document"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View
            </button>
          )}
        </div>
        
        {result.document_id && (
          <span className="text-[10px] text-secondary-400 font-mono">
            ID: {result.document_id.substring(0, 8)}...
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default SearchResultCard;