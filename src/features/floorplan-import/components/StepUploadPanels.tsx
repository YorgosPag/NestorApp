'use client';

/**
 * Presentational subcomponents for StepUpload.
 * Extracted to keep StepUpload under 500 lines (N.7.1).
 *
 * @module features/floorplan-import/components/StepUploadPanels
 */

import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import type { FloorWipePreview } from '../hooks/useFloorplanSmartUpload';
import type { FileRecord } from '@/types/file-record';

// =============================================================================
// SHARED TYPES
// =============================================================================

/** Minimal translation function signature shared by all panels. */
export interface TFn {
  (key: string, options?: Record<string, unknown>): string;
}

// =============================================================================
// PreviewBanner
// =============================================================================

interface PreviewBannerProps {
  preview: FloorWipePreview;
  t: TFn;
}

/** Warning banner shown above the upload zone when the floor has existing content to wipe. */
export function PreviewBanner({ preview, t }: PreviewBannerProps) {
  const hasBim = preview.bimEntityCount > 0 || preview.boqItemCount > 0;
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-[hsl(var(--bg-warning))]/40 px-3 py-2.5 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--text-warning))]" />
      <div className="space-y-0.5">
        <p className="font-medium text-[hsl(var(--text-warning))]">
          {t('floorplanImport.wipePreview.title')}
        </p>
        <p className="text-xs text-[hsl(var(--text-warning))]">
          {t('floorplanImport.wipePreview.summary', {
            polygons: preview.totalPolygons,
            backgrounds: preview.floorplanBackgroundCount,
            files: preview.fileRecordCount,
          })}
        </p>
        {hasBim && (
          <p className="text-xs text-[hsl(var(--text-warning))]">
            {t('floorplanImport.wipePreview.bimLine', {
              bim: preview.bimEntityCount,
              boq: preview.boqItemCount,
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ExistingFileWarning
// =============================================================================

interface ExistingFileWarningProps {
  file: FileRecord;
  t: TFn;
}

/** Warning banner shown when a non-floor entity already has an uploaded file (legacy flow). */
export function ExistingFileWarning({ file, t }: ExistingFileWarningProps) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-[hsl(var(--bg-warning))]/40 px-3 py-2.5 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--text-warning))]" />
      <div className="space-y-0.5">
        <p className="font-medium text-[hsl(var(--text-warning))]">
          {t('floorplanImport.existingFloorplan.warning')}
        </p>
        <p className="text-xs text-[hsl(var(--text-warning))]">
          {t('floorplanImport.existingFloorplan.details')}
        </p>
        {file.originalFilename && (
          <p className="text-xs font-medium text-[hsl(var(--text-warning))]">
            {t('floorplanImport.existingFloorplan.fileName', { fileName: file.originalFilename })}
          </p>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// ProgressBar
// =============================================================================

interface ProgressBarProps {
  progress: number;
  colors: ReturnType<typeof useSemanticColors>;
  t: TFn;
}

/** Animated upload progress bar with percentage label. */
export function ProgressBar({ progress, colors, t }: ProgressBarProps) {
  return (
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
  );
}

// =============================================================================
// WipeConfirmDialog
// =============================================================================

interface WipeConfirmDialogProps {
  open: boolean;
  preview: FloorWipePreview | null;
  fileName: string;
  /** Floor has BIM entities/BOQ → offer the keep-vs-delete choice (ADR-420). */
  hasBim: boolean;
  onConfirm: (wipeBim: boolean) => void;
  onCancel: () => void;
  t: TFn;
}

/** Confirmation dialog shown before wiping existing floor content on re-upload. */
export function WipeConfirmDialog({
  open, preview, fileName, hasBim, onConfirm, onCancel, t,
}: WipeConfirmDialogProps) {
  if (!preview) return null;
  const totalBackgrounds = preview.floorplanBackgroundCount;
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('floorplanImport.wipeDialog.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('floorplanImport.wipeDialog.description', {
              fileName,
              polygons: preview.totalPolygons,
              backgrounds: totalBackgrounds,
              files: preview.fileRecordCount,
            })}
          </AlertDialogDescription>
          {hasBim && (
            <p className="text-sm font-medium text-[hsl(var(--text-warning))]">
              {t('floorplanImport.wipeDialog.bimWarning', {
                bim: preview.bimEntityCount,
                boq: preview.boqItemCount,
              })}
            </p>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t('floorplanImport.wipeDialog.cancel')}
          </AlertDialogCancel>
          {hasBim ? (
            <>
              <AlertDialogAction onClick={() => onConfirm(false)}>
                {t('floorplanImport.wipeDialog.keepBim')}
              </AlertDialogAction>
              <AlertDialogAction
                onClick={() => onConfirm(true)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('floorplanImport.wipeDialog.wipeBim')}
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction onClick={() => onConfirm(false)}>
              {t('floorplanImport.wipeDialog.confirm')}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
