import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface StatusDrawerProps {
  onClose?: () => void;
  permanent?: boolean;
}

// Simulated system data (in a real app, this would come from a backend API)
interface SystemStatus {
  totalDocuments: number;
  vectorCount: number;
  indexSize: string;
  lastIndexed: string;
  cpuUsage: number;
  memoryUsage: number;
  uptime: string;
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
  
  // Simulated data fetch (in a real app, you would fetch this from the backend)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSystemStatus({
        totalDocuments: 42,
        vectorCount: 1245,
        indexSize: "58.2 MB",
        lastIndexed: "2 minutes ago",
        cpuUsage: 23,
        memoryUsage: 34,
        uptime: "3 days, 8 hours"
      });
      setIsLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Dashboard metrics
  const metrics = [
    { label: "Total Documents", value: systemStatus.totalDocuments.toString() },
    { label: "Vector Count", value: systemStatus.vectorCount.toString() },
    { label: "Index Size", value: systemStatus.indexSize },
    { label: "Last Indexed", value: systemStatus.lastIndexed },
    { label: "CPU Usage", value: `${systemStatus.cpuUsage}%` },
    { label: "Memory Usage", value: `${systemStatus.memoryUsage}%` },
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
      <div className="p-3 border-b border-secondary-200 flex items-center justify-between">
        <h2 className="text-sm font-medium">System Status</h2>
        {!permanent && onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-secondary-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      <div className={`flex-1 overflow-y-auto ${permanent ? 'p-3' : 'p-4'}`}>
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-secondary-200 rounded w-1/2 mb-6"></div>
            {[...Array(7)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-secondary-200 rounded w-1/4"></div>
                <div className="h-4 bg-secondary-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className={`space-y-${permanent ? '3' : '6'}`}>
            <div>
              <h3 className={`text-secondary-900 font-medium ${permanent ? 'text-sm mb-2' : 'mb-4'}`}>System Overview</h3>
              <div className={`grid grid-cols-2 gap-${permanent ? '2' : '4'}`}>
                {metrics.map((metric, index) => (
                  <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`bg-secondary-50 ${permanent ? 'p-2' : 'p-3'} rounded-md`}
                  >
                    <dt className="text-xs font-medium text-secondary-500">{metric.label}</dt>
                    <dd className={`mt-1 ${permanent ? 'text-sm' : 'text-lg'} font-semibold text-secondary-900`}>{metric.value}</dd>
                  </motion.div>
                ))}
              </div>
            </div>
            
            {/* CPU and Memory Usage Bars */}
            <div>
              <h3 className={`text-secondary-900 font-medium ${permanent ? 'text-sm mb-2' : 'mb-3'}`}>Resource Usage</h3>
              
              <div className="space-y-4">
                {/* CPU Usage */}
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-secondary-700">CPU Usage</span>
                    <span className="text-xs font-medium text-secondary-700">{systemStatus.cpuUsage}%</span>
                  </div>
                  <div className="w-full bg-secondary-200 rounded-full h-2.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${systemStatus.cpuUsage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-2.5 rounded-full ${
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
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-medium text-secondary-700">Memory Usage</span>
                    <span className="text-xs font-medium text-secondary-700">{systemStatus.memoryUsage}%</span>
                  </div>
                  <div className="w-full bg-secondary-200 rounded-full h-2.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${systemStatus.memoryUsage}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={`h-2.5 rounded-full ${
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
            
            {/* System Actions - only show in full drawer mode */}
            {!permanent && (
              <div>
                <h3 className="text-secondary-900 font-medium mb-3">System Actions</h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                    Reindex All Documents
                  </button>
                  <button className="w-full flex items-center justify-center py-2 px-4 border border-secondary-300 rounded-md shadow-sm text-sm font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                    Clear Vector Cache
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Component>
  );
};

export default StatusDrawer;
