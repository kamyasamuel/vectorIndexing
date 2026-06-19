import React, { useState, useEffect, useCallback } from 'react';
import apiService, { DocumentViewResponse } from '../services/api';
import FileIcon from './FileIcon';

interface DocumentViewerProps {
  documentId: string;
  filename: string;
  fileType: string;
  onClose: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({
  documentId,
  filename,
  fileType,
  onClose,
}) => {
  const [documentData, setDocumentData] = useState<DocumentViewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'view' | 'extracted' | 'info'>('view');

  useEffect(() => {
    const fetchDocument = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiService.viewDocument(documentId);
        setDocumentData(data);
      } catch (err: any) {
        setError(err?.response?.data?.detail || err?.message || 'Failed to load document');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDocument();
  }, [documentId]);

  const renderTextView = useCallback(() => {
    if (!documentData?.content) return null;
    
    // Detect if content is markdown-like
    const isMarkdown = /^#|##|###|\*\*|__|\[.*\]\(.*\)|`/m.test(documentData.content);
    const fileExt = documentData.filename?.split('.').pop()?.toLowerCase();
    const isCode = ['py', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'json', 'xml', 'yaml', 'yml', 'sh', 'bash'].includes(fileExt || '');
    
    if (isCode) {
      return (
        <pre className="text-sm font-mono text-secondary-800 p-4 bg-secondary-50 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
          <code>{documentData.content}</code>
        </pre>
      );
    }
    
    if (isMarkdown) {
      // Simple markdown-like rendering: split by double newlines for paragraphs
      const paragraphs = documentData.content.split(/\n\n+/);
      return (
        <div className="prose prose-sm max-w-none text-secondary-800">
          {paragraphs.map((para, i) => {
            // Headings
            if (para.startsWith('### ')) return <h3 key={i} className="text-base font-semibold mt-3 mb-1">{para.slice(4)}</h3>;
            if (para.startsWith('## ')) return <h2 key={i} className="text-lg font-semibold mt-4 mb-2">{para.slice(3)}</h2>;
            if (para.startsWith('# ')) return <h1 key={i} className="text-xl font-bold mt-4 mb-2">{para.slice(2)}</h1>;
            // Code blocks
            if (para.startsWith('```') && para.endsWith('```')) {
              const code = para.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
              return <pre key={i} className="text-sm font-mono bg-secondary-50 p-3 rounded-lg overflow-x-auto my-2 whitespace-pre-wrap">{code}</pre>;
            }
            // Regular paragraph
            return <p key={i} className="mb-2 leading-relaxed">{para}</p>;
          })}
        </div>
      );
    }
    
    // Plain text
    return (
      <div className="text-sm text-secondary-800 whitespace-pre-wrap font-sans leading-relaxed">
        {documentData.content}
      </div>
    );
  }, [documentData]);

  const renderPDFView = useCallback(() => {
    const downloadUrl = documentData?.download_url || apiService.downloadDocument(documentId);
    return (
      <div className="w-full h-full flex flex-col">
        <div className="flex-1 min-h-0">
          <iframe
            src={downloadUrl}
            className="w-full h-full rounded-lg border border-secondary-200"
            title={filename}
            style={{ minHeight: '60vh' }}
          />
        </div>
        <div className="mt-2 text-xs text-secondary-500 text-center">
          <a
            href={downloadUrl}
            download
            className="text-primary-600 hover:text-primary-500 font-medium underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in new tab
          </a>
          {' · '}
          <a
            href={downloadUrl}
            download
            className="text-primary-600 hover:text-primary-500 font-medium underline"
          >
            Download
          </a>
        </div>
      </div>
    );
  }, [documentData, documentId, filename]);

  const renderImageView = useCallback(() => {
    const imageUrl = documentData?.content_base64
      ? `data:${documentData.content_type || 'image/png'};base64,${documentData.content_base64}`
      : documentData?.download_url || apiService.downloadDocument(documentId);

    const imgInfo = documentData?.image_info;
    
    return (
      <div className="flex flex-col items-center">
        <div className="max-w-full overflow-auto rounded-lg border border-secondary-200 bg-secondary-50 p-2">
          <img
            src={imageUrl}
            alt={filename}
            className="max-w-full h-auto object-contain"
            style={{ maxHeight: '70vh' }}
          />
        </div>
        {imgInfo && (
          <div className="mt-3 flex gap-4 text-xs text-secondary-600">
            <span className="bg-secondary-100 px-2 py-1 rounded">Dimensions: {imgInfo.width} × {imgInfo.height}px</span>
            <span className="bg-secondary-100 px-2 py-1 rounded">Mode: {imgInfo.mode}</span>
          </div>
        )}
        <div className="mt-2 text-xs text-secondary-500">
          <a
            href={documentData?.download_url || apiService.downloadDocument(documentId)}
            download
            className="text-primary-600 hover:text-primary-500 font-medium underline"
          >
            Download image
          </a>
        </div>
      </div>
    );
  }, [documentData, filename, documentId]);

  const renderAudioView = useCallback(() => {
    const audioUrl = documentData?.content_base64
      ? `data:${documentData.content_type || 'audio/mpeg'};base64,${documentData.content_base64}`
      : documentData?.download_url || apiService.downloadDocument(documentId);

    return (
      <div className="flex flex-col items-center py-8">
        <div className="w-full max-w-md bg-secondary-50 rounded-lg p-6 border border-secondary-200">
          <div className="flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm font-medium text-secondary-700 text-center mb-4">{filename}</p>
          <audio
            controls
            className="w-full"
            src={audioUrl}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
        <div className="mt-2 text-xs text-secondary-500">
          <a
            href={documentData?.download_url || apiService.downloadDocument(documentId)}
            download
            className="text-primary-600 hover:text-primary-500 font-medium underline"
          >
            Download audio file
          </a>
        </div>
      </div>
    );
  }, [documentData, filename, documentId]);

  const renderVideoView = useCallback(() => {
    const videoUrl = documentData?.content_base64
      ? `data:${documentData.content_type || 'video/mp4'};base64,${documentData.content_base64}`
      : documentData?.download_url || apiService.downloadDocument(documentId);

    return (
      <div className="flex flex-col items-center py-4">
        <div className="w-full max-w-2xl bg-secondary-50 rounded-lg p-4 border border-secondary-200">
          <p className="text-sm font-medium text-secondary-700 mb-3">{filename}</p>
          <video
            controls
            className="w-full rounded-lg"
            style={{ maxHeight: '60vh' }}
            src={videoUrl}
          >
            Your browser does not support the video element.
          </video>
        </div>
        <div className="mt-2 text-xs text-secondary-500">
          <a
            href={documentData?.download_url || apiService.downloadDocument(documentId)}
            download
            className="text-primary-600 hover:text-primary-500 font-medium underline"
          >
            Download video file
          </a>
        </div>
      </div>
    );
  }, [documentData, filename, documentId]);

  const renderBinaryView = useCallback(() => {
    const downloadUrl = documentData?.download_url || apiService.downloadDocument(documentId);
    return (
      <div className="flex flex-col items-center py-12">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-secondary-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        <p className="text-sm text-secondary-600 mb-2">
          This file type cannot be previewed inline.
        </p>
        {documentData?.error && (
          <p className="text-xs text-red-500 mb-3">{documentData.error}</p>
        )}
        <a
          href={downloadUrl}
          download
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download File
        </a>
      </div>
    );
  }, [documentData, documentId]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mb-4"></div>
          <p className="text-sm text-secondary-500">Loading document...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <p className="text-sm text-red-600 font-medium mb-1">Failed to load document</p>
          <p className="text-xs text-secondary-500">{error}</p>
          <button
            onClick={onClose}
            className="mt-4 text-sm text-primary-600 hover:text-primary-500 font-medium"
          >
            Go back
          </button>
        </div>
      );
    }

    if (!documentData) return null;

    const viewType = documentData.view_type;
    const hasExtractedText = !!documentData.extracted_text;

    return (
      <div className="flex flex-col h-full">
        {/* Tabs for PDF with extracted text */}
        {(viewType === 'pdf' && hasExtractedText) && (
          <div className="flex gap-1 mb-3 border-b border-secondary-200">
            <button
              onClick={() => setTab('view')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
                tab === 'view'
                  ? 'bg-white text-primary-700 border border-secondary-200 border-b-white -mb-px'
                  : 'text-secondary-500 hover:text-secondary-700'
              }`}
            >
              Document View
            </button>
            <button
              onClick={() => setTab('extracted')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
                tab === 'extracted'
                  ? 'bg-white text-primary-700 border border-secondary-200 border-b-white -mb-px'
                  : 'text-secondary-500 hover:text-secondary-700'
              }`}
            >
              Extracted Text
            </button>
            <button
              onClick={() => setTab('info')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors ${
                tab === 'info'
                  ? 'bg-white text-primary-700 border border-secondary-200 border-b-white -mb-px'
                  : 'text-secondary-500 hover:text-secondary-700'
              }`}
            >
              Info
            </button>
          </div>
        )}

        {/* Content based on active tab */}
        <div className="flex-1 overflow-y-auto">
          {tab === 'info' || (viewType !== 'pdf' && viewType !== 'image') ? (
            <div className="space-y-3">
              {/* File info card for all types */}
              {tab === 'info' && (
                <div className="bg-secondary-50 rounded-lg p-3 border border-secondary-200">
                  <h4 className="text-xs font-semibold text-secondary-700 uppercase mb-2">File Information</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <span className="text-secondary-500">Filename:</span>
                    <span className="text-secondary-800 font-medium truncate">{documentData.filename}</span>
                    <span className="text-secondary-500">Type:</span>
                    <span className="text-secondary-800 font-medium uppercase">{documentData.file_type}</span>
                    <span className="text-secondary-500">Size:</span>
                    <span className="text-secondary-800 font-medium">{formatFileSize(documentData.file_size)}</span>
                    <span className="text-secondary-500">Content Type:</span>
                    <span className="text-secondary-800 font-medium truncate">{documentData.content_type}</span>
                    {documentData.image_info && (
                      <>
                        <span className="text-secondary-500">Dimensions:</span>
                        <span className="text-secondary-800 font-medium">{documentData.image_info.width} × {documentData.image_info.height}px</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Main content */}
              {(viewType === 'text' || tab === 'extracted') && (
                <div className="bg-white rounded-lg border border-secondary-200">
                  {(viewType === 'text' && tab !== 'extracted') ? renderTextView() : null}
                  {tab === 'extracted' && documentData.extracted_text && (
                    <div className="text-sm text-secondary-800 whitespace-pre-wrap font-sans leading-relaxed p-4">
                      {documentData.extracted_text}
                    </div>
                  )}
                </div>
              )}
              
              {viewType === 'pdf' && tab === 'view' && renderPDFView()}
              {viewType === 'image' && renderImageView()}
              {viewType === 'audio' && renderAudioView()}
              {viewType === 'video' && renderVideoView()}
              {viewType === 'binary' && renderBinaryView()}
            </div>
          ) : (
            <>
              {viewType === 'pdf' && renderPDFView()}
              {viewType === 'image' && renderImageView()}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl border border-secondary-200 w-[95vw] max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-200 bg-secondary-50 rounded-t-xl">
          <div className="flex items-center gap-2 min-w-0">
            <FileIcon fileType={fileType} size="sm" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-secondary-900 truncate max-w-md">
                {filename}
              </h3>
              <span className="text-[11px] text-secondary-500 uppercase">{fileType}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Download button */}
            {documentData?.download_url && (
              <a
                href={documentData.download_url}
                download
                className="p-2 rounded-md hover:bg-secondary-200 text-secondary-500 hover:text-secondary-700 transition-colors"
                title="Download file"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </a>
            )}
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-secondary-200 text-secondary-500 hover:text-secondary-700 transition-colors"
              title="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default DocumentViewer;