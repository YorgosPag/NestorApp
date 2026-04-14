/**
 * =============================================================================
 * ENTERPRISE: Floorplan Scene Loader Hook
 * =============================================================================
 *
 * Custom hook for loading DXF scene data with 4 fallback paths:
 *   A) V1 embedded scene in processedData
 *   B) V3 authenticated API
 *   C) JSON scene files (FloorplanSaveOrchestrator)
 *   D) Client-side DXF parsing
 *
 * Extracted from FloorplanGallery.tsx for SRP compliance (ADR-033).
 *
 * @module components/shared/files/media/useFloorplanSceneLoader
 */

import { useEffect, useState } from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { auth } from '@/lib/firebase';
import { API_ROUTES } from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { FileRecord, DxfSceneData, DxfSceneEntity } from '@/types/file-record';

// ============================================================================
// TYPES
// ============================================================================

interface FloorplanSceneLoaderResult {
  /** Loaded DXF scene data, or null if not loaded yet */
  loadedScene: DxfSceneData | null;
  /** Whether the scene is currently being loaded */
  isLoading: boolean;
  /** Error message from loading, or null */
  sceneError: string | null;
}

// ============================================================================
// LOGGER
// ============================================================================

const logger = createModuleLogger('useFloorplanSceneLoader');

// ============================================================================
// HOOK
// ============================================================================

/**
 * Load DXF scene data for a floorplan file using 4 fallback paths.
 * Returns loading state, loaded scene data, and any error.
 */
export function useFloorplanSceneLoader(
  currentFile: FileRecord | null,
  isDxf: boolean,
  fileExt: string,
): FloorplanSceneLoaderResult {
  const { t } = useTranslation(['files', 'files-media']);
  const [loadedScene, setLoadedScene] = useState<DxfSceneData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);

  useEffect(() => {
    // Guard: only DXF/JSON files
    if (!currentFile || !isDxf) {
      setLoadedScene(null);
      return;
    }

    let cancelled = false;

    const loadScene = async () => {
      // -- PATH A: V1 Legacy — embedded scene in processedData --
      if (currentFile.processedData?.scene) {
        setLoadedScene(currentFile.processedData.scene);
        return;
      }

      // -- PATH B: V3 — processedDataPath via authenticated API --
      if (currentFile.processedData?.processedDataPath && currentFile.id && auth.currentUser) {
        setIsLoading(true);
        setSceneError(null);
        try {
          const idToken = await auth.currentUser.getIdToken();
          const response = await fetch(API_ROUTES.FLOORPLANS.SCENE(currentFile.id), {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${idToken}` },
          });
          if (cancelled) return;
          if (response.status === 202) {
            setSceneError(t('floorplan.processingInProgress'));
            return;
          }
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }
          const sceneData: DxfSceneData = await response.json();
          if (!cancelled) setLoadedScene(sceneData);
        } catch (err) {
          if (!cancelled) {
            logger.error('Failed to load scene via API', { error: err });
            setSceneError(err instanceof Error ? err.message : 'Unknown error');
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
        return;
      }

      // From here: NO processedData — need to fetch + parse from downloadUrl
      if (!currentFile.downloadUrl) return;

      // -- PATH C: JSON scene files (FloorplanSaveOrchestrator) --
      if (fileExt === 'json') {
        setIsLoading(true);
        setSceneError(null);
        try {
          const response = await fetch(currentFile.downloadUrl);
          if (cancelled) return;
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const sceneData: DxfSceneData = await response.json();
          if (!cancelled) setLoadedScene(sceneData);
        } catch (err) {
          if (!cancelled) {
            logger.error('Failed to load JSON scene', { error: err });
            setSceneError(err instanceof Error ? err.message : 'Unknown error');
          }
        } finally {
          if (!cancelled) setIsLoading(false);
        }
        return;
      }

      // -- PATH D: Client-side DXF parsing (same pipeline as DXF Viewer) --
      if (currentFile.status !== 'ready') return;

      setIsLoading(true);
      setSceneError(null);
      try {
        logger.info('Client-side DXF parsing', { displayName: currentFile.displayName });
        const resp = await fetch(currentFile.downloadUrl);
        if (cancelled) return;
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const file = new File([blob], currentFile.originalFilename || 'plan.dxf');

        const { dxfImportService } = await import('@/subapps/dxf-viewer/io/dxf-import');
        const result = await dxfImportService.importDxfFile(file);
        if (cancelled) return;
        if (!result.success || !result.scene) throw new Error(result.error || 'Parse failed');

        const scene: DxfSceneData = {
          entities: result.scene.entities.map((entity) => {
            const { type, layer, ...rest } = entity;
            return { type, layer: layer || '0', ...rest } as DxfSceneEntity;
          }),
          layers: result.scene.layers,
          bounds: result.scene.bounds,
        };

        if (!cancelled) setLoadedScene(scene);
      } catch (err) {
        if (!cancelled) {
          logger.error('Client-side DXF parse failed', { error: err });
          setSceneError(err instanceof Error ? err.message : 'Parse failed');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadScene();
    return () => { cancelled = true; };
  }, [currentFile?.id, currentFile?.processedData, currentFile?.downloadUrl,
      currentFile?.status, currentFile?.originalFilename, isDxf, fileExt, t]);

  return { loadedScene, isLoading, sceneError };
}
