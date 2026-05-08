'use client';

/**
 * =============================================================================
 * SPEC-237D + ADR-340 Phase 4 reborn: Upload Step (Step 6)
 * =============================================================================
 *
 * Single upload entry point — accepts DXF, PDF, Image. Smart routing internally.
 *
 * Floor-level flow:
 *   1. Detect format (dxf / pdf / image / unknown).
 *   2. Fetch wipe preview (polygons + backgrounds + dxf levels + files).
 *   3. If anything to wipe → confirm dialog ("N polygons, M backgrounds…").
 *   4. Confirm → HARD wipe → upload via correct backend.
 *
 * Non-floor flow (project / building / unit-without-level):
 *   - Only DXF accepted (legacy pipeline). Existing-file warning preserved.
 *
 * @module features/floorplan-import/components/StepUpload
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Loader2, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { FileUploadZone } from '@/components/shared/files/FileUploadZone';
import { CalibrateScaleDialog } from '@/components/shared/files/media/CalibrateScaleDialog';
import { useBackgroundScale } from '@/hooks/useBackgroundScale';
import { useFloorplanSmartUpload } from '../hooks/useFloorplanSmartUpload';
import type {
  FloorWipePreview,
  FloorplanFormat,
  SmartUploadResult,
} from '../hooks/useFloorplanSmartUpload';
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
  /** fileId is the FileRecord ID created during upload — passed so callers can link the scene to the level.
   * `format` lets callers branch on payload type (DXF vs raster) — raster must NOT trigger DXF scene wiring. */
  onComplete: (file: File, fileId?: string, format?: FloorplanFormat) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

// =============================================================================
// COMPONENT
// =============================================================================

export function StepUpload({ config, onComplete }: StepUploadProps) {
  const smart = useFloorplanSmartUpload(config);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['files', 'files-media']);

  const [uploadSuccess, setUploadSuccess] = useState(false);
  const floorId = smart.resolveFloorId();

  // ── ADR-340 Phase 9 STEP I follow-up (a): post-upload calibration prompt ──
  // Image only (v1). PDF + DXF defer to gallery Compass affordance — PDF can't
  // be rendered as <img> directly; DXF requires server-side $INSUNITS parsing.
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFormat, setUploadedFormat] = useState<FloorplanFormat | null>(null);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const [calibrateSkipped, setCalibrateSkipped] = useState(false);
  const calibrateFloorId = uploadSuccess && uploadedFormat === 'image' ? floorId : null;
  const { backgroundId: calibrateBackgroundId, isCalibrated } = useBackgroundScale(calibrateFloorId);
  const calibrateImageSrc = React.useMemo(() => {
    if (!uploadedFile || uploadedFormat !== 'image') return null;
    return URL.createObjectURL(uploadedFile);
  }, [uploadedFile, uploadedFormat]);
  useEffect(() => {
    return () => {
      if (calibrateImageSrc) URL.revokeObjectURL(calibrateImageSrc);
    };
  }, [calibrateImageSrc]);

  // ── Wipe preview (floor-level only) ──
  const [preview, setPreview] = useState<FloorWipePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(Boolean(floorId));
  const previewRef = useRef(false);

  useEffect(() => {
    if (!floorId || previewRef.current) return;
    previewRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const p = await smart.fetchPreview(floorId);
        if (!cancelled) setPreview(p);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [floorId, smart]);

  // ── Existing-file check (non-floor only — legacy UX) ──
  const [existingFile, setExistingFile] = useState<FileRecord | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(!floorId);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (floorId || checkedRef.current) return;
    checkedRef.current = true;
    let cancelled = false;
    (async () => {
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
        if (!cancelled && files.length > 0) setExistingFile(files[0]);
      } finally {
        if (!cancelled) setCheckingExisting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [floorId, config]);

  // ── Confirm dialog state ──
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const wipeRequired = preview !== null && (
    preview.totalPolygons > 0 ||
    preview.floorplanBackgroundCount > 0 ||
    preview.dxfLevelCount > 0 ||
    preview.fileRecordCount > 0
  );

  const performUpload = useCallback(async (file: File) => {
    const result: SmartUploadResult = await smart.uploadSmart(file);
    if (result.success) {
      // Trash legacy non-floor file if replacing (best-effort)
      if (!floorId && existingFile) {
        try {
          await FileRecordService.moveToTrash(existingFile.id, config.userId);
        } catch {
          // non-blocking
        }
      }
      setUploadedFile(file);
      setUploadedFormat(result.format ?? null);
      setUploadSuccess(true);
      onComplete(file, result.fileId, result.format);
    }
  }, [smart, floorId, existingFile, config.userId, onComplete]);

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];

    if (floorId && wipeRequired) {
      setPendingFile(file);
      return;
    }
    await performUpload(file);
  }, [floorId, wipeRequired, performUpload]);

  const handleConfirmWipe = useCallback(async () => {
    if (!pendingFile) return;
    const file = pendingFile;
    setPendingFile(null);
    await performUpload(file);
  }, [pendingFile, performUpload]);

  const handleCancelWipe = useCallback(() => {
    setPendingFile(null);
  }, []);

  const handleRetry = useCallback(() => {
    smart.clearError();
    setUploadSuccess(false);
  }, [smart]);

  // ── Success state ──
  if (uploadSuccess) {
    const showCalibratePrompt =
      uploadedFormat === 'image' &&
      !!calibrateBackgroundId &&
      !!calibrateImageSrc &&
      !isCalibrated &&
      !calibrateSkipped;

    return (
      <>
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <CheckCircle2 className={`${iconSizes.xl3} text-emerald-500`} />
          <p className="text-sm font-medium">{t('floorplanImport.success')}</p>
          {showCalibratePrompt && (
            <section className="mt-4 flex flex-col items-center gap-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-medium">{t('floorplanImport.calibratePrompt.title')}</p>
              <p className={`text-xs ${colors.text.muted} text-center max-w-xs`}>
                {t('floorplanImport.calibratePrompt.description')}
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCalibrateSkipped(true)}>
                  {t('floorplanImport.calibratePrompt.skip')}
                </Button>
                <Button size="sm" onClick={() => setCalibrateOpen(true)}>
                  <Compass className="mr-1 h-4 w-4" aria-hidden="true" />
                  {t('floorplanImport.calibratePrompt.calibrate')}
                </Button>
              </div>
            </section>
          )}
        </div>
        {calibrateBackgroundId && calibrateImageSrc && (
          <CalibrateScaleDialog
            open={calibrateOpen}
            onOpenChange={setCalibrateOpen}
            backgroundId={calibrateBackgroundId}
            imageSrc={calibrateImageSrc}
            onCalibrated={() => setCalibrateSkipped(true)}
          />
        )}
      </>
    );
  }

  // ── Error state ──
  if (smart.error && !smart.isUploading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12">
        <AlertCircle className={`${iconSizes.xl3} text-destructive`} />
        <p className="text-sm font-medium text-destructive">{t('floorplanImport.error')}</p>
        <p className={`text-xs ${colors.text.muted}`}>{smart.error}</p>
        <Button variant="outline" size="sm" onClick={handleRetry}>
          {t('floorplanImport.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {/* ── Floor-level preview banner ── */}
      {floorId && previewLoading && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('floorplanImport.existingFloorplan.checking')}</span>
        </div>
      )}
      {floorId && !previewLoading && wipeRequired && (
        <PreviewBanner preview={preview!} t={t} />
      )}

      {/* ── Non-floor existing-file warning (legacy) ── */}
      {!floorId && checkingExisting && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t('floorplanImport.existingFloorplan.checking')}</span>
        </div>
      )}
      {!floorId && !checkingExisting && existingFile && (
        <ExistingFileWarning file={existingFile} t={t} />
      )}

      {/* ── Upload zone ── */}
      <FileUploadZone
        onUpload={handleUpload}
        accept={FLOORPLAN_ACCEPT}
        maxSize={MAX_SIZE_BYTES}
        multiple={false}
        uploading={smart.isUploading}
        enableCompression={false}
        typesHint={t('floorplanImport.acceptedTypes')}
      />

      {/* ── Progress bar ── */}
      {smart.isUploading && (
        <ProgressBar progress={smart.progress} colors={colors} t={t} />
      )}

      {!smart.isUploading && (
        <p className={`text-center text-xs ${colors.text.muted}`}>
          {t('floorplanImport.acceptedTypes')}
        </p>
      )}

      {/* ── Wipe confirm dialog ── */}
      <WipeConfirmDialog
        open={pendingFile !== null}
        preview={preview}
        fileName={pendingFile?.name ?? ''}
        onConfirm={handleConfirmWipe}
        onCancel={handleCancelWipe}
        t={t}
      />
    </div>
  );
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

interface TFn { (key: string, options?: Record<string, unknown>): string; }

function PreviewBanner({ preview, t }: { preview: FloorWipePreview; t: TFn }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-700 dark:bg-amber-950/40">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="space-y-0.5">
        <p className="font-medium text-amber-800 dark:text-amber-200">
          {t('floorplanImport.wipePreview.title')}
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {t('floorplanImport.wipePreview.summary', {
            polygons: preview.totalPolygons,
            backgrounds: preview.floorplanBackgroundCount + preview.dxfLevelCount,
            files: preview.fileRecordCount,
          })}
        </p>
      </div>
    </div>
  );
}

function ExistingFileWarning({ file, t }: { file: FileRecord; t: TFn }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm dark:border-amber-700 dark:bg-amber-950/40">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="space-y-0.5">
        <p className="font-medium text-amber-800 dark:text-amber-200">
          {t('floorplanImport.existingFloorplan.warning')}
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {t('floorplanImport.existingFloorplan.details')}
        </p>
        {file.originalFilename && (
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {t('floorplanImport.existingFloorplan.fileName', { fileName: file.originalFilename })}
          </p>
        )}
      </div>
    </div>
  );
}

interface ProgressBarProps {
  progress: number;
  colors: ReturnType<typeof useSemanticColors>;
  t: TFn;
}

function ProgressBar({ progress, colors, t }: ProgressBarProps) {
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

interface WipeConfirmDialogProps {
  open: boolean;
  preview: FloorWipePreview | null;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
  t: TFn;
}

function WipeConfirmDialog({
  open, preview, fileName, onConfirm, onCancel, t,
}: WipeConfirmDialogProps) {
  if (!preview) return null;
  const totalBackgrounds = preview.floorplanBackgroundCount + preview.dxfLevelCount;
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
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t('floorplanImport.wipeDialog.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('floorplanImport.wipeDialog.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
