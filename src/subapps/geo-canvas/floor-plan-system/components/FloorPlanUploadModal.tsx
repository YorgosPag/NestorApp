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

import React, { useCallback } from 'react';
import { Clock } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslationLazy } from '@/i18n/hooks/useTranslationLazy';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { CraneIcon } from '@/subapps/dxf-viewer/components/icons';
import { FloorPlanPreview } from './FloorPlanPreview';
import type { ParserResult } from '../types';
// 🏢 ADR-054: Centralized upload component
import { FileUploadZone } from '@/components/shared/files/FileUploadZone';

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

// 🏢 ADR-054: Accept string for FileUploadZone (file validation handled by centralized system)
const FLOOR_PLAN_ACCEPT = '.dxf,.dwg,.pdf,.png,.jpg,.jpeg,.tiff,.tif';

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
  const iconSizes = useIconSizes();
  const { quick, getStatusBorder } = useBorderTokens();
  const colors = useSemanticColors();
  const { t } = useTranslationLazy('geo-canvas');

  /**
   * 🏢 ADR-054: File upload handler - receives validated files from FileUploadZone
   * Compression disabled for floor plans (CAD files should not be compressed)
   */
  const handleFileUpload = useCallback(async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0]; // Floor plan upload is single file
      console.log('✅ File selected:', file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
      onFileSelect(file);
      // Don't close modal - let it show preview after parsing completes
    }
  }, [onFileSelect]);

  // ❗ CRITICAL: Stable onOpenChange callback (prevents infinite loop)
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      onClose();
    }
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={`sm:max-w-[600px] ${colors.bg.secondary} text-white ${quick.card}`}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-blue-400 flex items-center gap-2">
            <CraneIcon className={iconSizes.lg} />
            {t('floorPlan.uploadModal.title')}
          </DialogTitle>
          <DialogDescription className={colors.text.muted}>
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
            <Clock className="animate-spin text-6xl mb-4" />
            <p className="text-lg font-medium text-white mb-2">
              Parsing file...
            </p>
            <p className={`text-sm ${colors.text.muted}`}>
              Please wait while we process your floor plan
            </p>
          </div>
        ) : (
          /* Show upload form - ADR-054: Using centralized FileUploadZone */
          <>
            {/* 🏢 ADR-054: Centralized FileUploadZone with drag & drop */}
            <FileUploadZone
              onUpload={handleFileUpload}
              accept={FLOOR_PLAN_ACCEPT}
              multiple={false}
              enableCompression={false} // Floor plans should not be compressed
            />

            {/* Supported Formats Info */}
            <div className={`${colors.bg.primary} rounded-lg p-4`}>
              <p className={`text-sm font-medium ${colors.text.secondary} mb-2`}>
                {t('floorPlan.uploadModal.supportedFormats')}
              </p>
              <div className="flex flex-wrap gap-2">
                {['DXF', 'DWG', 'PDF', 'PNG', 'JPG', 'TIFF'].map((format) => (
                  <span
                    key={format}
                    className={`px-3 py-1 ${colors.bg.hover} ${colors.text.secondary} text-xs rounded-full`}
                  >
                    {format}
                  </span>
                ))}
              </div>
              <p className={`text-xs ${colors.text.tertiary} mt-3`}>
                {t('floorPlan.uploadModal.maxSize')}
              </p>
            </div>
          </>
        )}

        <DialogFooter>
          <button
            onClick={onClose}
            className="
              px-4 py-2
              ${colors.bg.hover}
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
