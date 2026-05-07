'use client';

import { useCallback, useEffect, useMemo } from 'react';
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
 * persistence.
 *
 * ADR-340 keys backgrounds by the **real building floorId** (e.g. `flr_894...`),
 * NOT by the synthetic `levelId` ("default"). When a Level has been linked to
 * a building floor (via the import Wizard → `updateLevelContext`), we resolve
 * `level.floorId` and use it as the canonical key for the store + persistence
 * + API calls. Backward-compat fallback: if no `floorId` is present, the
 * `levelId` is used as the key (legacy levels without building linkage).
 */
export function useFloorplanBackgroundForLevel(): FloorplanBackgroundForLevelResult | null {
  const { currentLevelId, levels } = useLevels();
  const setActiveFloor = useFloorplanBackgroundStore((s) => s.setActiveFloor);

  // Resolve real floorId from the current Level.
  const resolvedFloorId = useMemo(() => {
    if (!currentLevelId) return null;
    const level = levels.find((l) => l.id === currentLevelId);
    return level?.floorId ?? currentLevelId;
  }, [currentLevelId, levels]);

  // Idempotent on every render — guard inside registerProviders().
  useEffect(() => { registerProviders(); }, []);

  useEffect(() => {
    setActiveFloor(resolvedFloorId);
  }, [resolvedFloorId, setActiveFloor]);

  // Phase 7 — hydrate from server + debounced commit on store changes.
  useFloorplanBackgroundPersistence(resolvedFloorId);

  const result = useFloorplanBackground(resolvedFloorId ?? '__no_level__');

  const uploadBackground = useCallback(
    async (file: File, providerId: ProviderId) => {
      if (!resolvedFloorId) throw new Error('No active floor — cannot upload background');

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
        floorId: resolvedFloorId,
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
        ._hydratePersistedBackground(resolvedFloorId, background, source);

      logger.info('Background uploaded', {
        floorId: resolvedFloorId,
        backgroundId: background.id,
        fileId: background.fileId,
      });
    },
    [resolvedFloorId],
  );

  const deleteBackground = useCallback(async () => {
    if (!resolvedFloorId) return;
    const slot = useFloorplanBackgroundStore.getState().floors[resolvedFloorId];
    const bgId = slot?.background?.id;
    if (bgId) {
      try {
        await FloorplanBackgroundApiClient.delete(bgId);
      } catch (err) {
        logger.error('Server delete failed — clearing local state anyway', { bgId, err });
      }
    }
    await useFloorplanBackgroundStore.getState().removeBackground(resolvedFloorId);
  }, [resolvedFloorId]);

  if (!resolvedFloorId) return null;
  return { ...result, floorId: resolvedFloorId, uploadBackground, deleteBackground };
}
