import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SearchView from './components/SearchView';
import QuestionAnswerView from './components/QuestionAnswerView';
import MetadataSearchView from './components/MetadataSearchView';
import UploadView from './components/UploadView';
import LibraryView from './components/LibraryView';
import LoginPage from './components/LoginPage';
import StatusDrawer from './components/StatusDrawer';
import IndexedFilesPanel from './components/IndexedFilesPanel';
import { HistoryProvider } from './hooks/useHistory';
import { motion, AnimatePresence } from 'framer-motion';
import apiService from './services/api';

// Types for our view modes
type ViewMode = 'search' | 'qa' | 'metadata' | 'upload' | 'library';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [isStatusOpen, setIsStatusOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isFilesPanelOpen, setIsFilesPanelOpen] = useState<boolean>(true);

  // Check auth state on mount
  useEffect(() => {
    const checkAuth = async () => {
      const hasToken = apiService.isAuthenticated();
      if (hasToken) {
        try {
          await apiService.getMe();
          setIsAuthenticated(true);
        } catch {
          // Token is invalid/expired, clear it
          apiService.logout();
          setIsAuthenticated(false);
        }
      }
      setAuthChecked(true);
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    apiService.logout();
    setIsAuthenticated(false);
  };
  
  // Render the current view based on mode
  const renderCurrentView = () => {
    switch (viewMode) {
      case 'search':
        return <SearchView />;
      case 'qa':
        return <QuestionAnswerView />;
      case 'metadata':
        return <MetadataSearchView />;
      case 'upload':
        return <UploadView />;
      case 'library':
        return <LibraryView />;
      default:
        return <SearchView />;
    }
  };

  // Show loading screen while checking auth
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-secondary-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-sm text-secondary-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <HistoryProvider>
    <div className="flex h-screen bg-secondary-50 overflow-hidden">
      {/* Left sidebar navigation - collapsible */}
      <Sidebar 
        currentView={viewMode} 
        onChangeView={setViewMode} 
        onToggleStatus={() => setIsStatusOpen(!isStatusOpen)}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onLogout={handleLogout}
        isAuthenticated={isAuthenticated}
      />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-hidden flex">
          {/* Main view content */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="max-w-4xl mx-auto">
              <AnimatePresence mode="wait">
                {renderCurrentView()}
              </AnimatePresence>
            </div>
          </div>
          
          {/* Right sidebar */}
          <motion.div
            initial={false}
            animate={{ 
              width: isFilesPanelOpen ? 360 : 48,
              opacity: 1
            }}
            transition={{ 
              type: "spring", 
              damping: 25, 
              stiffness: 200,
              mass: 0.8
            }}
            className="hidden md:flex md:flex-col border-l border-secondary-200 bg-white overflow-hidden"
          >
            {isFilesPanelOpen ? (
              <>
                {/* Collapse button - positioned at top like left sidebar */}
                <div className="p-2 flex justify-end">
                  <button
                    onClick={() => setIsFilesPanelOpen(false)}
                    className="p-1.5 rounded-md hover:bg-secondary-100 text-secondary-400 hover:text-secondary-600 transition-colors"
                    title="Collapse side panels"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Files section */}
                <div className="flex flex-col border-b border-secondary-200 max-h-[50vh] overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-xs font-semibold text-secondary-700 uppercase tracking-wider">Files</span>
                  </div>
                  <div className="overflow-hidden flex-1">
                    <IndexedFilesPanel />
                  </div>
                </div>
                
                {/* Status section - always visible, not collapsible */}
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5">
                    <span className="text-xs font-semibold text-secondary-700 uppercase tracking-wider">Status</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="h-full overflow-y-auto">
                      <StatusDrawer permanent={true} />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Collapsed right panel - expand button */
              <div className="flex flex-col items-center justify-start py-2">
                <button
                  onClick={() => setIsFilesPanelOpen(true)}
                  className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 rounded-md transition-colors mt-1"
                  title="Show side panels"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5l-7 7 7 7m8-14l-7 7 7 7" />
                  </svg>
                </button>
              </div>
            )}
          </motion.div>
        </main>
      </div>
      
      {/* Mobile status drawer (shown on all screens as overlay when status button clicked) */}
      <AnimatePresence>
        {isStatusOpen && (
          <StatusDrawer onClose={() => setIsStatusOpen(false)} />
        )}
      </AnimatePresence>
    </div>
    </HistoryProvider>
  );
};

export default App;
