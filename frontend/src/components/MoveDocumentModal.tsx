import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Category } from '../services/api';

interface MoveDocumentOperation {
  isMoving: boolean;
  documentId: string | null;
  selectedCategory: string | null;
}

interface MoveDocumentModalProps {
  operation: MoveDocumentOperation;
  categories: Category[];
  onClose: () => void;
  onCategoryChange: (categoryPath: string) => void;
  onConfirm: () => void;
}

const MoveDocumentModal: React.FC<MoveDocumentModalProps> = ({
  operation,
  categories,
  onClose,
  onCategoryChange,
  onConfirm,
}) => {
  return (
    <AnimatePresence>
      {operation.isMoving && (
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
            <h3 className="text-base font-medium text-secondary-900 mb-3">Move to Category</h3>
            
            <div className="mb-4">
              <label htmlFor="category-select" className="block text-xs font-medium text-secondary-700 mb-1">
                Select Category
              </label>
              <select
                id="category-select"
                value={operation.selectedCategory || ""}
                onChange={e => onCategoryChange(e.target.value)}
                className="block w-full border-secondary-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-sm px-3 py-2"
              >
                <option value="">-- Select a category --</option>
                {categories.map(category => (
                  <option key={category.path} value={category.path}>
                    {category.name} ({category.count} files)
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 border border-secondary-300 rounded-md text-xs font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className="px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                disabled={!operation.selectedCategory}
              >
                Move Document
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MoveDocumentModal;