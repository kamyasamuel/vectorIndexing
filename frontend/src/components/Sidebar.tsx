import React from 'react';
import { motion } from 'framer-motion';

type ViewMode = 'search' | 'qa' | 'metadata' | 'upload';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  onToggleStatus?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onToggleStatus }) => {
  // Navigation items configuration
  const navItems = [
    { id: 'search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
    { id: 'qa', label: 'Q&A', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'metadata', label: 'Metadata', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { id: 'upload', label: 'Upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
  ];

  return (
    <div className="bg-white w-16 md:w-64 border-r border-secondary-200 overflow-y-auto flex flex-col">
      {/* Main navigation */}
      <nav className="mt-8 flex-1">
        <div className="px-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onChangeView(item.id as ViewMode)}
              className={`${
                currentView === item.id
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-secondary-600 hover:bg-secondary-100'
              } group flex items-center py-2 px-2 md:px-3 text-sm font-medium rounded-md w-full transition-colors`}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-6 w-6 md:mr-3 md:h-5 md:w-5" 
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
            className="group flex items-center py-2 px-2 md:px-3 text-sm font-medium rounded-md w-full text-secondary-600 hover:bg-secondary-100 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 md:mr-3 md:h-5 md:w-5"
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
