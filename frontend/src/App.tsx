import React, { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SearchView from './components/SearchView';
import QuestionAnswerView from './components/QuestionAnswerView';
import MetadataSearchView from './components/MetadataSearchView';
import UploadView from './components/UploadView';
import StatusDrawer from './components/StatusDrawer';
import IndexedFilesPanel from './components/IndexedFilesPanel';
import { AnimatePresence } from 'framer-motion';

// Types for our view modes
type ViewMode = 'search' | 'qa' | 'metadata' | 'upload';

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [isStatusOpen, setIsStatusOpen] = useState<boolean>(false);
  
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
      default:
        return <SearchView />;
    }
  };

  return (
    <div className="flex h-screen bg-secondary-50 overflow-hidden">
      {/* Left sidebar navigation */}
      <Sidebar 
        currentView={viewMode} 
        onChangeView={setViewMode} 
        onToggleStatus={() => setIsStatusOpen(!isStatusOpen)}
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
          
          {/* Right sidebar with files and status */}
          <div className="hidden lg:flex lg:flex-col border-l border-secondary-200 bg-white w-80 overflow-hidden">
            {/* Files panel */}
            <div className="flex-1 overflow-hidden">
              <IndexedFilesPanel />
            </div>
            
            {/* Status panel (permanently visible) */}
            <div className="h-80 border-t border-secondary-200 overflow-y-auto">
              <StatusDrawer permanent={true} />
            </div>
          </div>
        </main>
      </div>
      
      {/* Mobile status drawer (only shown on smaller screens) */}
      <AnimatePresence>
        {isStatusOpen && (
          <div className="lg:hidden">
            <StatusDrawer onClose={() => setIsStatusOpen(false)} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
