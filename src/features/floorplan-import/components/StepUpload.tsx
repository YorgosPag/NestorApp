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
import { CheckCircle2, AlertCircle, Loader2, Compass } from 'lucide-react';
import type { SceneUnits } from '@/subapps/dxf-viewer/utils/scene-units';
import { Button } from '@/components/ui/button';
import { DxfUnitsSelector } from './DxfUnitsSelector';
import { FileUploadZone } from '@/components/shared/files/FileUploadZone';
import { CalibrateScaleDialog } from '@/components/shared/files/media/CalibrateScaleDialog';
import { useBackgroundScale } from '@/hooks/useBackgroundScale';
import { useFloorplanSmartUpload } from '../hooks/useFloorplanSmartUpload';
import type {
  FloorWipePreview,
  FloorplanFormat,
  SmartUploadResult,
  SmartUploadOptions,
} from '../hooks/useFloorplanSmartUpload';
import type { FloorplanUploadConfig } from '@/hooks/useFloorplanUpload';
import { FileRecordService } from '@/services/file-record.service';
import { useIconSizes } from '@/hooks/useIconSizes';
import { FLOORPLAN_ACCEPT } from '@/config/file-upload-config';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FileRecord } from '@/types/file-record';
import '@/lib/design-system';
import {
  PreviewBanner,
  ExistingFileWarning,
  ProgressBar,
  WipeConfirmDialog,
} from './StepUploadPanels';

// =============================================================================
// TYPES
// =============================================================================

interface StepUploadProps {
  config: FloorplanUploadConfig;
  /** fileId is the FileRecord ID created during upload — passed so callers can link the scene to the level.
   * `format` lets callers branch on payload type (DXF vs raster) — raster must NOT trigger DXF scene wiring.
   * `userDrawingUnits` is the ADR-368 unit override (absent when 'auto' or non-DXF). */
  onComplete: (file: File, fileId?: string, format?: FloorplanFormat, userDrawingUnits?: SceneUnits) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

/** Safe zero-state preview — used when the preview fetch fails so the upload
 * flow never deadlocks waiting on a `null` preview (defaults to keep-BIM). */
const ZERO_PREVIEW: FloorWipePreview = {
  floorplanOverlayCount: 0,
  floorplanBackgroundCount: 0,
  fileRecordCount: 0,
  totalPolygons: 0,
  bimEntityCount: 0,
  boqItemCount: 0,
};

// =============================================================================
// COMPONENT
// =============================================================================

export function StepUpload({ config, onComplete }: StepUploadProps) {
  const smart = useFloorplanSmartUpload(config);
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const { t } = useTranslation(['files', 'files-media']);

  // ADR-368: user-specified DXF coordinate units (default = auto-detect)
  const [selectedUnits, setSelectedUnits] = useState<SceneUnits | 'auto'>('auto');

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
  // Depend on the STABLE `fetchPreview` callback, never the `smart` object —
  // the hook returns a fresh object every render, so `[floorId, smart]` tore
  // the effect down on every re-render and, combined with a boolean run-once
  // guard, permanently deadlocked the spinner (2026-06-07 fix).
  const { fetchPreview } = smart;
  const [preview, setPreview] = useState<FloorWipePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(Boolean(floorId));
  // Tracks the floorId whose preview has RESOLVED. Set only on completion, so a
  // mid-flight cancellation lets a fresh effect re-fetch instead of hanging.
  const previewedFloorIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!floorId || previewedFloorIdRef.current === floorId) return;
    let cancelled = false;
    setPreviewLoading(true);
    (async () => {
      try {
        const p = await fetchPreview(floorId);
        if (cancelled) return;
        setPreview(p);
      } catch {
        // Never deadlock the upload flow on a failed preview — fall back to a
        // zero-state (treated as "nothing known to wipe", keep BIM by default).
        if (cancelled) return;
        setPreview(ZERO_PREVIEW);
      } finally {
        if (!cancelled) {
          previewedFloorIdRef.current = floorId;
          setPreviewLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [floorId, fetchPreview]);

  // ── Existing-file check (non-floor only — legacy UX) ──
  // Depend on stable config PRIMITIVES, never the `config` object (a fresh
  // identity each render would tear the effect down and deadlock the spinner,
  // same class as the preview race above). Guard by a value key, set on
  // completion so a cancelled run can recover.
  const { entityType, entityId, companyId, category, purpose, levelFloorId } = config;
  const [existingFile, setExistingFile] = useState<FileRecord | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(!floorId);
  const checkedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (floorId) return;
    const key = `${entityType}:${entityId}:${levelFloorId ?? ''}`;
    if (checkedKeyRef.current === key) return;
    let cancelled = false;
    setCheckingExisting(true);
    (async () => {
      try {
        const files = await FileRecordService.getFilesByEntity(
          entityType,
          entityId,
          { companyId, category, purpose, levelFloorId },
        );
        if (cancelled) return;
        if (files.length > 0) setExistingFile(files[0]);
      } finally {
        if (!cancelled) {
          checkedKeyRef.current = key;
          setCheckingExisting(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [floorId, entityType, entityId, companyId, category, purpose, levelFloorId]);

  // ── Confirm dialog state ──
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const hasBimContent =
    preview !== null && (preview.bimEntityCount > 0 || preview.boqItemCount > 0);
  const wipeRequired = preview !== null && (
    preview.totalPolygons > 0 ||
    preview.floorplanBackgroundCount > 0 ||
    preview.fileRecordCount > 0 ||
    hasBimContent
  );

  const performUpload = useCallback(async (file: File, opts?: SmartUploadOptions) => {
    const result: SmartUploadResult = await smart.uploadSmart(file, opts);
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
      // ADR-368: pass unit override only when user made an explicit choice
      const unitOverride = selectedUnits !== 'auto' ? selectedUnits : undefined;
      onComplete(file, result.fileId, result.format, unitOverride);
    }
  }, [smart, floorId, existingFile, config.userId, onComplete, selectedUnits]);

  const handleUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];

    // Floor-level: NEVER upload until the preview has resolved. Otherwise a
    // slow preview leaves `wipeRequired=false` and the confirm dialog is
    // skipped → silent wipe (the 2026-06-07 race). Stash + continue via effect.
    if (floorId && (previewLoading || preview === null)) {
      setPendingFile(file);
      return;
    }
    if (floorId && wipeRequired) {
      setPendingFile(file);
      return;
    }
    await performUpload(file);
  }, [floorId, previewLoading, preview, wipeRequired, performUpload]);

  // Continue a file stashed while the preview was still loading: once resolved,
  // auto-upload when there is nothing to wipe; otherwise the confirm dialog
  // renders (it is gated on a non-null preview).
  useEffect(() => {
    if (!floorId || pendingFile === null || previewLoading || preview === null) return;
    if (!wipeRequired) {
      const file = pendingFile;
      setPendingFile(null);
      void performUpload(file);
    }
  }, [floorId, pendingFile, previewLoading, preview, wipeRequired, performUpload]);

  const handleConfirm = useCallback(async (wipeBim: boolean) => {
    if (!pendingFile) return;
    const file = pendingFile;
    setPendingFile(null);
    await performUpload(file, { wipeBim });
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
          <CheckCircle2 className={`${iconSizes.xl3} text-[hsl(var(--text-success))]`} />
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

      {/* ── ADR-368: DXF coordinate units selector ── */}
      <DxfUnitsSelector
        value={selectedUnits}
        onChange={setSelectedUnits}
        colors={colors}
        t={t}
      />

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
        hasBim={hasBimContent}
        onConfirm={handleConfirm}
        onCancel={handleCancelWipe}
        t={t}
      />
    </div>
  );
}

