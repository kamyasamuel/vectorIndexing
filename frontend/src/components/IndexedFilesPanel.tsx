import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import apiService, { IndexedFile, Category } from '../services/api';

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
        // Set some sample files for development if API fails
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
      // Construct the full path
      const path = newCategoryForm.path || `/${newCategoryForm.name}`;
      
      // Call API to create category
      await apiService.createCategory(newCategoryForm.name, path);
      
      // Reset form and refresh data
      setNewCategoryForm({
        isVisible: false,
        name: '',
        path: '',
        isSubmitting: false,
        error: null
      });
      
      // Trigger refresh
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
      // Create the new path based on the category name
      const parentPath = categoryOp.categoryPath.split('/').slice(0, -1).join('/');
      const newPath = parentPath ? `${parentPath}/${categoryOp.categoryName}` : `/${categoryOp.categoryName}`;
      
      // Call API to update category
      await apiService.updateCategory(categoryOp.categoryPath, newPath);
      
      // Reset form and refresh data
      setCategoryOp({
        type: null,
        categoryPath: null,
        categoryName: '',
        isSubmitting: false,
        error: null
      });
      
      // Trigger refresh
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
      // For now, since we don't have a delete category API,
      // we'll simulate it by moving all files to the root category
      const filesInCategory = files.filter(file => file.path === categoryOp.categoryPath);
      
      // Move all files to root category
      for (const file of filesInCategory) {
        await apiService.moveDocumentToCategory(file.id, '/');
      }
      
      // Reset form and refresh data
      setCategoryOp({
        type: null,
        categoryPath: null,
        categoryName: '',
        isSubmitting: false,
        error: null
      });
      
      // Trigger refresh
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
      
      // Reset and refresh
      setMoveDocumentOp({
        isMoving: false,
        documentId: null,
        selectedCategory: null
      });
      
      // Trigger refresh
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Error moving document:', error);
      // Reset
      setMoveDocumentOp({
        isMoving: false,
        documentId: null,
        selectedCategory: null
      });
    }
  };
  
  // Filter files based on search
  const filteredFiles = files.filter(file => 
    file.filename.toLowerCase().includes(searchTerm.toLowerCase())
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
  
  // Get appropriate icon for file type
  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'docx':
      case 'doc':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'txt':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'md':
      case 'markdown':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'mp3':
      case 'wav':
      case 'ogg':
      case 'flac':
      case 'm4a':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        );
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
      case 'webp':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-pink-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        );
      case 'html':
      case 'htm':
      case 'css':
      case 'js':
      case 'ts':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-secondary-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium">Indexed Files</h2>
          
          <button 
            onClick={() => setNewCategoryForm(prev => ({ ...prev, isVisible: true }))}
            className="p-1.5 rounded-md hover:bg-secondary-100 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            title="Create new category"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>
        
        {/* Search bar */}
        <div className="mt-3">
          <div className="relative rounded-md">
            <input
              type="text"
              className="block w-full pl-10 p-2 border sm:text-sm border-secondary-300 rounded-md focus:ring-primary-500 focus:border-primary-500 bg-secondary-50"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-secondary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchTerm && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button 
                  onClick={() => setSearchTerm('')}
                  className="text-secondary-400 hover:text-secondary-600 focus:outline-none"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
          
          {searchTerm && (
            <div className="mt-1 text-xs text-secondary-500">
              Found {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'} matching "{searchTerm}"
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="animate-pulse space-y-4 p-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-secondary-200 rounded w-3/4"></div>
                <div className="h-12 bg-secondary-100 rounded"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {Object.keys(folders).length === 0 ? (
              <div className="text-center py-8 text-secondary-500">
                {searchTerm ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="mt-2">No files match your search</p>
                    <button onClick={() => setSearchTerm('')} className="mt-3 text-sm text-primary-600 hover:text-primary-500 font-medium">
                      Clear search
                    </button>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-secondary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    <p className="mt-2">No files have been indexed yet</p>
                    <button 
                      onClick={() => {
                        // Navigate to upload view
                        // This would need to be implemented via router or state management
                        window.location.href = '/#/upload';
                      }}
                      className="mt-3 text-sm bg-primary-600 hover:bg-primary-700 text-white py-1.5 px-3 rounded-md font-medium"
                    >
                      Upload a document
                    </button>
                  </>
                )}
              </div>
            ) : (
              Object.entries(folders).map(([folder, files]) => (
                <div key={folder} className="mb-3">
                  {/* Folder header */}
                  <div className="flex items-center group">
                    <button 
                      onClick={() => toggleFolder(folder)}
                      className="flex-1 flex items-center p-2 hover:bg-secondary-100 rounded-md transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-secondary-500 mr-2 transition-transform ${expandedFolders[folder] ? 'transform rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      <span className="text-sm font-medium text-secondary-900 truncate">
                        {folder === "/" ? "Uncategorized" : folder.split('/').filter(Boolean).pop()}
                      </span>
                      <span className="ml-auto text-xs text-secondary-500 bg-secondary-100 rounded-full px-2 py-0.5">
                        {files.length}
                      </span>
                    </button>
                    
                    {/* Category action buttons */}
                    {folder !== "/" && (
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex pr-2">
                        {/* Rename category */}
                        <button 
                          onClick={() => {
                            setCategoryOp({
                              type: 'rename',
                              categoryPath: folder,
                              categoryName: folder.split('/').filter(Boolean).pop() || '',
                              isSubmitting: false,
                              error: null
                            });
                          }}
                          className="p-1 rounded-full hover:bg-secondary-200 text-secondary-600 mr-1" 
                          title="Rename category"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        
                        {/* Delete category */}
                        <button 
                          onClick={() => {
                            setCategoryOp({
                              type: 'delete',
                              categoryPath: folder,
                              categoryName: folder.split('/').filter(Boolean).pop() || '',
                              isSubmitting: false,
                              error: null
                            });
                          }}
                          className="p-1 rounded-full hover:bg-secondary-200 text-red-600" 
                          title="Delete category"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Folder contents */}
                  {expandedFolders[folder] && (
                    <div className="pl-9 space-y-1 mt-1">
                      {files.map((file) => (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-center p-2 hover:bg-secondary-100 rounded-md group cursor-pointer"
                        >
                          <div className="flex-shrink-0">
                            {getFileIcon(file.file_type)}
                          </div>
                          <div className="ml-3 flex-1 min-w-0">
                            <div className="flex items-center">
                              <p className="text-sm font-medium text-secondary-900 truncate">
                                {file.filename}
                              </p>
                              <span className="ml-2 text-xs text-secondary-500 font-medium bg-secondary-100 rounded-full px-2 py-0.5">
                                {file.file_type.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center text-xs text-secondary-500 mt-0.5">
                              <span className="truncate">
                                {file.file_size_formatted} • Indexed {file.date_indexed}
                              </span>
                              {file.title && (
                                <span className="truncate ml-2 text-secondary-600">
                                  {file.title}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="ml-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex">
                            {/* Move to category */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setMoveDocumentOp({ isMoving: true, documentId: file.id, selectedCategory: null });
                              }}
                              className="p-1 rounded-full hover:bg-secondary-200 text-secondary-600 mr-1" 
                              title="Move to category"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                              </svg>
                            </button>
                            
                            {/* Search with this file context */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                // This would be implemented to allow direct search
                                // using this document's content as context
                                console.log('Search using document:', file.id);
                              }}
                              className="p-1 rounded-full hover:bg-secondary-200 text-secondary-600 mr-1" 
                              title="Search with this document"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </button>
                            
                            {/* File details */}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                // This would show detailed metadata about the file
                                console.log('Show file details:', file.id);
                              }}
                              className="p-1 rounded-full hover:bg-secondary-200 text-secondary-600" 
                              title="File details"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      
      <div className="border-t border-secondary-200 bg-secondary-50">
        {/* Stats summary */}
        <div className="p-2 pt-3 px-3 flex justify-between text-xs text-secondary-600">
          <div>
            <span className="font-medium">{files.length}</span> indexed files
          </div>
          <div>
            <span className="font-medium">{categories.length}</span> categories
          </div>
        </div>
        
        {/* Create category button */}
        <div className="p-3 pt-2">
          <button 
            onClick={() => setNewCategoryForm(prev => ({ ...prev, isVisible: true }))}
            className="w-full flex items-center justify-center py-2 px-4 border border-secondary-300 rounded-md text-sm font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Create New Category
          </button>
        </div>
      </div>
      
      {/* Create category modal */}
      <AnimatePresence>
        {newCategoryForm.isVisible && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-10"
              onClick={() => setNewCategoryForm(prev => ({ ...prev, isVisible: false }))}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-20 w-full max-w-md p-6"
            >
              <h3 className="text-lg font-medium text-secondary-900 mb-4">Create New Category</h3>
              
              <form onSubmit={handleCreateCategory}>
                <div className="mb-4">
                  <label htmlFor="category-name" className="block text-sm font-medium text-secondary-700 mb-1">
                    Category Name
                  </label>
                  <input
                    type="text"
                    id="category-name"
                    value={newCategoryForm.name}
                    onChange={e => setNewCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                    className="block w-full border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="e.g., Documents, Reports, Research"
                  />
                </div>
                
                <div className="mb-6">
                  <label htmlFor="category-path" className="block text-sm font-medium text-secondary-700 mb-1">
                    Path (Optional)
                  </label>
                  <input
                    type="text"
                    id="category-path"
                    value={newCategoryForm.path}
                    onChange={e => setNewCategoryForm(prev => ({ ...prev, path: e.target.value }))}
                    className="block w-full border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="/path/to/category (leave empty for default)"
                  />
                  <p className="mt-1 text-xs text-secondary-500">
                    If left empty, a path will be created automatically based on the category name.
                  </p>
                </div>
                
                {newCategoryForm.error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
                    {newCategoryForm.error}
                  </div>
                )}
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setNewCategoryForm(prev => ({ ...prev, isVisible: false }))}
                    className="px-4 py-2 border border-secondary-300 rounded-md text-sm font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    disabled={newCategoryForm.isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center"
                    disabled={newCategoryForm.isSubmitting}
                  >
                    {newCategoryForm.isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : "Create Category"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Rename category modal */}
      <AnimatePresence>
        {categoryOp.type === 'rename' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-10"
              onClick={() => setCategoryOp({ type: null, categoryPath: null, categoryName: '', isSubmitting: false, error: null })}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-20 w-full max-w-md p-6"
            >
              <h3 className="text-lg font-medium text-secondary-900 mb-4">Rename Category</h3>
              
              <form onSubmit={handleRenameCategory}>
                <div className="mb-6">
                  <label htmlFor="rename-category-name" className="block text-sm font-medium text-secondary-700 mb-1">
                    New Category Name
                  </label>
                  <input
                    type="text"
                    id="rename-category-name"
                    value={categoryOp.categoryName}
                    onChange={e => setCategoryOp(prev => ({ ...prev, categoryName: e.target.value }))}
                    className="block w-full border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                    placeholder="Enter new category name"
                    autoFocus
                  />
                </div>
                
                {categoryOp.error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
                    {categoryOp.error}
                  </div>
                )}
                
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setCategoryOp({ type: null, categoryPath: null, categoryName: '', isSubmitting: false, error: null })}
                    className="px-4 py-2 border border-secondary-300 rounded-md text-sm font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    disabled={categoryOp.isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center"
                    disabled={categoryOp.isSubmitting || !categoryOp.categoryName.trim()}
                  >
                    {categoryOp.isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Renaming...
                      </>
                    ) : "Rename Category"}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Delete category modal */}
      <AnimatePresence>
        {categoryOp.type === 'delete' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-10"
              onClick={() => setCategoryOp({ type: null, categoryPath: null, categoryName: '', isSubmitting: false, error: null })}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-20 w-full max-w-md p-6"
            >
              <h3 className="text-lg font-medium text-secondary-900 mb-2">Delete Category</h3>
              
              <p className="text-sm text-secondary-600 mb-4">
                Are you sure you want to delete the category "{categoryOp.categoryName}"? All files in this category will be moved to the root category.
              </p>
              
              {categoryOp.error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
                  {categoryOp.error}
                </div>
              )}
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setCategoryOp({ type: null, categoryPath: null, categoryName: '', isSubmitting: false, error: null })}
                  className="px-4 py-2 border border-secondary-300 rounded-md text-sm font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  disabled={categoryOp.isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteCategory}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 flex items-center"
                  disabled={categoryOp.isSubmitting}
                >
                  {categoryOp.isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting...
                    </>
                  ) : "Delete Category"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Move document modal */}
      <AnimatePresence>
        {moveDocumentOp.isMoving && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-10"
              onClick={() => setMoveDocumentOp({ isMoving: false, documentId: null, selectedCategory: null })}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-20 w-full max-w-md p-6"
            >
              <h3 className="text-lg font-medium text-secondary-900 mb-4">Move to Category</h3>
              
              <div className="mb-4">
                <label htmlFor="category-select" className="block text-sm font-medium text-secondary-700 mb-1">
                  Select Category
                </label>
                <select
                  id="category-select"
                  value={moveDocumentOp.selectedCategory || ""}
                  onChange={e => setMoveDocumentOp(prev => ({ ...prev, selectedCategory: e.target.value }))}
                  className="block w-full border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                >
                  <option value="">-- Select a category --</option>
                  {categories.map(category => (
                    <option key={category.path} value={category.path}>
                      {category.name} ({category.count} files)
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setMoveDocumentOp({ isMoving: false, documentId: null, selectedCategory: null })}
                  className="px-4 py-2 border border-secondary-300 rounded-md text-sm font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleMoveDocument}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  disabled={!moveDocumentOp.selectedCategory}
                >
                  Move Document
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IndexedFilesPanel;
