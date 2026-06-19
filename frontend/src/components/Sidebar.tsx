import React from 'react';
import { motion } from 'framer-motion';

type ViewMode = 'search' | 'qa' | 'metadata' | 'upload' | 'library';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  onToggleStatus?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onToggleStatus, collapsed = false, onToggleCollapse }) => {
  // Navigation items configuration
  const navItems = [
    { id: 'search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { id: 'qa', label: 'Q&A', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'metadata', label: 'Metadata', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { id: 'upload', label: 'Upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
    { id: 'library', label: 'Library', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  ];

  if (collapsed) {
    return (
      <div className="bg-white w-12 md:w-16 border-r border-secondary-200 flex flex-col items-center py-4">
        {/* Expand button */}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-secondary-100 text-secondary-500 transition-colors mb-4"
          title="Expand sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        
        {/* Mini icons */}
        <nav className="flex flex-col space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as ViewMode)}
              className={`p-2 rounded-md ${
                currentView === item.id
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700'
              } transition-colors`}
              title={item.label}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
            </button>
          ))}
        </nav>
        
        {/* Mini status button for mobile */}
        <div className="mt-auto lg:hidden">
          {onToggleStatus && (
            <button
              onClick={onToggleStatus}
              className="p-2 rounded-md text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700 transition-colors"
              title="System Status"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white w-16 md:w-64 border-r border-secondary-200 overflow-y-auto flex flex-col">
      {/* Collapse button */}
      <div className="p-2 flex justify-end">
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md hover:bg-secondary-100 text-secondary-400 hover:text-secondary-600 transition-colors"
          title="Collapse sidebar"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5l-7 7 7 7m8-14l-7 7 7 7" />
          </svg>
        </button>
      </div>
      
      {/* Main navigation */}
      <nav className="flex-1">
        <div className="px-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as ViewMode)}
              className={`${
                currentView === item.id
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-secondary-600 hover:bg-secondary-100'
              } group flex items-center py-1.5 px-2 md:px-3 text-xs font-medium rounded-md w-full transition-colors`}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 md:mr-2 md:h-4 md:w-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className="hidden md:inline-block">{item.label}</span>
              
              {/* Active indicator dot */}
              {currentView === item.id && (
                <motion.div
                  layoutId="activeIndicator"
                  className="w-1.5 h-1.5 rounded-full bg-primary-600 ml-auto hidden md:block"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
              )}
            </button>
          ))}
        </div>
      </nav>
      
      {/* Mobile-only System status button */}
      <div className="p-4 border-t border-secondary-200 lg:hidden">
        {onToggleStatus && (
          <button
            onClick={onToggleStatus}
              className="group flex items-center py-1.5 px-2 md:px-3 text-xs font-medium rounded-md w-full text-secondary-600 hover:bg-secondary-100 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 md:mr-2 md:h-4 md:w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <span className="hidden md:inline-block">System Status</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;