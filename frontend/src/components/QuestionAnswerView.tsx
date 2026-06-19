import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService, { SearchResult, AgenticIteration, ChatMessage } from '../services/api';
import ViewHistory from './ViewHistory';
import { useHistory } from '../hooks/useHistory';
import { HistoryEntry } from '../types/history';
import FormattedText from './FormattedText';

interface QAMessage {
  id: string;
  role: 'user' | 'assistant';
  query?: string;
  answer?: string;
  sources?: SearchResult[];
  isLoading?: boolean;
  feedback?: 'up' | 'down' | null;
  followUpSuggestions?: string[];
  timestamp?: number;
  // Agentic-specific fields
  iterations?: AgenticIteration[];
  confidence?: number;
  totalIterations?: number;
  compressedHistory?: ChatMessage[];
}

const QuestionAnswerView: React.FC = () => {
  const { addEntry, updateEntry, clearHistory } = useHistory();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<QAMessage[]>([]);
  const [query, setQuery] = useState('');
  const [maxIterations, setMaxIterations] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentIteration, setCurrentIteration] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (inputRef.current) {
          const form = inputRef.current.closest('form');
          if (form) form.requestSubmit();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Scroll to bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentIteration]);

  // Stream/typewriter effect for answer display
  const [displayedAnswers, setDisplayedAnswers] = useState<Record<string, string>>({});
  
  useEffect(() => {
    const currentIds = new Set(messages.map(m => m.id));
    setDisplayedAnswers(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(id => {
        if (!currentIds.has(id)) delete updated[id];
      });
      return updated;
    });
  }, [messages]);

  const typewriterAnimation = useCallback((messageId: string, fullText: string, speed: number = 15) => {
    let index = 0;
    setDisplayedAnswers(prev => ({ ...prev, [messageId]: '' }));
    
    const interval = setInterval(() => {
      index++;
      if (index <= fullText.length) {
        setDisplayedAnswers(prev => ({ ...prev, [messageId]: fullText.substring(0, index) }));
      } else {
        clearInterval(interval);
      }
    }, speed);
    
    return () => clearInterval(interval);
  }, []);

  // Get confidence color and label
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) {
      return { label: 'High confidence', color: 'bg-green-100 text-green-800 border-green-200' };
    } else if (confidence >= 0.6) {
      return { label: 'Medium confidence', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    }
    return { label: 'Low confidence', color: 'bg-red-100 text-red-800 border-red-200' };
  };

  // Generate follow-up suggestions based on the agent's iterations
  const generateFollowUps = (iterations?: AgenticIteration[], query?: string): string[] => {
    if (iterations && iterations.length > 1) {
      // Use the refinement pattern to suggest related queries
      const queries = iterations.map(i => i.query);
      const suggestions: string[] = [];
      
      if (queries.length >= 2) {
        suggestions.push(`Tell me more about: ${queries[queries.length - 1]}`);
      }
      suggestions.push('Can you provide more specific details?');
      suggestions.push('Summarize the key findings');
      
      return suggestions.slice(0, 3);
    }
    return [
      'Can you elaborate on that?',
      'What are the key takeaways?',
      'How does this compare to other findings?',
    ];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    
    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;
    const currentConversationId = conversationId || `conv-${Date.now()}`;
    
    if (!conversationId) {
      setConversationId(currentConversationId);
    }
    
    const currentQuery = query.trim();
    setQuery('');
    setError(null);
    setCurrentIteration(1);
    
    // Add user message
    const userMsg: QAMessage = {
      id: userMessageId,
      role: 'user',
      query: currentQuery,
      timestamp: Date.now(),
    };
    
    // Add loading assistant message
    const loadingMsg: QAMessage = {
      id: assistantMessageId,
      role: 'assistant',
      isLoading: true,
      sources: [],
    };
    
    setMessages(prev => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    try {
      // Build conversation history from previous messages
      const history: ChatMessage[] = [];
      // Only include messages from *before* this submit (not the loading state)
      const previousMessages = messages.filter(
        m => !m.id.startsWith('assistant-') || !m.isLoading
      );
      for (const msg of previousMessages) {
        if (msg.role === 'user' && msg.query) {
          history.push({ role: 'user', content: msg.query });
        } else if (msg.role === 'assistant' && msg.answer) {
          history.push({ role: 'assistant', content: msg.answer });
        }
      }

      // Call the agentic endpoint with conversation history
      const response = await apiService.agenticAnswer(currentQuery, maxIterations, history);
      
      // Replace loading message with answer
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? {
              ...msg,
              answer: response.answer,
              sources: response.sources || [],
              iterations: response.iterations || [],
              confidence: response.confidence,
              totalIterations: response.total_iterations,
              compressedHistory: response.compressed_history,
              isLoading: false,
              timestamp: Date.now(),
              followUpSuggestions: generateFollowUps(response.iterations, currentQuery),
            }
          : msg
      ));
      
      // Start typewriter animation
      typewriterAnimation(assistantMessageId, response.answer);
      
      // Add to history with conversation context and cached response
      const historyId = addEntry({
        type: 'qa',
        query: currentQuery,
        answer: response.answer,
        answerPreview: response.answer.substring(0, 150) + (response.answer.length > 150 ? '...' : ''),
        sources: (response.sources || []).map(s => ({ 
          filename: s.filename || s.metadata?.filename || s.source || 'Unknown',
          score: s.score 
        })),
        contextWindow: maxIterations,
        conversationId: currentConversationId,
        resultCount: (response.sources || []).length,
        cachedResults: {
          answer: response.answer,
          sources: response.sources || [],
          iterations: response.iterations || [],
          confidence: response.confidence,
          total_iterations: response.total_iterations,
          compressed_history: response.compressed_history,
          followUpSuggestions: generateFollowUps(response.iterations, currentQuery),
        },
      });
      
      setCurrentIteration(0);
      
      // Store the history entry ID for feedback updates later
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId
          ? { ...msg, id: historyId }
          : msg
      ));
      
    } catch (err) {
      console.error('Agentic Q&A error:', err);
      setError('Failed to generate an answer. Please try again.');
      // Remove loading message
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = (messageId: string, feedback: 'up' | 'down') => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId
        ? { ...msg, feedback: msg.feedback === feedback ? null : feedback }
        : msg
    ));
    updateEntry(messageId, { feedback });
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleFollowUp = (suggestion: string) => {
    setQuery(suggestion);
    setTimeout(() => {
      if (inputRef.current) {
        const form = inputRef.current.closest('form');
        if (form) form.requestSubmit();
      }
    }, 100);
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    setDisplayedAnswers({});
    setError(null);
  };

  // Restore a history entry from cache or re-submit
  const handleRestore = useCallback((entry: HistoryEntry) => {
    if (!entry.query) return;

    // If we have cached results, restore the entire conversation state instantly
    if (entry.cachedResults) {
      const cached = entry.cachedResults;
      const userMessageId = `restored-user-${entry.id}`;
      const assistantMessageId = entry.id;

      setQuery('');
      if (entry.contextWindow) setMaxIterations(entry.contextWindow);

      const restoredMessages: QAMessage[] = [
        {
          id: userMessageId,
          role: 'user',
          query: entry.query,
          timestamp: entry.timestamp,
        },
        {
          id: assistantMessageId,
          role: 'assistant',
          answer: cached.answer,
          sources: cached.sources || [],
          iterations: cached.iterations || [],
          confidence: cached.confidence,
          totalIterations: cached.total_iterations,
          compressedHistory: cached.compressed_history,
          followUpSuggestions: cached.followUpSuggestions,
          feedback: entry.feedback || null,
          timestamp: entry.timestamp,
          isLoading: false,
        },
      ];

      setMessages(restoredMessages);
      setConversationId(entry.conversationId || null);

      // Show full answer immediately via typewriter effect
      typewriterAnimation(assistantMessageId, cached.answer);
      return;
    }

    // Fall back: fill query and re-submit
    setQuery(entry.query);
    if (entry.contextWindow) setMaxIterations(entry.contextWindow);
    setTimeout(() => {
      if (inputRef.current) {
        const form = inputRef.current.closest('form');
        if (form) form.requestSubmit();
      }
    }, 100);
  }, [typewriterAnimation]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-secondary-900">Deep Research Q&A</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium border border-primary-200">
            Agentic
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleNewConversation}
            className="inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md text-secondary-600 bg-secondary-100 hover:bg-secondary-200 transition-colors"
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Conversation
          </button>
        )}
      </div>
      
      {/* Conversation thread */}
      <div className="mb-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {msg.role === 'user' ? (
                /* User message bubble */
                <div className="flex justify-end">
                  <div className="bg-primary-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%] shadow-sm">
                    <p className="text-sm">{msg.query}</p>
                    <div className="text-[10px] text-primary-200 mt-1 text-right">
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                </div>
              ) : msg.isLoading ? (
                /* Loading animation with iteration progress */
                <div className="flex justify-start">
                  <div className="bg-white border border-secondary-200 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[80%] shadow-sm">
                    <div className="flex flex-col space-y-2">
                      <div className="flex space-x-2 items-center">
                        <div className="animate-pulse flex space-x-2">
                          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <div className="flex flex-col ml-2">
                          <span className="text-xs text-secondary-500 font-medium">Researching...</span>
                          <span className="text-[10px] text-secondary-400">
                            Round {currentIteration} of {maxIterations}
                          </span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="w-full bg-secondary-100 rounded-full h-1.5">
                        <motion.div
                          className="bg-primary-500 h-1.5 rounded-full"
                          initial={{ width: '0%' }}
                          animate={{ width: `${(currentIteration / maxIterations) * 100}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Assistant message bubble */
                <div className="flex justify-start">
                  <div className="bg-white border border-secondary-200 rounded-2xl rounded-bl-sm px-4 py-3 max-w-[90%] shadow-sm">
                    {/* Confidence badge */}
                    {msg.confidence != null && (
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
                            getConfidenceBadge(msg.confidence).color
                          }`}
                        >
                          {getConfidenceBadge(msg.confidence).label}
                        </span>
                        {msg.totalIterations != null && msg.totalIterations > 1 && (
                          <span className="text-[10px] text-secondary-400">
                            {msg.totalIterations} search round{msg.totalIterations !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Answer text with typewriter effect + markdown/scientific formatting */}
                    <div className="text-sm text-secondary-800 leading-relaxed">
                      {displayedAnswers[msg.id] ? (
                        <>
                          <FormattedText text={displayedAnswers[msg.id]} />
                          {displayedAnswers[msg.id].length < (msg.answer?.length || 0) && (
                            <span className="inline-block w-0.5 h-4 bg-primary-500 ml-0.5 animate-pulse" />
                          )}
                        </>
                      ) : (
                        <FormattedText text={msg.answer || ''} />
                      )}
                    </div>
                    
                    {/* Sources */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-secondary-100">
                        <p className="text-[10px] font-medium text-secondary-400 uppercase tracking-wider mb-1.5">
                          Sources ({msg.sources.length})
                        </p>
                        <div className="space-y-1">
                          {msg.sources.slice(0, 4).map((source, idx) => {
                            const sourceName = source.filename || source.metadata?.filename || source.source || 'Unknown';
                            return (
                              <div key={idx} className="flex items-center gap-1.5 text-xs text-secondary-600">
                                <span className="w-4 h-4 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[9px] font-medium flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="truncate">{sourceName}</span>
                                {source.score != null && (
                                  <span className="text-[10px] text-secondary-400 flex-shrink-0">
                                    ({(source.score * 100).toFixed(0)}%)
                                  </span>
                                )}
                              </div>
                            );
                          })}
                          {msg.sources.length > 4 && (
                            <p className="text-[10px] text-secondary-400 pl-5">
                              +{msg.sources.length - 4} more sources
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Iteration details (collapsible) */}
                    {msg.iterations && msg.iterations.length > 1 && (
                      <IterationDetails iterations={msg.iterations} />
                    )}

                    {/* Compressed history indicator */}
                    {msg.compressedHistory && msg.compressedHistory.length > 0 && (
                      <div className="mt-2 pt-1 border-t border-secondary-100">
                        <div className="flex items-center gap-1">
                          <svg className="w-3 h-3 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <span className="text-[9px] text-secondary-400">
                            Context from previous {msg.compressedHistory.length > 2 ? `${Math.floor(msg.compressedHistory.length / 2)} conversation turns` : 'conversation'} carried forward
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Action buttons */}
                    <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-secondary-50">
                      <button
                        onClick={() => handleCopy(msg.answer || '')}
                        className="p-1 rounded hover:bg-secondary-100 text-secondary-400 hover:text-secondary-600 transition-colors"
                        title="Copy answer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 'up')}
                        className={`p-1 rounded hover:bg-secondary-100 transition-colors ${
                          msg.feedback === 'up' ? 'text-green-600' : 'text-secondary-400 hover:text-secondary-600'
                        }`}
                        title="Helpful"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 'down')}
                        className={`p-1 rounded hover:bg-secondary-100 transition-colors ${
                          msg.feedback === 'down' ? 'text-red-600' : 'text-secondary-400 hover:text-secondary-600'
                        }`}
                        title="Not helpful"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                        </svg>
                      </button>
                      <span className="text-[10px] text-secondary-400 ml-auto">
                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    
                    {/* Follow-up suggestions */}
                    {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {msg.followUpSuggestions.slice(0, 3).map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleFollowUp(suggestion)}
                            className="text-[11px] px-2 py-1 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
      
      {/* Question form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={messages.length > 0 ? "Ask a follow-up question..." : "Ask a question... (Ctrl+Enter)"}
              className="block w-full px-3 py-2.5 border border-secondary-300 rounded-lg shadow-sm placeholder-secondary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
              disabled={isLoading}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <label className="text-[10px] text-secondary-500 font-medium whitespace-nowrap">
                Rounds:
              </label>
              <select
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value))}
                className="block w-16 px-1.5 py-2.5 border border-secondary-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-xs"
                disabled={isLoading}
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
              disabled={isLoading || !query.trim()}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Researching...
                </>
              ) : (
                'Ask'
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
          className="p-3 mb-4 rounded-md bg-red-50 text-red-800 text-sm"
        >
          {error}
        </motion.div>
      )}
      
      {/* Empty state */}
      {messages.length === 0 && !error && (
        <div className="text-center py-10 text-secondary-500">
          <svg className="mx-auto h-10 w-10 text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="mt-2 text-sm font-medium text-secondary-700">Deep Research Q&A</p>
          <p className="mt-1 text-xs text-secondary-400">
            Ask any question and the AI agent will search your documents, critically evaluate findings, 
            refine its search if needed, and return a comprehensive answer.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <span className="text-[10px] px-2 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
              Multi-round search
            </span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
              Self-refining
            </span>
            <span className="text-[10px] px-2 py-1 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
              Confidence scoring
            </span>
          </div>
          <p className="mt-3 text-xs text-secondary-400">Use <kbd className="px-1 py-0.5 bg-secondary-100 rounded text-[10px] font-mono">Ctrl+Enter</kbd> to submit quickly</p>
        </div>
      )}

      {/* History panel */}
      <ViewHistory
        type="qa"
        title="Conversation History"
        onRestore={handleRestore}
        onClear={() => clearHistory('qa')}
        renderExtra={(entry) => (
          <>
            {entry.feedback && (
              <span className={entry.feedback === 'up' ? 'text-green-500' : 'text-red-500'}>
                {entry.feedback === 'up' ? '👍' : '👎'}
              </span>
            )}
          </>
        )}
      />
    </motion.div>
  );
};

/* ─── Iteration Details Component ─── */
const IterationDetails: React.FC<{ iterations: AgenticIteration[] }> = ({ iterations }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 pt-2 border-t border-secondary-100">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[10px] font-medium text-secondary-500 hover:text-secondary-700 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Search rounds ({iterations.length})
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-2 space-y-2"
          >
            {iterations.map((iteration, idx) => (
              <div key={idx} className="bg-secondary-50 rounded-lg p-2 border border-secondary-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-medium text-secondary-600">
                    Round {idx + 1}
                  </span>
                  <span className="text-[9px] text-secondary-400">
                    {iteration.sources.length} source{iteration.sources.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-[10px] text-secondary-500 italic">
                  "{iteration.query}"
                </p>
                {iteration.confidence != null && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-[9px] text-secondary-400">Confidence:</span>
                    <div className="w-16 bg-secondary-200 rounded-full h-1">
                      <motion.div
                        className="bg-primary-500 h-1 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${iteration.confidence * 100}%` }}
                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                      />
                    </div>
                    <span className="text-[9px] text-secondary-500">
                      {(iteration.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default QuestionAnswerView;