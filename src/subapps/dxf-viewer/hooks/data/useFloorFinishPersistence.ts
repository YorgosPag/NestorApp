'use client';

/**
 * ADR-419 — Floor-finish Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Simplified
 * mirror of `useRoofPersistence` (ADR-417) — no family types, no BOQ feed, no audit
 * trail. Handles:
 *   - subscribe + diff-merge incoming Firestore docs (generic `mergeDocsIntoScene`
 *     config — normalised from the original hand-rolled inline merge loop; same
 *     shape as the sibling `useSpaceSeparatorPersistence`, behaviour-equivalent)
 *   - first-save on `drawing:entity-created` (tool: 'floor-finish')
 *   - 500ms auto-save debounce on selected entity params change
 *   - delete on `bim:floor-finish-delete-requested`
 *   - write-grace + lean (silent) restore
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { FloorFinishEntity } from '../../bim/types/floor-finish-types';
import { isFloorFinishEntity } from '../../types/entities';
import {
  createFloorFinishFirestoreService,
  floorFinishEntityToSaveInput,
  floorFinishDocToEntity,
  FloorFinishFirestoreService,
  type FloorFinishDoc,
} from '../../bim/floor-finishes/floor-finish-firestore-service';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type FloorFinishSaveState = BimEntitySaveState;

export interface UseFloorFinishPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelected: FloorFinishEntity | null;
}

export interface UseFloorFinishPersistenceResult {
  readonly saveState: FloorFinishSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteFloorFinish: (id: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useFloorFinishPersistenceBase = createBimEntityPersistenceHook<
  FloorFinishFirestoreService,
  FloorFinishDoc,
  FloorFinishEntity,
  FloorFinishEntity['params']
>({
  entityType: 'floor-finish',
  restoreEntityType: 'floor-finish',
  saveErrorKey: 'FLOOR_FINISH_SAVE_ERROR',
  restoreErrorKey: 'FLOOR_FINISH_RESTORE_ERROR',
  writeGrace: true,
  restoreSilent: true,
  typeGuard: isFloorFinishEntity,
  entityComparable: (e) => e.params,
  createService: (scope) => createFloorFinishFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveFloorFinish(floorFinishEntityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateFloorFinish(e.id, { params: e.params, geometry: e.geometry, layerId: e.layerId }),
    remove: (svc, id) => svc.deleteFloorFinish(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeFloorFinishes(onDocs as (docs: readonly FloorFinishDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isFloorFinishEntity,
      docToEntity: floorFinishDocToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  deleteTrigger: {
    event: 'bim:floor-finish-delete-requested',
    getId: (p) => (p as { id?: string }).id,
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useFloorFinishPersistence(
  params: UseFloorFinishPersistenceParams,
): UseFloorFinishPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } =
    useFloorFinishPersistenceBase(params as BimEntityPersistenceParams<FloorFinishEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteFloorFinish: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
