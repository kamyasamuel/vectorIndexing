import React, { useState } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import SearchView from './components/SearchView';
import QuestionAnswerView from './components/QuestionAnswerView';
import MetadataSearchView from './components/MetadataSearchView';
import UploadArea from './components/UploadArea';
import StatusDrawer from './components/StatusDrawer';
import { AnimatePresence } from 'framer-motion';

// Types for our view modes
type ViewMode = 'search' | 'qa' | 'metadata';

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
      default:
        return <SearchView />;
    }
  };

  return (
    <div className="flex h-screen bg-secondary-50 overflow-hidden">
      <Sidebar 
        currentView={viewMode} 
        onChangeView={setViewMode} 
        onToggleStatus={() => setIsStatusOpen(!isStatusOpen)}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-5xl mx-auto">
            {/* Upload area for file indexing */}
            <UploadArea />
            
            {/* Current view component */}
            <AnimatePresence mode="wait">
              {renderCurrentView()}
            </AnimatePresence>
          </div>
        </main>
      </div>
      
      {/* Status drawer */}
      <AnimatePresence>
        {isStatusOpen && (
          <StatusDrawer onClose={() => setIsStatusOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
