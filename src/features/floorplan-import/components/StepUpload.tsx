'use client';

/**
 * =============================================================================
 * SPEC-237D: Upload Step (Step 6)
 * =============================================================================
 *
 * Wraps FileUploadZone + useFloorplanUpload for the final wizard step.
 * Shows: drag & drop → progress bar → success/error.
 *
 * @module features/floorplan-import/components/StepUpload
 */

import React, { useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileUploadZone } from '@/components/shared/files/FileUploadZone';
import { useFloorplanUpload } from '@/hooks/useFloorplanUpload';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from 'react-i18next';

// =============================================================================
// TYPES
// =============================================================================

interface StepUploadProps {
  config: FloorplanUploadConfig;
  onComplete: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const FLOORPLAN_ACCEPT = '.dxf,.pdf,.jpg,.jpeg,.png';
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

// =============================================================================
// COMPONENT
// =============================================================================

export function StepUpload({ config, onComplete }: StepUploadProps) {
  const { uploadFloorplan, isUploading, progress, error, clearError } = useFloorplanUpload(config);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation('files');

  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0]; // Single file upload
    const result = await uploadFloorplan(file);

    if (result.success) {
      setUploadSuccess(true);
      onComplete();
    }
  }, [uploadFloorplan, onComplete]);

  const handleRetry = useCallback(() => {
    clearError();
    setUploadSuccess(false);
  }, [clearError]);

  // ── Success state ──
  if (uploadSuccess) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <CheckCircle2 className={`${iconSizes.xl3} text-emerald-500`} />
        <p className="text-sm font-medium">{t('floorplanImport.success')}</p>
      </div>
    );
  }

  // ── Error state ──
  if (error && !isUploading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <AlertCircle className={`${iconSizes.xl3} text-destructive`} />
        <p className="text-sm font-medium text-destructive">{t('floorplanImport.error')}</p>
        <p className={`text-xs ${colors.text.muted}`}>{error}</p>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          {t('floorplanImport.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {/* ── Upload zone ── */}
      <FileUploadZone
        onUpload={handleUpload}
        accept={FLOORPLAN_ACCEPT}
        maxSize={MAX_SIZE_BYTES}
        multiple={false}
        uploading={isUploading}
        enableCompression={false}
      />

      {/* ── Progress bar ── */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className={colors.text.muted}>{t('floorplanImport.uploading')}</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              /* Tailwind width set via style because progress is dynamic 0-100 */
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Accepted types hint ── */}
      {!isUploading && (
        <p className={`text-center text-xs ${colors.text.muted}`}>
          {t('floorplanImport.acceptedTypes')}
        </p>
      )}
    </div>
  );
}
