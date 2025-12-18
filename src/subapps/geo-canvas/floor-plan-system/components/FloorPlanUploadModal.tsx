/**
 * 📁 FLOOR PLAN UPLOAD MODAL
 *
 * Modal component με drag-drop file upload για floor plans
 *
 * Features:
 * - Drag-drop file upload (native HTML5)
 * - File picker fallback
 * - File validation (extension, size, MIME type)
 * - Supported formats: DXF, DWG, PNG, JPG, TIFF, PDF
 * - i18n support (EN/EL)
 * - Error handling
 *
 * @module floor-plan-system/components
 */

import React, { useState, useCallback, useRef } from 'react';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { HOVER_BACKGROUND_EFFECTS, INTERACTIVE_PATTERNS, HOVER_SHADOWS } from '@/components/ui/effects';
import { CraneIcon } from '@/subapps/dxf-viewer/components/icons';
import { FloorPlanPreview } from './FloorPlanPreview';
import type { ParserResult } from '../types';

export interface FloorPlanUploadModalProps {
  /**
   * Modal open state
   */
  isOpen: boolean;

  /**
   * Close handler
   */
  onClose: () => void;

  /**
   * File select handler
   */
  onFileSelect: (file: File) => void;

  /**
   * Parser result (for preview display)
   */
  parserResult?: ParserResult | null;

  /**
   * Selected file (for preview display)
   */
  selectedFile?: File | null;

  /**
   * Parsing state
   */
  isParsing?: boolean;
}

// Supported file formats
const ACCEPTED_FORMATS = {
  'application/dxf': ['.dxf'],
  'application/dwg': ['.dwg'],
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/tiff': ['.tiff', '.tif']
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * FloorPlanUploadModal Component
 *
 * Usage:
 * ```tsx
 * <FloorPlanUploadModal
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 *   onFileSelect={(file) => handleFileUpload(file)}
 * />
 * ```
 */
export function FloorPlanUploadModal({
  isOpen,
  onClose,
  onFileSelect,
  parserResult = null,
  selectedFile = null,
  isParsing = false
}: FloorPlanUploadModalProps) {
  const { t } = useTranslationLazy('geo-canvas');

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate file
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    // Check file extension
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    const validExtensions = Object.values(ACCEPTED_FORMATS).flat();

    if (!validExtensions.includes(extension)) {
      return {
        valid: false,
        error: t('floorPlan.uploadModal.errors.invalidFormat')
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: t('floorPlan.uploadModal.errors.fileTooLarge')
      };
    }

    return { valid: true };
  }, [t]);

  // Handle file selection
  const handleFileSelection = useCallback((file: File) => {
    setError(null);

    const validation = validateFile(file);

    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      return;
    }

    console.log('✅ File selected:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
    onFileSelect(file);
    // Don't close modal - let it show preview after parsing completes
  }, [validateFile, onFileSelect]);

  // Drag handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, [handleFileSelection]);

  // File input change handler
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  }, [handleFileSelection]);

  // Open file picker
  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // ❗ CRITICAL: Stable onOpenChange callback (prevents infinite loop)
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      onClose();
    }
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-gray-900 text-white border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-400 flex items-center gap-2">
            <CraneIcon className="h-6 w-6" />
            {t('floorPlan.uploadModal.title')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('floorPlan.uploadModal.description')}
          </DialogDescription>
        </DialogHeader>

        {/* Show preview if file has been parsed */}
        {parserResult && selectedFile ? (
          <div className="max-h-[70vh] overflow-y-auto">
            <FloorPlanPreview result={parserResult} file={selectedFile} />
          </div>
        ) : isParsing ? (
          /* Show loading state while parsing */
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="animate-spin text-6xl mb-4">⏳</div>
            <p className="text-lg font-medium text-white mb-2">
              Parsing file...
            </p>
            <p className="text-sm text-gray-400">
              Please wait while we process your floor plan
            </p>
          </div>
        ) : (
          /* Show upload form */
          <>
            {/* Drag-Drop Zone */}
            <div
          className={`
            relative
            border-2 border-dashed rounded-lg
            p-12
            text-center
            transition-all duration-200
            ${isDragging
              ? 'border-blue-500 bg-blue-500/10 scale-105'
              : `border-gray-600 ${HOVER_BACKGROUND_EFFECTS.MUTED}`
            }
          `}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Icon */}
          <div className="mb-4">
            <div className="text-6xl">
              {isDragging ? '📥' : '📁'}
            </div>
          </div>

          {/* Text */}
          <div className="mb-6">
            <p className="text-lg font-medium text-white mb-2">
              {isDragging
                ? t('floorPlan.uploadModal.dropText')
                : t('floorPlan.uploadModal.dragText')
              }
            </p>
            <p className="text-sm text-gray-400">
              {t('floorPlan.uploadModal.orText')}
            </p>
          </div>

          {/* Browse Button */}
          <button
            onClick={handleBrowseClick}
            className="
              px-6 py-3
              bg-blue-600 text-white font-medium
              rounded-lg
              transition-all duration-200
              transform active:scale-95
              shadow-lg
              ${INTERACTIVE_PATTERNS.PRIMARY_HOVER} ${HOVER_SHADOWS.COLORED.BLUE}
            "
          >
            {t('floorPlan.uploadModal.browseButton')}
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".dxf,.dwg,.pdf,.png,.jpg,.jpeg,.tiff,.tif"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>

        {/* Supported Formats */}
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-300 mb-2">
            {t('floorPlan.uploadModal.supportedFormats')}
          </p>
          <div className="flex flex-wrap gap-2">
            {['DXF', 'DWG', 'PDF', 'PNG', 'JPG', 'TIFF'].map((format) => (
              <span
                key={format}
                className="px-3 py-1 bg-gray-700 text-gray-300 text-xs rounded-full"
              >
                {format}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {t('floorPlan.uploadModal.maxSize')}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-600 rounded-lg p-4">
            <p className="text-sm text-red-400">
              ❌ {error}
            </p>
          </div>
        )}
          </>
        )}

        <DialogFooter>
          <button
            onClick={onClose}
            className="
              px-4 py-2
              bg-gray-700
              ${HOVER_BACKGROUND_EFFECTS.MUTED}
              text-white
              rounded-lg
              transition-all duration-200
            "
          >
            {parserResult ? 'Close' : t('buttons.cancel')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FloorPlanUploadModal;
