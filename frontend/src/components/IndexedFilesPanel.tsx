import React, { useState, useEffect } from 'react';
import apiService, { IndexedFile, Category } from '../services/api';
import FileSearchBar from './FileSearchBar';
import FileList from './FileList';
import CreateCategoryModal from './CreateCategoryModal';
import RenameCategoryModal from './RenameCategoryModal';
import DeleteCategoryModal from './DeleteCategoryModal';
import MoveDocumentModal from './MoveDocumentModal';
import DocumentViewer from './DocumentViewer';

// Create a type for the new category form state
interface NewCategoryForm {
  isVisible: boolean;
  name: string;
  path: string;
  isSubmitting: boolean;
  error: string | null;
}

// Type for the moving document operation
interface MoveDocumentOperation {
  isMoving: boolean;
  documentId: string | null;
  selectedCategory: string | null;
}

// Type for the category edit operation
interface CategoryOperation {
  type: 'rename' | 'delete' | null;
  categoryPath: string | null;
  categoryName: string;
  isSubmitting: boolean;
  error: string | null;
}

// Group files by folder
const groupFilesByFolder = (files: IndexedFile[]) => {
  const folders: { [key: string]: IndexedFile[] } = {};
  
  files.forEach(file => {
    const folder = file.path || '/';
    if (!folders[folder]) {
      folders[folder] = [];
    }
    folders[folder].push(file);
  });
  
  return folders;
};

const IndexedFilesPanel: React.FC = () => {
  const [files, setFiles] = useState<IndexedFile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [newCategoryForm, setNewCategoryForm] = useState<NewCategoryForm>({
    isVisible: false,
    name: '',
    path: '',
    isSubmitting: false,
    error: null
  });
  const [moveDocumentOp, setMoveDocumentOp] = useState<MoveDocumentOperation>({
    isMoving: false,
    documentId: null,
    selectedCategory: null
  });
  const [categoryOp, setCategoryOp] = useState<CategoryOperation>({
    type: null,
    categoryPath: null,
    categoryName: '',
    isSubmitting: false,
    error: null
  });
  // Document viewer state
  const [viewerDoc, setViewerDoc] = useState<{ id: string; filename: string; fileType: string } | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Fetch files and categories in parallel
        const [filesResponse, categoriesResponse] = await Promise.all([
          apiService.getIndexedFiles(),
          apiService.getCategories()
        ]);
        
        setFiles(filesResponse);
        setCategories(categoriesResponse);
        
        // Initially expand all folders
        const initialExpandState = filesResponse.reduce((acc: { [key: string]: boolean }, file: IndexedFile) => {
          if (file.path) {
            acc[file.path] = true;
          }
          return acc;
        }, {});
        
        setExpandedFolders(initialExpandState);
      } catch (error) {
        console.error('Error fetching indexed files:', error);
        setFiles([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [refreshTrigger]);
  
  // Handle new category creation
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCategoryForm.name.trim()) {
      setNewCategoryForm(prev => ({
        ...prev,
        error: 'Category name is required'
      }));
      return;
    }
    
    setNewCategoryForm(prev => ({
      ...prev,
      isSubmitting: true,
      error: null
    }));
    
    try {
      const path = newCategoryForm.path || `/${newCategoryForm.name}`;
      await apiService.createCategory(newCategoryForm.name, path);
      
      setNewCategoryForm({
        isVisible: false,
        name: '',
        path: '',
        isSubmitting: false,
        error: null
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error creating category:', error);
      setNewCategoryForm(prev => ({
        ...prev,
        isSubmitting: false,
        error: 'Failed to create category. Please try again.'
      }));
    }
  };
  
  // Handle category rename
  const handleRenameCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryOp.categoryPath || !categoryOp.categoryName.trim()) {
      setCategoryOp(prev => ({
        ...prev,
        error: 'Category name is required'
      }));
      return;
    }
    
    setCategoryOp(prev => ({
      ...prev,
      isSubmitting: true,
      error: null
    }));
    
    try {
      const parentPath = categoryOp.categoryPath.split('/').slice(0, -1).join('/');
      const newPath = parentPath ? `${parentPath}/${categoryOp.categoryName}` : `/${categoryOp.categoryName}`;
      
      await apiService.updateCategory(categoryOp.categoryPath, newPath);
      
      setCategoryOp({
        type: null,
        categoryPath: null,
        categoryName: '',
        isSubmitting: false,
        error: null
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error renaming category:', error);
      setCategoryOp(prev => ({
        ...prev,
        isSubmitting: false,
        error: 'Failed to rename category. Please try again.'
      }));
    }
  };
  
  // Handle category deletion
  const handleDeleteCategory = async () => {
    if (!categoryOp.categoryPath) return;
    
    setCategoryOp(prev => ({
      ...prev,
      isSubmitting: true,
      error: null
    }));
    
    try {
      const filesInCategory = files.filter(file => file.path === categoryOp.categoryPath);
      
      for (const file of filesInCategory) {
        await apiService.moveDocumentToCategory(file.id, '/');
      }
      
      setCategoryOp({
        type: null,
        categoryPath: null,
        categoryName: '',
        isSubmitting: false,
        error: null
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting category:', error);
      setCategoryOp(prev => ({
        ...prev,
        isSubmitting: false,
        error: 'Failed to delete category. Please try again.'
      }));
    }
  };
  
  // Handle moving a document to a category
  const handleMoveDocument = async () => {
    if (!moveDocumentOp.documentId || !moveDocumentOp.selectedCategory) return;
    
    try {
      await apiService.moveDocumentToCategory(
        moveDocumentOp.documentId, 
        moveDocumentOp.selectedCategory
      );
      
      setMoveDocumentOp({
        isMoving: false,
        documentId: null,
        selectedCategory: null
      });
      
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error moving document:', error);
      setMoveDocumentOp({
        isMoving: false,
        documentId: null,
        selectedCategory: null
      });
    }
  };
  
  // Filter files based on search
  const filteredFiles = files.filter(file => 
    (file.filename || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Group files by folder after filtering
  const folders = groupFilesByFolder(filteredFiles);
  
  // Toggle folder expansion
  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 border-b border-secondary-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xs font-semibold text-secondary-700 uppercase tracking-wider">Indexed Files</h2>
        </div>
        
        {/* Search bar */}
        <FileSearchBar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onClear={() => setSearchTerm('')}
          resultCount={filteredFiles.length}
        />
      </div>
      
      <div className="flex-1 overflow-y-auto p-1.5">
        {isLoading ? (
          <div className="animate-pulse space-y-3 p-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 bg-secondary-200 rounded w-3/4"></div>
                <div className="h-8 bg-secondary-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : Object.keys(folders).length === 0 ? (
          <div className="text-center py-6 text-secondary-500">
            {searchTerm ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <p className="mt-2 text-xs">No files match your search</p>
                <button onClick={() => setSearchTerm('')} className="mt-2 text-xs text-primary-600 hover:text-primary-500 font-medium">
                  Clear search
                </button>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                <p className="mt-2 text-xs">No files have been indexed yet</p>
                <p className="mt-1 text-xs text-secondary-400">
                  Upload documents to get started
                </p>
              </>
            )}
          </div>
        ) : (
          <FileList
            folders={folders}
            expandedFolders={expandedFolders}
            onToggleFolder={toggleFolder}
            onMoveDocument={(id) => setMoveDocumentOp({ isMoving: true, documentId: id, selectedCategory: null })}
            onSearchWithDocument={(id) => console.log('Search using document:', id)}
            onShowFileDetails={(id) => console.log('Show file details:', id)}
            onViewDocument={(id, filename, fileType) => setViewerDoc({ id, filename, fileType })}
            onRenameCategory={(path) => {
              setCategoryOp({
                type: 'rename',
                categoryPath: path,
                categoryName: path.split('/').filter(Boolean).pop() || '',
                isSubmitting: false,
                error: null
              });
            }}
            onDeleteCategory={(path) => {
              setCategoryOp({
                type: 'delete',
                categoryPath: path,
                categoryName: path.split('/').filter(Boolean).pop() || '',
                isSubmitting: false,
                error: null
              });
            }}
          />
        )}
      </div>
      
      <div className="border-t border-secondary-200 bg-secondary-50">
        {/* Stats summary */}
        <div className="p-1.5 pt-2 px-2 flex justify-between text-xs text-secondary-600">
          <div>
            <span className="font-medium">{files.length}</span> files
          </div>
          <div>
            <span className="font-medium">{categories.length}</span> cats
          </div>
        </div>
        
        {/* Create category button */}
        <div className="p-1.5 pt-1">
          <button 
            onClick={() => setNewCategoryForm(prev => ({ ...prev, isVisible: true }))}
            className="w-full flex items-center justify-center py-1.5 px-3 border border-secondary-300 rounded-md text-xs font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            New Category
          </button>
        </div>
        
        {/* System Actions */}
        <div className="px-1.5 pb-1.5 pt-0.5 space-y-1">
          <button className="w-full flex items-center justify-center py-1.5 px-3 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
            Reindex All
          </button>
          <button className="w-full flex items-center justify-center py-1.5 px-3 border border-secondary-300 rounded-md shadow-sm text-xs font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
            Clear Cache
          </button>
        </div>
      </div>
      
      {/* Modals - rendered at the top level of this component */}
      <CreateCategoryModal
        form={newCategoryForm}
        onClose={() => setNewCategoryForm(prev => ({ ...prev, isVisible: false }))}
        onNameChange={(name) => setNewCategoryForm(prev => ({ ...prev, name }))}
        onPathChange={(path) => setNewCategoryForm(prev => ({ ...prev, path }))}
        onSubmit={handleCreateCategory}
      />
      
      <RenameCategoryModal
        operation={categoryOp}
        onClose={() => setCategoryOp({ type: null, categoryPath: null, categoryName: '', isSubmitting: false, error: null })}
        onNameChange={(name) => setCategoryOp(prev => ({ ...prev, categoryName: name }))}
        onSubmit={handleRenameCategory}
      />
      
      <DeleteCategoryModal
        operation={categoryOp}
        onClose={() => setCategoryOp({ type: null, categoryPath: null, categoryName: '', isSubmitting: false, error: null })}
        onConfirm={handleDeleteCategory}
      />
      
      <MoveDocumentModal
        operation={moveDocumentOp}
        categories={categories}
        onClose={() => setMoveDocumentOp({ isMoving: false, documentId: null, selectedCategory: null })}
        onCategoryChange={(cat) => setMoveDocumentOp(prev => ({ ...prev, selectedCategory: cat }))}
        onConfirm={handleMoveDocument}
      />
      
      {/* Document Viewer Modal */}
      {viewerDoc && (
        <DocumentViewer
          documentId={viewerDoc.id}
          filename={viewerDoc.filename}
          fileType={viewerDoc.fileType}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </div>
  );
};

export default IndexedFilesPanel;