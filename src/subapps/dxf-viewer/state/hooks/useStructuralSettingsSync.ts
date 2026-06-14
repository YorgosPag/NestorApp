'use client';

/**
 * ADR-456 Slice 2b — Building ↔ StructuralSettings store sync.
 *
 * Επιλύει το ενεργό `buildingId` (3-tier: save-context → level field → floor
 * metadata, mirror του `DxfViewerTopBar`) και συνδρομεί στο `buildings/{id}`
 * doc ώστε να φορτώνει το `structuralSettings` στο store (real-time, ADR-355
 * `subscribeDoc`). Όταν δεν υπάρχει building (standalone DXF) η ρύθμιση μένει
 * in-memory default (graceful degradation).
 *
 * Quiet-window guard (mirror `useBimRenderSettingsSync`, ADR-375 v2.11): αγνοεί
 * server echoes εντός `LOCAL_WRITE_QUIET_WINDOW_MS` μετά από local edit ώστε να
 * μη χάνεται pending debounced write. Building switch πάντα φορτώνει.
 *
 * Mount once near the DXF viewer root (after LevelsContext + save context).
 */

import { useEffect } from 'react';
import type { DocumentData } from 'firebase/firestore';
import { firestoreQueryService } from '@/services/firestore';
import type { Level } from '../../systems/levels/config';
import type { DxfSaveContext } from '../../services/dxf-firestore.types';
import { useFloorMetadata } from '../../hooks/data/useFloorMetadata';
import { useStructuralSettingsStore } from '../structural-settings-store';
import type { StructuralSettings } from '../../bim/structural/structural-settings';

/** Min idle ms μετά το τελευταίο local setter πριν ξαναρχίσουν τα server syncs. */
const LOCAL_WRITE_QUIET_WINDOW_MS = 2000;

interface BuildingDoc extends DocumentData {
  structuralSettings?: Partial<StructuralSettings>;
}

interface UseStructuralSettingsSyncParams {
  currentLevelId: string | null;
  levels: Level[];
  saveContext?: DxfSaveContext | null;
}

export function useStructuralSettingsSync({
  currentLevelId,
  levels,
  saveContext,
}: UseStructuralSettingsSyncParams): void {
  const currentLevel = levels?.find((l) => l.id === currentLevelId) ?? null;
  const floorId = saveContext?.floorId ?? currentLevel?.floorId ?? null;
  const floorMeta = useFloorMetadata(floorId);
  const buildingId =
    saveContext?.buildingId ?? currentLevel?.buildingId ?? floorMeta?.buildingId ?? null;

  useEffect(() => {
    const store = useStructuralSettingsStore.getState();

    // Standalone (καμία σύνδεση με κτίριο): in-memory default, χωρίς persistence.
    if (!buildingId) {
      if (store.currentBuildingId !== null) store.loadForBuilding(null, null);
      return;
    }

    const unsubscribe = firestoreQueryService.subscribeDoc<BuildingDoc>(
      'BUILDINGS',
      buildingId,
      (doc) => {
        const current = useStructuralSettingsStore.getState();
        // Same building + εντός quiet window → προστάτευσε το pending local edit.
        if (
          current.currentBuildingId === buildingId &&
          Date.now() - current.lastLocalMutationAt < LOCAL_WRITE_QUIET_WINDOW_MS
        ) {
          return;
        }
        current.loadForBuilding(buildingId, doc?.structuralSettings ?? null);
      },
      (err) => {
        console.error('[useStructuralSettingsSync] subscribe failed', err);
      },
    );
    return () => unsubscribe();
  }, [buildingId]);
}
