'use client';

import { useCallback, useEffect } from 'react';
import { useLevels } from '../../systems/levels/useLevels';
import { useFloorplanBackground, type UseFloorplanBackgroundResult } from './useFloorplanBackground';
import { useFloorplanBackgroundPersistence } from './useFloorplanBackgroundPersistence';
import { useFloorplanBackgroundStore } from '../stores/floorplanBackgroundStore';
import { registerProviders } from '../providers/register-providers';
import { getProvider } from '../providers/provider-registry';
import { FloorplanBackgroundApiClient } from '../services/floorplan-background-api-client';
import type { ProviderId, ProviderMetadata } from '../providers/types';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useFloorplanBackgroundForLevel');

export interface FloorplanBackgroundForLevelResult extends UseFloorplanBackgroundResult {
  floorId: string;
  /**
   * Phase 7 — server-side upload:
   * 1) loads the provider locally to derive `naturalBounds` + `providerMetadata`
   * 2) POSTs the file to `/api/floorplan-backgrounds` (multipart)
   * 3) attaches the server-issued background (with id/companyId/fileId/etc.) to the store
   *
   * Throws on failure (caller decides UX).
   */
  uploadBackground: (file: File, providerId: ProviderId) => Promise<void>;
  /**
   * Phase 7 — server-side delete: cascades overlays via API, then clears the store.
   */
  deleteBackground: () => Promise<void>;
}

/**
 * Binds the active DXF level to the floorplan-background store + Phase 7
 * persistence. `levelId` acts as `floorId` — each level has 0..1 background.
 */
export function useFloorplanBackgroundForLevel(): FloorplanBackgroundForLevelResult | null {
  const { currentLevelId } = useLevels();
  const setActiveFloor = useFloorplanBackgroundStore((s) => s.setActiveFloor);

  // Idempotent on every render — guard inside registerProviders().
  useEffect(() => { registerProviders(); }, []);

  useEffect(() => {
    setActiveFloor(currentLevelId);
  }, [currentLevelId, setActiveFloor]);

  // Phase 7 — hydrate from server + debounced commit on store changes.
  useFloorplanBackgroundPersistence(currentLevelId);

  const result = useFloorplanBackground(currentLevelId ?? '__no_level__');

  const uploadBackground = useCallback(
    async (file: File, providerId: ProviderId) => {
      if (!currentLevelId) throw new Error('No active level — cannot upload background');

      // 1) Load provider locally to derive naturalBounds + metadata.
      const provider = getProvider(providerId);
      const loadResult = await provider.loadAsync({ kind: 'file', file });
      if (!loadResult.success || !loadResult.bounds) {
        throw new Error(loadResult.error ?? 'Provider failed to load file');
      }
      const meta = (loadResult.metadata ?? {}) as Record<string, unknown>;
      const providerMetadata: ProviderMetadata = {
        pdfPageNumber: typeof meta.pdfPageNumber === 'number' ? meta.pdfPageNumber : undefined,
        imageOrientation: typeof meta.imageOrientation === 'number' ? meta.imageOrientation : undefined,
        imageMimeType: typeof meta.imageMimeType === 'string' ? meta.imageMimeType : undefined,
        imageDecoderUsed: meta.imageDecoderUsed === 'utif' ? 'utif' : 'native',
      };

      // 2) Upload via API.
      const { background, fileRecord } = await FloorplanBackgroundApiClient.upload({
        file,
        floorId: currentLevelId,
        providerId,
        naturalWidth: loadResult.bounds.width,
        naturalHeight: loadResult.bounds.height,
        providerMetadata,
      });

      // 3) Hydrate from URL (canonical proxy URL — survives reload).
      const url = fileRecord.downloadUrl;
      const source = url
        ? { kind: 'url' as const, url }
        : { kind: 'file' as const, file };
      await useFloorplanBackgroundStore
        .getState()
        ._hydratePersistedBackground(currentLevelId, background, source);

      logger.info('Background uploaded', {
        floorId: currentLevelId,
        backgroundId: background.id,
        fileId: background.fileId,
      });
    },
    [currentLevelId],
  );

  const deleteBackground = useCallback(async () => {
    if (!currentLevelId) return;
    const slot = useFloorplanBackgroundStore.getState().floors[currentLevelId];
    const bgId = slot?.background?.id;
    if (bgId) {
      try {
        await FloorplanBackgroundApiClient.delete(bgId);
      } catch (err) {
        logger.error('Server delete failed — clearing local state anyway', { bgId, err });
      }
    }
    await useFloorplanBackgroundStore.getState().removeBackground(currentLevelId);
  }, [currentLevelId]);

  if (!currentLevelId) return null;
  return { ...result, floorId: currentLevelId, uploadBackground, deleteBackground };
}
