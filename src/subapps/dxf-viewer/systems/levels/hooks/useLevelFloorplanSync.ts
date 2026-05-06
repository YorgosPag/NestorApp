'use client';

import { useEffect, useRef } from 'react';
import { RealtimeService } from '@/services/realtime';
import type { FileTrashedPayload } from '@/services/realtime';
import type { Level } from '../config';
import { usePdfBackgroundStore } from '../../../pdf-background/stores/pdfBackgroundStore';

interface UseLevelFloorplanSyncParams {
  levels: Level[];
  clearLevelScene: (levelId: string) => void;
}

/**
 * Bidirectional sync: external floorplan deletion → canvas clear.
 *
 * Subscribes to FILE_TRASHED from the centralized RealtimeService event bus.
 * When a floor floorplan file is trashed externally (e.g., from the Building Floors tab
 * via EntityFilesManager), clears the corresponding canvas scene immediately
 * without requiring a page reload — both DXF scene AND PDF background.
 *
 * Matching strategy (either condition triggers clear):
 *  1. payload.fileId === level.sceneFileId  — exact file match (primary)
 *  2. payload.entityType === 'floor' && payload.entityId === level.floorId  — floor match (fallback)
 *
 * On match: clearLevelScene (DXF) + unloadPdf + setEnabled(false) (PDF background).
 * unloadPdf is idempotent — safe to call when no PDF is loaded.
 */
export function useLevelFloorplanSync({
  levels,
  clearLevelScene,
}: UseLevelFloorplanSyncParams): void {
  const levelsRef = useRef<Level[]>(levels);
  levelsRef.current = levels;

  useEffect(() => {
    const handleFileTrashed = (payload: FileTrashedPayload) => {
      const current = levelsRef.current;
      for (const level of current) {
        const matchByFile = !!level.sceneFileId && level.sceneFileId === payload.fileId;
        const matchByFloor =
          payload.entityType === 'floor' &&
          !!payload.entityId &&
          !!level.floorId &&
          level.floorId === payload.entityId;

        if (matchByFile || matchByFloor) {
          clearLevelScene(level.id);
          const pdfStore = usePdfBackgroundStore.getState();
          pdfStore.unloadPdf();
          pdfStore.setEnabled(false);
        }
      }
    };

    const unsub = RealtimeService.subscribe('FILE_TRASHED', handleFileTrashed);
    return () => unsub();
  }, [clearLevelScene]);
}
