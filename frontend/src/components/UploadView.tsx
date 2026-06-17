import React from 'react';
import { motion } from 'framer-motion';
import UploadArea from './UploadArea';

const UploadView: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-secondary-900">Upload Documents</h1>
        <p className="mt-2 text-secondary-600">
          Upload files to index them for search and question answering.
          You can drag and drop files, click to browse, or provide a URL.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <UploadArea />
        
        <div className="mt-8">
          <h2 className="text-lg font-medium text-secondary-900">Supported File Types</h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { type: 'PDF', icon: '📄', description: 'Text extraction with OCR fallback' },
              { type: 'DOCX', icon: '📝', description: 'Microsoft Word documents' },
              { type: 'TXT', icon: '📄', description: 'Plain text files' },
              { type: 'MD', icon: '📑', description: 'Markdown files' },
              { type: 'Audio', icon: '🔊', description: 'MP3, WAV, etc. (with transcript)' },
              { type: 'URL', icon: '🌐', description: 'Web pages and articles' },
            ].map((item) => (
              <div key={item.type} className="bg-secondary-50 p-4 rounded-md">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{item.icon}</span>
                  <div>
                    <h3 className="font-medium text-secondary-900">{item.type}</h3>
                    <p className="text-sm text-secondary-500">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-8 bg-primary-50 p-4 rounded-md border border-primary-200">
          <h3 className="font-medium text-primary-800">Pro Tips</h3>
          <ul className="mt-2 text-sm text-primary-700 space-y-1">
            <li className="flex items-start">
              <svg className="h-5 w-5 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              For best results, ensure PDFs are searchable (not scanned images without OCR)
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Large files are automatically split into smaller chunks for better search results
            </li>
            <li className="flex items-start">
              <svg className="h-5 w-5 text-primary-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Audio files require a working connection to the transcription service
            </li>
          </ul>
        </div>
      </div>
    </motion.div>
  );
};

export default UploadView;
