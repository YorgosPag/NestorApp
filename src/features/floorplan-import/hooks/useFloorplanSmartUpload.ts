'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: Floorplan Smart Upload Hook (ADR-340 Phase 4 reborn)
 * =============================================================================
 *
 * Single upload entry point for the Wizard. Detects format (DXF / PDF / Image)
 * and routes to the correct backend, with a unified pre-flight wipe of any
 * existing floor state (background, polygons, dxf levels, files, storage).
 *
 * Branches:
 *   - DXF        → legacy `useFloorplanUpload` pipeline (cadFiles processor).
 *   - PDF/Image  → ADR-340 `floorplan-backgrounds` API (rbg_xxx + overlays).
 *
 * Wipe semantics: when the target floor has any prior content, the user sees
 * a single confirm dialog ("N polygons + 1 background will be deleted").
 * Confirm → HARD wipe (no trash) → upload. Skip dialog when nothing exists.
 *
 * Constraints:
 *   - PDF/Image require a floorId. For `entityType='floor'` use `entityId`,
 *     for `entityType='unit'` use `levelFloorId`. Other entity types accept
 *     DXF only.
 *
 * @module features/floorplan-import/hooks/useFloorplanSmartUpload
 * @enterprise ADR-340 Phase 4 reborn
 */

import { useCallback, useState } from 'react';
import { apiClient } from '@/lib/api/enterprise-api-client';
import { FloorplanBackgroundApiClient } from '@/subapps/dxf-viewer/floorplan-background/services/floorplan-background-api-client';
import { providerRegistry } from '@/subapps/dxf-viewer/floorplan-background/providers/provider-registry';
import { registerProviders } from '@/subapps/dxf-viewer/floorplan-background/providers/register-providers';
import type {
  ProviderId,
  ProviderMetadata,
} from '@/subapps/dxf-viewer/floorplan-background/providers/types';
import { useFloorplanUpload } from '@/hooks/useFloorplanUpload';
import type {
  FloorplanUploadConfig,
  FloorplanUploadResult,
} from '@/hooks/useFloorplanUpload';
import { createModuleLogger } from '@/lib/telemetry';
import { getErrorMessage } from '@/lib/error-utils';

const logger = createModuleLogger('useFloorplanSmartUpload');

// ============================================================================
// TYPES
// ============================================================================

export type FloorplanFormat = 'dxf' | 'pdf' | 'image' | 'unknown';

export interface FloorWipePreview {
  floorplanOverlayCount: number;
  floorplanBackgroundCount: number;
  fileRecordCount: number;
  totalPolygons: number;
}

export interface SmartUploadResult {
  success: boolean;
  fileId?: string;
  format: FloorplanFormat;
  error?: string;
}

export interface UseFloorplanSmartUploadReturn {
  uploadSmart: (file: File) => Promise<SmartUploadResult>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  clearError: () => void;
  detectFormat: (file: File) => FloorplanFormat;
  resolveFloorId: () => string | null;
  fetchPreview: (floorId: string) => Promise<FloorWipePreview>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DXF_EXTS = new Set(['dxf']);
const PDF_EXTS = new Set(['pdf']);
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp']);
const PDF_MIMES = new Set(['application/pdf']);
const DXF_MIMES = new Set(['application/dxf', 'image/vnd.dxf']);
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

// ============================================================================
// HELPERS
// ============================================================================

function getExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.substring(i + 1).toLowerCase() : '';
}

export function detectFloorplanFormat(file: File): FloorplanFormat {
  const ext = getExt(file.name);
  const mime = file.type;
  if (DXF_EXTS.has(ext) || DXF_MIMES.has(mime)) return 'dxf';
  if (PDF_EXTS.has(ext) || PDF_MIMES.has(mime)) return 'pdf';
  if (IMAGE_EXTS.has(ext) || IMAGE_MIMES.has(mime)) return 'image';
  return 'unknown';
}

function coerceProviderMetadata(raw: Record<string, unknown> | undefined): ProviderMetadata {
  const out: ProviderMetadata = {
    imageDecoderUsed: raw?.imageDecoderUsed === 'utif' ? 'utif' : 'native',
  };
  if (typeof raw?.pdfPageNumber === 'number') out.pdfPageNumber = raw.pdfPageNumber;
  if (typeof raw?.imageOrientation === 'number') out.imageOrientation = raw.imageOrientation;
  if (typeof raw?.imageMimeType === 'string') out.imageMimeType = raw.imageMimeType;
  return out;
}

async function loadNaturalBoundsFromProvider(
  file: File,
  providerId: ProviderId,
): Promise<{ width: number; height: number; metadata: ProviderMetadata }> {
  registerProviders();
  const provider = providerRegistry.get(providerId);
  try {
    const result = await provider.loadAsync({ kind: 'file', file });
    if (!result.success || !result.bounds) {
      throw new Error(result.error ?? `Provider ${providerId} failed to load`);
    }
    return {
      width: result.bounds.width,
      height: result.bounds.height,
      metadata: coerceProviderMetadata(result.metadata),
    };
  } finally {
    provider.dispose();
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useFloorplanSmartUpload(
  config: FloorplanUploadConfig,
): UseFloorplanSmartUploadReturn {
  const legacy = useFloorplanUpload(config);
  const [rasterUploading, setRasterUploading] = useState(false);
  const [rasterError, setRasterError] = useState<string | null>(null);

  const detectFormat = useCallback((file: File) => detectFloorplanFormat(file), []);

  const resolveFloorId = useCallback((): string | null => {
    if (config.entityType === 'floor') return config.entityId;
    if (config.entityType === 'property' && config.levelFloorId) return config.levelFloorId;
    return null;
  }, [config.entityType, config.entityId, config.levelFloorId]);

  const fetchPreview = useCallback(
    async (floorId: string): Promise<FloorWipePreview> => {
      const params = new URLSearchParams({ floorId });
      const res = await apiClient.get<{ preview: FloorWipePreview }>(
        `/api/floorplans/wipe-floor?${params.toString()}`,
      );
      return res.preview;
    },
    [],
  );

  const wipeFloor = useCallback(async (floorId: string): Promise<void> => {
    await apiClient.post('/api/floorplans/wipe-floor', { floorId });
  }, []);

  const uploadRaster = useCallback(
    async (
      file: File,
      format: 'pdf' | 'image',
      floorId: string,
    ) => {
      const providerId: ProviderId = format === 'pdf' ? 'pdf-page' : 'image';
      const { width, height, metadata } = await loadNaturalBoundsFromProvider(
        file,
        providerId,
      );
      return FloorplanBackgroundApiClient.upload({
        file,
        floorId,
        projectId: config.projectId,
        providerId,
        naturalWidth: width,
        naturalHeight: height,
        providerMetadata: metadata,
      });
    },
    [config.projectId],
  );

  const uploadSmart = useCallback(
    async (file: File): Promise<SmartUploadResult> => {
      setRasterError(null);
      const format = detectFloorplanFormat(file);

      if (format === 'unknown') {
        const msg = 'Unsupported file format';
        setRasterError(msg);
        return { success: false, format, error: msg };
      }

      const floorId = resolveFloorId();

      // ── Wipe pre-flight (only when we have a target floorId) ────────────
      if (floorId) {
        try {
          await wipeFloor(floorId);
        } catch (err) {
          const msg = getErrorMessage(err, 'Wipe failed');
          setRasterError(msg);
          return { success: false, format, error: msg };
        }
      }

      // ── DXF branch (legacy pipeline) ────────────────────────────────────
      if (format === 'dxf') {
        const r: FloorplanUploadResult = await legacy.uploadFloorplan(file);
        return {
          success: r.success,
          fileId: r.fileRecord?.id,
          format,
          error: r.error,
        };
      }

      // ── Raster branches require a floorId ───────────────────────────────
      if (!floorId) {
        const msg = 'PDF / image floorplans are supported only at floor level';
        setRasterError(msg);
        return { success: false, format, error: msg };
      }

      setRasterUploading(true);
      try {
        const res = await uploadRaster(file, format, floorId);
        return { success: true, fileId: res.fileRecord.id, format };
      } catch (err) {
        const msg = getErrorMessage(err, 'Upload failed');
        logger.error('Raster upload failed', { format, error: msg });
        setRasterError(msg);
        return { success: false, format, error: msg };
      } finally {
        setRasterUploading(false);
      }
    },
    [legacy, resolveFloorId, wipeFloor, uploadRaster],
  );

  const clearError = useCallback(() => {
    setRasterError(null);
    legacy.clearError();
  }, [legacy]);

  return {
    uploadSmart,
    isUploading: legacy.isUploading || rasterUploading,
    progress: legacy.progress,
    error: legacy.error ?? rasterError,
    clearError,
    detectFormat,
    resolveFloorId,
    fetchPreview,
  };
}
