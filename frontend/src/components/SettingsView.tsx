import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import apiService from '../services/api';

interface SettingsViewProps {
  onClose: () => void;
}

interface AppConfig {
  ollama_base_url: string;
  embedding_model: string;
  completion_model: string;
  vector_db_path: string;
  metadata_db_path: string;
  upload_dir: string;
  chunk_size: number;
  chunk_overlap: number;
  data_size_bytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function InfoRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-secondary-600">{label}</span>
      <span className="text-xs font-mono text-secondary-800 bg-white px-2 py-0.5 rounded border border-secondary-200 truncate max-w-[240px]" title={String(value)}>
        {value}
      </span>
    </div>
  );
}

const SettingsView: React.FC<SettingsViewProps> = ({ onClose }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const [providers, setProviders] = useState<Record<string, any>>({});
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providersError, setProvidersError] = useState<string | null>(null);

  const [apiUrl, setApiUrl] = useState(() => {
    return localStorage.getItem('api_url') || process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
  });
  const [saved, setSaved] = useState(false);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const data = await apiService.getConfig();
      setConfig(data);
    } catch (err: any) {
      setConfigError(err?.message || 'Failed to load config');
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const fetchProviders = useCallback(async () => {
    setProvidersLoading(true);
    setProvidersError(null);
    try {
      const data = await apiService.getProviders();
      setProviders(data);
    } catch (err: any) {
      setProvidersError(err?.message || 'Failed to load providers');
    } finally {
      setProvidersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchProviders();
  }, [fetchConfig, fetchProviders]);

  const handleSaveApiUrl = () => {
    localStorage.setItem('api_url', apiUrl);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetApiUrl = () => {
    const defaultUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';
    setApiUrl(defaultUrl);
    localStorage.removeItem('api_url');
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const renderConfigSkeleton = () => (
    <div className="animate-pulse space-y-2">
      <div className="h-3 bg-secondary-200 rounded w-3/4" />
      <div className="h-3 bg-secondary-200 rounded w-1/2" />
      <div className="h-3 bg-secondary-200 rounded w-2/3" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-xl shadow-2xl border border-secondary-200 w-[95vw] max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-secondary-200 bg-secondary-50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-sm font-semibold text-secondary-900">Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-secondary-200 text-secondary-500 hover:text-secondary-700 transition-colors"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* ─── API Configuration ─────────────────────────────── */}
          <section>
            <h4 className="text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-2">API Configuration</h4>
            <div className="bg-secondary-50 rounded-lg p-3 border border-secondary-200">
              <label className="block text-xs font-medium text-secondary-600 mb-1">API Base URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-xs border border-secondary-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                  placeholder="http://localhost:8000/api"
                />
                <button
                  onClick={handleSaveApiUrl}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={handleResetApiUrl}
                  className="px-3 py-1.5 text-xs font-medium text-secondary-600 bg-white border border-secondary-300 hover:bg-secondary-50 rounded-md transition-colors"
                >
                  Reset
                </button>
              </div>
              {saved && (
                <p className="mt-1 text-xs text-green-600">Saved! Changes will apply after reload.</p>
              )}
              <p className="mt-1 text-xs text-secondary-500">
                Requires a page reload to take effect.
              </p>
            </div>
          </section>

          {/* ─── Document Processing ───────────────────────────── */}
          <section>
            <h4 className="text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-2">Document Processing</h4>
            <div className="bg-secondary-50 rounded-lg p-3 border border-secondary-200">
              {configLoading ? (
                renderConfigSkeleton()
              ) : configError ? (
                <p className="text-xs text-red-500">{configError}</p>
              ) : config ? (
                <div className="space-y-0.5">
                  <InfoRow label="Chunk Size" value={`${config.chunk_size} tokens`} />
                  <InfoRow label="Chunk Overlap" value={`${config.chunk_overlap} tokens`} />
                  <InfoRow label="Vector DB Path" value={config.vector_db_path} />
                  <InfoRow label="Metadata DB Path" value={config.metadata_db_path} />
                </div>
              ) : null}
              <p className="text-[11px] text-secondary-400 mt-2">
                These can be configured via environment variables on the server.
              </p>
            </div>
          </section>

          {/* ─── AI Models ─────────────────────────────────────── */}
          <section>
            <h4 className="text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-2">AI Models</h4>
            <div className="bg-secondary-50 rounded-lg p-3 border border-secondary-200 space-y-3">
              {/* Model config from /api/config */}
              {configLoading ? (
                renderConfigSkeleton()
              ) : configError ? (
                <p className="text-xs text-red-500">{configError}</p>
              ) : config ? (
                <div className="space-y-0.5 pb-2 border-b border-secondary-200">
                  <InfoRow label="Ollama URL" value={config.ollama_base_url} />
                  <InfoRow label="Embedding Model" value={config.embedding_model} />
                  <InfoRow label="Completion Model" value={config.completion_model} />
                </div>
              ) : null}

              {/* Provider status from /api/providers */}
              <div className="space-y-3">
                {providersLoading ? (
                  <div className="animate-pulse space-y-1.5">
                    <div className="h-3 bg-secondary-200 rounded w-1/2" />
                    <div className="h-3 bg-secondary-200 rounded w-2/3" />
                  </div>
                ) : providersError ? (
                  <p className="text-xs text-red-500">{providersError}</p>
                ) : Object.keys(providers).length === 0 ? (
                  <p className="text-xs text-secondary-500">No provider information available.</p>
                ) : (
                  Object.entries(providers).map(([groupKey, groupProviders]: [string, any]) => (
                    <div key={groupKey}>
                      <p className="text-[11px] font-semibold text-secondary-700 uppercase tracking-wider mb-1.5">
                        {groupKey === 'llm' ? 'LLM Providers' : 'Embedding Providers'}
                      </p>
                      <div className="space-y-1.5">
                        {Object.entries(groupProviders).map(([providerName, providerInfo]: [string, any]) => (
                          <div key={providerName} className="flex items-center justify-between">
                            <div>
                              <p className="text-xs font-medium text-secondary-800 capitalize">{providerName}</p>
                              {providerInfo.model && (
                                <p className="text-[11px] text-secondary-500">Model: {providerInfo.model}</p>
                              )}
                              {providerInfo.base_url && (
                                <p className="text-[11px] text-secondary-400 truncate max-w-[180px]" title={providerInfo.base_url}>
                                  {providerInfo.base_url}
                                </p>
                              )}
                            </div>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                              providerInfo.status === 'available' || providerInfo.status === 'ok'
                                ? 'bg-green-100 text-green-700'
                                : providerInfo.status === 'unavailable' || providerInfo.status === 'error'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {providerInfo.status || 'unknown'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* ─── Storage ───────────────────────────────────────── */}
          <section>
            <h4 className="text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-2">Storage</h4>
            <div className="bg-secondary-50 rounded-lg p-3 border border-secondary-200">
              {configLoading ? (
                renderConfigSkeleton()
              ) : configError ? (
                <p className="text-xs text-red-500">{configError}</p>
              ) : config ? (
                <div className="space-y-0.5">
                  <InfoRow label="Upload Directory" value={config.upload_dir} />
                  <InfoRow label="Vector Data Path" value={config.vector_db_path} />
                  <InfoRow label="Data Size" value={formatBytes(config.data_size_bytes)} />
                </div>
              ) : null}
            </div>
          </section>

          {/* ─── About ─────────────────────────────────────────── */}
          <section>
            <h4 className="text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-2">About</h4>
            <div className="bg-secondary-50 rounded-lg p-3 border border-secondary-200">
              <div className="space-y-1 text-xs text-secondary-600">
                <p><span className="font-medium text-secondary-800">Application:</span> IndXr</p>
                <p><span className="font-medium text-secondary-800">Version:</span> 1.0.0</p>
                <p><span className="font-medium text-secondary-800">Description:</span> Intelligent Document Search & Analysis</p>
                <p className="text-secondary-400 mt-2">
                  IndXr indexes, searches, and analyzes documents using vector embeddings and LLM-powered question answering.
                </p>
              </div>
            </div>
          </section>

        </div>
      </motion.div>
    </div>
  );
};

export default SettingsView;