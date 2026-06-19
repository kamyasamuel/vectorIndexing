import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CategoryOperation {
  type: 'rename' | 'delete' | null;
  categoryPath: string | null;
  categoryName: string;
  isSubmitting: boolean;
  error: string | null;
}

interface RenameCategoryModalProps {
  operation: CategoryOperation;
  onClose: () => void;
  onNameChange: (name: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const RenameCategoryModal: React.FC<RenameCategoryModalProps> = ({
  operation,
  onClose,
  onNameChange,
  onSubmit,
}) => {
  return (
    <AnimatePresence>
      {operation.type === 'rename' && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-40"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl z-50 w-full max-w-md p-5"
          >
            <h3 className="text-base font-medium text-secondary-900 mb-3">Rename Category</h3>
            
            <form onSubmit={onSubmit}>
              <div className="mb-4">
                <label htmlFor="rename-category-name" className="block text-xs font-medium text-secondary-700 mb-1">
                  New Category Name
                </label>
                <input
                  type="text"
                  id="rename-category-name"
                  value={operation.categoryName}
                  onChange={e => onNameChange(e.target.value)}
                  className="block w-full border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm px-3 py-2"
                  placeholder="Enter new category name"
                  autoFocus
                />
              </div>
              
              {operation.error && (
                <div className="mb-3 p-2 bg-red-50 text-red-700 text-xs rounded-md">
                  {operation.error}
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 border border-secondary-300 rounded-md text-xs font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  disabled={operation.isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center"
                  disabled={operation.isSubmitting || !operation.categoryName.trim()}
                >
                  {operation.isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
  );
};

export default RenameCategoryModal;