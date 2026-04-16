'use client';

/**
 * =============================================================================
 * SPEC-237D: Upload Step (Step 6)
 * =============================================================================
 *
 * Wraps FileUploadZone + useFloorplanUpload for the final wizard step.
 * Shows: drag & drop → progress bar → success/error.
 *
 * When a floorplan already exists for the target entity, shows a replacement
 * warning. On successful upload the old FileRecord is trashed (1 per entity).
 *
 * @module features/floorplan-import/components/StepUpload
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileUploadZone } from '@/components/shared/files/FileUploadZone';
import { useFloorplanUpload } from '@/hooks/useFloorplanUpload';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import { FileRecordService } from '@/services/file-record.service';
import { useIconSizes } from '@/hooks/useIconSizes';
import { FLOORPLAN_ACCEPT } from '@/config/file-upload-config';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FileRecord } from '@/types/file-record';
import '@/lib/design-system';

// =============================================================================
// TYPES
// =============================================================================

interface StepUploadProps {
  config: FloorplanUploadConfig;
  onComplete: (file: File) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

// =============================================================================
// COMPONENT
// =============================================================================

export function StepUpload({ config, onComplete }: StepUploadProps) {
  const { uploadFloorplan, isUploading, progress, error, clearError } = useFloorplanUpload(config);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['files', 'files-media']);

  const [uploadSuccess, setUploadSuccess] = useState(false);

  // ── Existing floorplan detection ──
  const [existingFile, setExistingFile] = useState<FileRecord | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    let cancelled = false;
    async function check() {
      try {
        const files = await FileRecordService.getFilesByEntity(
          config.entityType,
          config.entityId,
          {
            companyId: config.companyId,
            category: config.category,
            purpose: config.purpose,
            levelFloorId: config.levelFloorId,
          },
        );
        if (!cancelled && files.length > 0) {
          setExistingFile(files[0]);
        }
      } finally {
        if (!cancelled) setCheckingExisting(false);
      }
    }
    check();
    return () => { cancelled = true; };
  }, [config]);

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    const result = await uploadFloorplan(file);

    if (result.success) {
      // Trash old floorplan if replacing
      if (existingFile) {
        try {
          await FileRecordService.moveToTrash(existingFile.id, config.userId);
        } catch {
          // Non-blocking — old record stays but new one is active
        }
      }
      setUploadSuccess(true);
      onComplete(file);
    }
  }, [uploadFloorplan, onComplete, existingFile, config.userId]);

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
      {/* ── Existing floorplan warning ── */}
      {checkingExisting && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('floorplanImport.existingFloorplan.checking')}</span>
        </div>
      )}
      {!checkingExisting && existingFile && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-700 dark:bg-amber-950/40">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-0.5">
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {t('floorplanImport.existingFloorplan.warning')}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t('floorplanImport.existingFloorplan.details')}
            </p>
            {existingFile.originalFilename && (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {t('floorplanImport.existingFloorplan.fileName', { fileName: existingFile.originalFilename })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Upload zone ── */}
      <FileUploadZone
        onUpload={handleUpload}
        accept={FLOORPLAN_ACCEPT}
        maxSize={MAX_SIZE_BYTES}
        multiple={false}
        uploading={isUploading}
        enableCompression={false}
        typesHint={t('floorplanImport.acceptedTypes')}
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
