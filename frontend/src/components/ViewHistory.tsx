import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHistory, getRelativeTime } from '../hooks/useHistory';
import { HistoryEntry, HistoryEntryType } from '../types/history';

interface ViewHistoryProps {
  type: HistoryEntryType;
  title?: string;
  icon?: React.ReactNode;
  onRestore?: (entry: HistoryEntry) => void;
  onClear?: () => void;
  renderExtra?: (entry: HistoryEntry) => React.ReactNode;
  children?: React.ReactNode;
}

// Map types to icon SVGs
const typeIcons: Record<HistoryEntryType, React.ReactNode> = {
  search: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  qa: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  metadata: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  upload: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
};

const typeColors: Record<HistoryEntryType, string> = {
  search: 'text-blue-600',
  qa: 'text-purple-600',
  metadata: 'text-teal-600',
  upload: 'text-amber-600',
};

const typeBgColors: Record<HistoryEntryType, string> = {
  search: 'bg-blue-50',
  qa: 'bg-purple-50',
  metadata: 'bg-teal-50',
  upload: 'bg-amber-50',
};

const ViewHistory: React.FC<ViewHistoryProps> = ({
  type,
  title,
  icon,
  onRestore,
  onClear,
  renderExtra,
  children,
}) => {
  const { getEntries, expanded, toggleExpanded, visibleCount, removeEntry, clearHistory } = useHistory();
  const [isOpen, setIsOpen] = React.useState(false);

  const allEntries = getEntries(type);
  const displayEntries = expanded ? allEntries : allEntries.slice(0, visibleCount);
  const hasMore = allEntries.length > visibleCount;

  const handleRestore = (entry: HistoryEntry) => {
    if (onRestore) {
      onRestore(entry);
    }
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      clearHistory(type);
    }
  };
  if (allEntries.length === 0) return null;

  return (
    <div className="mt-6 border-t border-secondary-200 pt-4">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-medium text-secondary-600 hover:text-secondary-900 transition-colors"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {icon || typeIcons[type]}
          {title || `${type.charAt(0).toUpperCase() + type.slice(1)} History`}
          <span className="text-secondary-400 font-normal">({allEntries.length})</span>
        </button>

        <button
          onClick={handleClear}
          className="text-[10px] text-secondary-400 hover:text-red-500 transition-colors"
          title="Clear history"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {displayEntries.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`group flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors hover:bg-secondary-100 ${typeBgColors[type]} bg-opacity-30`}
                  onClick={() => handleRestore(entry)}
                >
                  <div className={`flex-shrink-0 mt-0.5 ${typeColors[type]}`}>
                    {typeIcons[type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-secondary-800 truncate">
                        {entry.query || entry.filename || 'Unknown'}
                      </span>
                      <span className="text-[10px] text-secondary-400 flex-shrink-0">
                        {getRelativeTime(entry.timestamp)}
                      </span>
                    </div>
                    <div className="text-[10px] text-secondary-500 mt-0.5 flex items-center gap-2">
                      {entry.resultCount != null && (
                        <span>{entry.resultCount} result{entry.resultCount !== 1 ? 's' : ''}</span>
                      )}
                      {entry.filterLabels && entry.filterLabels.length > 0 && (
                        <span>{entry.filterLabels.length} filter{entry.filterLabels.length !== 1 ? 's' : ''}</span>
                      )}
                      {entry.uploadStatus && (
                        <span className={
                          entry.uploadStatus === 'success' ? 'text-green-600' :
                          entry.uploadStatus === 'failed' ? 'text-red-600' :
                          'text-amber-600'
                        }>
                          {entry.uploadStatus}
                        </span>
                      )}
                      {renderExtra && renderExtra(entry)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeEntry(entry.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-0.5 text-secondary-400 hover:text-red-500 transition-all"
                    title="Remove"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </motion.div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-2 text-center">
                <button
                  onClick={toggleExpanded}
                  className="text-[11px] text-primary-600 hover:text-primary-800 font-medium transition-colors"
                >
                  {expanded
                    ? `Show less`
                    : `View all ${allEntries.length} entries`
                  }
                </button>
              </div>
            )}

            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ViewHistory;