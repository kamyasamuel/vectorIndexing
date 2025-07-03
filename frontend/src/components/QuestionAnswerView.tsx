import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService, { SearchResult } from '../services/api';

const QuestionAnswerView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [contextWindow, setContextWindow] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Handle question submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setAnswer(null);
    setSources([]);
    
    try {
      const response = await apiService.answerQuestion(query, contextWindow);
      setAnswer(response.answer);
      setSources(response.sources || []);
    } catch (err) {
      console.error('Q&A error:', err);
      setError('Failed to generate an answer. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4"
    >
      <h2 className="text-2xl font-bold text-secondary-900 mb-4">Question & Answer</h2>
      
      {/* Question form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question..."
              className="block w-full px-4 py-3 border border-secondary-300 rounded-md shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              disabled={isLoading}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={contextWindow}
              onChange={(e) => setContextWindow(parseInt(e.target.value))}
              className="block w-24 px-3 py-3 border border-secondary-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              disabled={isLoading}
            >
              {[3, 5, 8, 10].map((value) => (
                <option key={value} value={value}>
                  Context: {value}
                </option>
              ))}
            </select>
            
            <button
              type="submit"
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Thinking...
                </>
              ) : (
                'Ask Question'
              )}
            </button>
          </div>
        </div>
      </form>
      
      {/* Error message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-3 mb-4 rounded-md bg-red-50 text-red-800"
        >
          {error}
        </motion.div>
      )}
      
      {/* Loading animation */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-4 mb-6"
          >
            <div className="bg-white p-4 rounded-lg border border-secondary-200 shadow-sm">
              <div className="flex space-x-3 items-center">
                <div className="animate-pulse flex space-x-4 w-full">
                  <div className="flex-1 space-y-3">
                    <div className="h-2 bg-secondary-200 rounded w-3/4"></div>
                    <div className="h-2 bg-secondary-200 rounded"></div>
                    <div className="h-2 bg-secondary-200 rounded"></div>
                    <div className="h-2 bg-secondary-200 rounded w-5/6"></div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Answer display */}
      {answer && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="bg-white p-5 rounded-lg border border-secondary-200 shadow">
            <h3 className="text-lg font-medium text-secondary-900 mb-2">Answer:</h3>
            <div className="prose prose-blue max-w-none">
              <p className="whitespace-pre-line">{answer}</p>
            </div>
          </div>
        </motion.div>
      )}
      
      {/* Sources */}
      {sources.length > 0 && !isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-medium text-secondary-900 mb-3">Sources:</h3>
          <div className="space-y-3">
            {sources.map((source, index) => (
              <motion.div
                key={source.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="bg-secondary-50 p-3 rounded-md border border-secondary-200"
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium mr-3">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-secondary-700">{source.text}</p>
                    {source.metadata?.source && (
                      <p className="mt-1 text-xs text-secondary-500">
                        Source: {source.metadata.source}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
      
      {/* Empty state */}
      {!isLoading && !answer && !error && (
        <div className="text-center py-10 text-secondary-500">
          <svg className="mx-auto h-12 w-12 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-2 text-lg">Ask a question to get an answer based on the indexed documents.</p>
        </div>
      )}
    </motion.div>
  );
};

export default QuestionAnswerView;
