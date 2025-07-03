import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import apiService from '../services/api';

const UploadArea: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lastUploadResult, setLastUploadResult] = useState<{success: boolean; message: string} | null>(null);
  const [urlInput, setUrlInput] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Handle file drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFile(e.dataTransfer.files[0]);
    }
  };
  
  // Handle file selection via input
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFile(e.target.files[0]);
    }
  };
  
  // Upload file to API
  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setLastUploadResult(null);
    
    try {
      const response = await apiService.indexFile(file);
      
      setLastUploadResult({
        success: response.status === 'success',
        message: response.message,
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      setLastUploadResult({
        success: false,
        message: 'Error uploading file. Please try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Handle URL indexing
  const handleUrlIndex = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    
    setIsUploading(true);
    setLastUploadResult(null);
    
    try {
      const response = await apiService.indexUrl(urlInput);
      
      setLastUploadResult({
        success: response.status === 'success',
        message: response.message,
      });
      
      // Clear input on success
      if (response.status === 'success') {
        setUrlInput('');
      }
    } catch (error) {
      console.error('Error indexing URL:', error);
      setLastUploadResult({
        success: false,
        message: 'Error indexing URL. Please try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mb-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div 
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
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
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.docx,.txt,.mp3,.wav"
          />
          
          <div className="flex flex-col items-center justify-center space-y-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-10 w-10 ${isDragging ? 'text-primary-500' : 'text-secondary-400'}`} 
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
            
            <div className="text-secondary-900 font-medium">
              {isUploading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </div>
              ) : (
                <>Drag files here or click to upload</>
              )}
            </div>
            <p className="text-secondary-500 text-sm">
              Supports PDF, DOCX, TXT, and audio files
            </p>
          </div>
        </div>
        
        {/* URL input for web content indexing */}
        <div className="mt-4">
          <form onSubmit={handleUrlIndex} className="flex">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter a URL to index web content"
              className="flex-1 min-w-0 block w-full px-3 py-2 border border-secondary-300 rounded-l-md shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              disabled={isUploading}
            />
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              disabled={isUploading || !urlInput.trim()}
            >
              Index URL
            </button>
          </form>
        </div>
        
        {/* Upload result message */}
        {lastUploadResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className={`mt-3 p-3 rounded-md ${
              lastUploadResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {lastUploadResult.message}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default UploadArea;
