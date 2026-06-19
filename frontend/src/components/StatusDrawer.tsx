import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import apiService, { SystemStatus } from '../services/api';

interface StatusDrawerProps {
  onClose?: () => void;
  permanent?: boolean;
}

const StatusDrawer: React.FC<StatusDrawerProps> = ({ onClose, permanent = false }) => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    totalDocuments: 0,
    vectorCount: 0,
    indexSize: "0 MB",
    lastIndexed: "Never",
    cpuUsage: 0,
    memoryUsage: 0,
    uptime: "0 days"
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);
  
  // Calculate polling interval with exponential backoff
  const getPollInterval = useCallback(() => {
    // Base 10s, cap at 60s with backoff
    const baseInterval = 10000;
    const maxInterval = 60000;
    const backoffMultiplier = Math.min(retryCount, 5); // Cap at 2^5 = 32x
    return Math.min(baseInterval * Math.pow(2, backoffMultiplier), maxInterval);
  }, [retryCount]);
  
  const fetchStatus = useCallback(async () => {
    // Don't fetch if tab is hidden
    if (document.hidden) return;
    
    try {
      const data = await apiService.getSystemStatus();
      setSystemStatus(data);
      setIsLoading(false);
      setError(null);
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      console.error('Error fetching system status:', err);
      setError('Failed to load system status');
      setIsLoading(false);
      setRetryCount(prev => prev + 1); // Increment retry count for backoff
    }
  }, []);
  
  useEffect(() => {
    // Handle visibility changes to pause polling when tab is hidden
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  useEffect(() => {
    fetchStatus();
    
    // Use dynamic interval based on retry count
    const startPolling = () => {
      const interval = getPollInterval();
      intervalRef.current = setInterval(fetchStatus, interval);
    };
    
    startPolling();
    
    // Re-compute interval whenever retryCount changes
    const retryWatcher = setInterval(() => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      const newInterval = getPollInterval();
      intervalRef.current = setInterval(fetchStatus, newInterval);
    }, 30000); // Re-evaluate interval every 30s
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      clearInterval(retryWatcher);
    };
  }, [fetchStatus, getPollInterval]);
  
  // Dashboard metrics (excluding CPU/Memory which have dedicated bars)
  const metrics = [
    { label: "Total Documents", value: systemStatus.totalDocuments.toString() },
    { label: "Vector Count", value: systemStatus.vectorCount.toString() },
    { label: "Index Size", value: systemStatus.indexSize },
    { label: "Last Indexed", value: systemStatus.lastIndexed },
    { label: "Uptime", value: systemStatus.uptime },
  ];

  // Determine the appropriate component and styling based on permanent mode
  const Component = permanent ? 'div' : motion.div;
  const motionProps = permanent ? {} : {
    initial: { x: "100%" },
    animate: { x: 0 },
    exit: { x: "100%" },
    transition: { type: "spring", damping: 25, stiffness: 250 }
  };
  const containerClassName = permanent 
    ? "flex flex-col h-full" 
    : "fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-xl z-50 flex flex-col border-l border-secondary-200";

  return (
    // @ts-ignore - TypeScript doesn't like dynamic components with motion props
    <Component
      {...motionProps}
      className={containerClassName}
    >
      <div className="p-2 border-b border-secondary-200 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-secondary-700 uppercase tracking-wider">System Status</h2>
        <div className="flex items-center space-x-1">
          {/* Manual refresh button */}
          <button 
            onClick={fetchStatus}
            className="p-1 rounded-full hover:bg-secondary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            title="Refresh status"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {!permanent && onClose && (
            <button 
              onClick={onClose}
              className="p-1 rounded-full hover:bg-secondary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div className={`flex-1 overflow-y-auto ${permanent ? 'p-2' : 'p-3'}`}>
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-3 bg-secondary-200 rounded w-1/2 mb-4"></div>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 bg-secondary-200 rounded w-1/4"></div>
                <div className="h-3 bg-secondary-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-secondary-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-xs">{error}</p>
            <p className="text-xs text-secondary-400 mt-1">
              Retrying in {Math.round(getPollInterval() / 1000)}s...
            </p>
            <button 
              onClick={fetchStatus}
              className="mt-2 text-xs text-primary-600 hover:text-primary-500 font-medium"
            >
              Retry Now
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <h3 className="text-secondary-900 font-medium text-xs mb-1">Overview</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {metrics.map((metric, index) => (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-secondary-50 p-1.5 rounded-md"
                  >
                    <dt className="text-xs text-secondary-500">{metric.label}</dt>
                    <dd className="mt-0.5 text-xs font-semibold text-secondary-900">{metric.value}</dd>
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* CPU and Memory Usage Bars */}
            <div>
              <h3 className="text-secondary-900 font-medium text-xs mb-1">Resources</h3>
              
              <div className="space-y-2">
                {/* CPU Usage */}
                <div>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs text-secondary-700">CPU</span>
                    <span className="text-xs text-secondary-700">{systemStatus.cpuUsage}%</span>
                  </div>
                  <div className="w-full bg-secondary-200 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${systemStatus.cpuUsage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-2 rounded-full ${
                        systemStatus.cpuUsage > 80 
                          ? 'bg-red-600' 
                          : systemStatus.cpuUsage > 50 
                            ? 'bg-yellow-500' 
                            : 'bg-green-600'
                      }`}
                    ></motion.div>
                  </div>
                </div>
                
                {/* Memory Usage */}
                <div>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-xs text-secondary-700">Memory</span>
                    <span className="text-xs text-secondary-700">{systemStatus.memoryUsage}%</span>
                  </div>
                  <div className="w-full bg-secondary-200 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${systemStatus.memoryUsage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-2 rounded-full ${
                        systemStatus.memoryUsage > 80 
                          ? 'bg-red-600' 
                          : systemStatus.memoryUsage > 50 
                            ? 'bg-yellow-500' 
                            : 'bg-green-600'
                      }`}
                    ></motion.div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Component>
  );
};

export default StatusDrawer;