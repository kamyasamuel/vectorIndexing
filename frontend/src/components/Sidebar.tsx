import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import apiService, { SystemStatus } from '../services/api';
import SettingsView from './SettingsView';

type ViewMode = 'search' | 'qa' | 'metadata' | 'upload' | 'library';

interface SidebarProps {
  currentView: ViewMode;
  onChangeView: (view: ViewMode) => void;
  onToggleStatus?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onLogout?: () => void;
  isAuthenticated?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onToggleStatus, collapsed = false, onToggleCollapse, onLogout, isAuthenticated = false }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoutClick = () => {
    if (onLogout) {
      onLogout();
    }
  };

  const handleHome = () => {
    onChangeView('search');
  };

  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  const handleStatusClick = async () => {
    if (onToggleStatus) {
      onToggleStatus();
    } else {
      if (!showStatusDropdown) {
        try {
          const data = await apiService.getSystemStatus();
          setSystemStatus(data);
        } catch {
          // silently fail
        }
      }
      setShowStatusDropdown(!showStatusDropdown);
    }
  };

  // Navigation items configuration
  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      onClick: handleHome,
    },
    { id: 'search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', onClick: () => onChangeView('search') },
    { id: 'qa', label: 'Q&A', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z', onClick: () => onChangeView('qa') },
    { id: 'metadata', label: 'Metadata', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2', onClick: () => onChangeView('metadata') },
    { id: 'upload', label: 'Upload', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12', onClick: () => onChangeView('upload') },
    { id: 'library', label: 'Library', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', onClick: () => onChangeView('library') },
  ];

  // Bottom action items
  const bottomItems = [
    {
      id: 'status',
      label: 'System Status',
      icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      onClick: handleStatusClick,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
      onClick: handleSettingsClick,
    },
    {
      id: 'logout',
      label: isAuthenticated ? 'Logout' : 'Login',
      icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
      onClick: handleLogoutClick,
      danger: true,
    },
  ];

  const renderNavButton = (item: { id: string; label: string; icon: string; onClick?: () => void; danger?: boolean }, isBottom: boolean = false) => (
    <button
      key={item.id}
      onClick={item.onClick}
      className={`${
        !isBottom && currentView === item.id
          ? 'bg-primary-100 text-primary-700'
          : item.danger
            ? 'text-secondary-500 hover:bg-red-50 hover:text-red-600'
            : 'text-secondary-600 hover:bg-secondary-100'
      } group flex items-center py-1.5 px-2 md:px-3 text-xs font-medium rounded-md w-full transition-colors`}
      title={item.label}
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
      {!isBottom && currentView === item.id && (
        <motion.div
          layoutId="activeIndicator"
          className="w-1.5 h-1.5 rounded-full bg-primary-600 ml-auto hidden md:block"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
    </button>
  );

  if (collapsed) {
    return (
      <>
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
          
          {/* Mini nav icons */}
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
          
          {/* Mini bottom action icons */}
          <div className="mt-auto flex flex-col space-y-2">
            {bottomItems.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick}
                className={`p-2 rounded-md ${
                  item.danger
                    ? 'text-secondary-400 hover:bg-red-50 hover:text-red-500'
                    : 'text-secondary-500 hover:bg-secondary-100 hover:text-secondary-700'
                } transition-colors`}
                title={item.label}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <SettingsView onClose={() => setShowSettings(false)} />
        )}
      </>
    );
  }

  return (
    <>
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
            {navItems.map((item) => renderNavButton(item, false))}
          </div>
        </nav>
        
        {/* Bottom action buttons */}
        <div className="border-t border-secondary-200 p-2 space-y-1">
          {bottomItems.map((item) => renderNavButton(item, true))}
        </div>

        {/* Status dropdown (when no onToggleStatus prop) */}
        {showStatusDropdown && !onToggleStatus && systemStatus && (
          <div ref={dropdownRef} className="absolute left-0 bottom-14 ml-2 w-56 bg-white rounded-lg shadow-xl border border-secondary-200 z-50 p-3">
            <div className="text-xs font-semibold text-secondary-700 uppercase tracking-wider mb-2">System Status</div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-secondary-500">Documents</span><span className="font-medium">{systemStatus.totalDocuments}</span></div>
              <div className="flex justify-between text-xs"><span className="text-secondary-500">Vectors</span><span className="font-medium">{systemStatus.vectorCount}</span></div>
              <div className="flex justify-between text-xs"><span className="text-secondary-500">Index Size</span><span className="font-medium">{systemStatus.indexSize}</span></div>
              <div className="flex justify-between text-xs"><span className="text-secondary-500">CPU</span><span className="font-medium">{systemStatus.cpuUsage}%</span></div>
              <div className="flex justify-between text-xs"><span className="text-secondary-500">Memory</span><span className="font-medium">{systemStatus.memoryUsage}%</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <SettingsView onClose={() => setShowSettings(false)} />
      )}
    </>
  );
};

export default Sidebar;