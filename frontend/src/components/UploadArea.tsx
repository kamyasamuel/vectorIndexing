import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService from '../services/api';
import { useHistory } from '../hooks/useHistory';

interface UploadItem {
  id: string;
  file?: File;
  url?: string;
  type: 'file' | 'url';
  filename: string;
  status: 'pending' | 'uploading' | 'success' | 'failed';
  message: string;
  progress: number; // 0-100
}

const UploadArea: React.FC = () => {
  const { addEntry } = useHistory();
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Generate unique ID for upload items
  const generateId = () => `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Handle file drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      addFilesToQueue(files);
    }
  };
  
  // Handle file selection via input
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      addFilesToQueue(files);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  const handleFileSelectClick = () => {
    fileInputRef.current?.click();
  };
  
  // Track uploaded items by ID for async access
  const itemsRef = useRef<Map<string, UploadItem>>(new Map());

  // Add files to queue
  const addFilesToQueue = (files: File[]) => {
    const newItems: UploadItem[] = files.map(file => ({
      id: generateId(),
      file,
      type: 'file',
      filename: file.name,
      status: 'pending' as const,
      message: '',
      progress: 0,
    }));
    
    newItems.forEach(item => itemsRef.current.set(item.id, item));
    setUploadQueue(prev => [...prev, ...newItems]);
    
    // Start uploading each file
    newItems.forEach(item => processUpload(item));
  };

  // Add URL to queue
  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    
    const newItem: UploadItem = {
      id: generateId(),
      url: urlInput.trim(),
      type: 'url',
      filename: urlInput.trim().substring(0, 60) + (urlInput.trim().length > 60 ? '...' : ''),
      status: 'pending',
      message: '',
      progress: 0,
    };
    
    itemsRef.current.set(newItem.id, newItem);
    setUploadQueue(prev => [...prev, newItem]);
    setUrlInput('');
    
    processUpload(newItem);
  };
  
  // Process a single upload
  const processUpload = async (item: UploadItem) => {
    setUploadQueue(prev => prev.map(i => 
      i.id === item.id ? { ...i, status: 'uploading', progress: 10, message: 'Processing...' } : i
    ));
    
    const itemId = item.id;
    const currentItem = item;
    
    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadQueue(prev => prev.map(i => 
          i.id === itemId && i.status === 'uploading'
            ? { ...i, progress: Math.min(i.progress + 5, 90) }
            : i
        ));
      }, 300);

      let response: { status: string; document_id?: string; message: string };
      if (currentItem.type === 'file' && currentItem.file) {
        response = await apiService.indexFile(currentItem.file);
      } else if (currentItem.type === 'url' && currentItem.url) {
        response = await apiService.indexUrl(currentItem.url);
      } else {
        throw new Error('Invalid upload item');
      }
      
      clearInterval(progressInterval);
      
      const success = response.status === 'success';
      
      setUploadQueue(prev => prev.map(i => 
        i.id === itemId
          ? {
              ...i,
              status: success ? 'success' : 'failed',
              progress: 100,
              message: response.message,
            }
          : i
      ));
      
      // Add to history
      const fileType = currentItem.type === 'file' 
        ? (currentItem.file?.name.split('.').pop() || 'unknown') 
        : 'url';
      addEntry({
        type: 'upload',
        filename: currentItem.filename,
        fileType,
        uploadStatus: success ? 'success' : 'failed',
        uploadMessage: response.message,
      });
      
    } catch (error: any) {
      console.error('Error uploading:', error);
      setUploadQueue(prev => prev.map(i => 
        i.id === itemId
          ? {
              ...i,
              status: 'failed',
              progress: 100,
              message: error?.message || 'Error uploading. Please try again.',
            }
          : i
      ));
      
      // Add to history as failed
      addEntry({
        type: 'upload',
        filename: currentItem.filename || 'Unknown',
        uploadStatus: 'failed',
        uploadMessage: error?.message || 'Error uploading',
      });
    }
  };
  
  // Remove an item from the queue
  const removeFromQueue = (itemId: string) => {
    setUploadQueue(prev => prev.filter(item => item.id !== itemId));
  };
  
  // Clear completed items
  const clearCompleted = () => {
    setUploadQueue(prev => prev.filter(item => item.status === 'pending' || item.status === 'uploading'));
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="w-4 h-4 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'uploading':
        return (
          <svg className="animate-spin w-4 h-4 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      case 'success':
        return (
          <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  return (
    <div className="mb-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div 
          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
            isDragging 
              ? 'border-primary-500 bg-primary-50' 
              : 'border-secondary-300 hover:border-primary-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={handleFileSelectClick}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.docx,.txt,.md,.mp3,.wav"
            multiple
          />
          
          <div className="flex flex-col items-center justify-center space-y-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-8 w-8 ${isDragging ? 'text-primary-500' : 'text-secondary-400'}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1.5} 
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" 
              />
            </svg>
            
            <div className="text-secondary-900 text-sm font-medium">
              Drag files here or click to upload
            </div>
            <p className="text-secondary-500 text-xs">
              Supports PDF, DOCX, TXT, MD, and audio files (multiple files allowed)
            </p>
          </div>
        </div>
        
        {/* URL input for web content indexing */}
        <div className="mt-3">
          <form onSubmit={handleUrlSubmit} className="flex">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter a URL to index web content"
              className="flex-1 min-w-0 block w-full px-2 py-1.5 border border-secondary-300 rounded-l-md shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm"
              disabled={uploadQueue.some(item => item.status === 'uploading')}
            />
            <button
              type="submit"
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-r-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              disabled={uploadQueue.some(item => item.status === 'uploading') || !urlInput.trim()}
            >
              Index URL
            </button>
          </form>
        </div>
        
        {/* Upload queue */}
        <AnimatePresence>
          {uploadQueue.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-secondary-700">
                  Upload Queue ({uploadQueue.length})
                </h3>
                <div className="flex items-center gap-2">
                  {uploadQueue.some(item => item.status === 'success' || item.status === 'failed') && (
                    <button
                      onClick={clearCompleted}
                      className="text-[10px] text-secondary-500 hover:text-secondary-700 transition-colors"
                    >
                      Clear completed
                    </button>
                  )}
                </div>
              </div>
              
              {uploadQueue.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0 }}
                  className={`bg-white rounded-lg border p-2.5 shadow-sm ${
                    item.status === 'success' ? 'border-green-200' :
                    item.status === 'failed' ? 'border-red-200' :
                    item.status === 'uploading' ? 'border-primary-200' :
                    'border-secondary-200'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 mt-0.5">
                      {getStatusIcon(item.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-secondary-800 truncate">
                          {item.filename}
                        </span>
                        <span className="text-[10px] text-secondary-400 flex-shrink-0">
                          {item.type === 'url' ? 'URL' : item.file?.size ? `${(item.file.size / 1024).toFixed(0)} KB` : ''}
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      {(item.status === 'uploading' || item.status === 'pending') && (
                        <div className="mt-1.5 w-full bg-secondary-100 rounded-full h-1.5 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${item.progress}%` }}
                            transition={{ duration: 0.3 }}
                            className="h-full bg-primary-500 rounded-full"
                          />
                        </div>
                      )}
                      
                      {/* Status message */}
                      {(item.status === 'success' || item.status === 'failed') && item.message && (
                        <p className={`mt-1 text-[10px] ${
                          item.status === 'success' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {item.message}
                        </p>
                      )}
                      
                      {/* Progress percentage */}
                      {item.status === 'uploading' && (
                        <p className="mt-0.5 text-[10px] text-primary-500 font-medium">
                          {item.progress}% uploaded
                        </p>
                      )}
                    </div>
                    
                    <button
                      onClick={() => removeFromQueue(item.id)}
                      className="flex-shrink-0 p-0.5 text-secondary-400 hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default UploadArea;