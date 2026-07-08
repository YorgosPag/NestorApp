'use client';

/**
 * ADR-511 — Wall-covering Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: subscribe + diff-merge, first-save on `drawing:entity-created`
 * (tool: 'wall-covering'), 500ms auto-save debounce, delete on
 * `bim:wall-covering-delete-requested`, write-grace, lean (silent) restore.
 * No audit, no BOQ (πιστό mirror of `useFloorFinishPersistence`, ADR-419).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 * @see hooks/data/useFloorFinishPersistence.ts — το πρότυπο
 */

import { useMemo } from 'react';

import type { WallCoveringEntity } from '../../bim/types/wall-covering-types';
import { isWallCoveringEntity } from '../../types/entities';
import {
  createWallCoveringFirestoreService,
  wallCoveringEntityToSaveInput,
  wallCoveringDocToEntity,
  WallCoveringFirestoreService,
  type WallCoveringDoc,
} from '../../bim/wall-coverings/wall-covering-firestore-service';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type WallCoveringSaveState = BimEntitySaveState;

export interface UseWallCoveringPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelected: WallCoveringEntity | null;
}

export interface UseWallCoveringPersistenceResult {
  readonly saveState: WallCoveringSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteWallCovering: (id: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useWallCoveringPersistenceBase = createBimEntityPersistenceHook<
  WallCoveringFirestoreService,
  WallCoveringDoc,
  WallCoveringEntity,
  WallCoveringEntity['params']
>({
  entityType: 'wall-covering',
  restoreEntityType: 'wall-covering',
  saveErrorKey: 'WALL_COVERING_SAVE_ERROR',
  restoreErrorKey: 'WALL_COVERING_RESTORE_ERROR',
  writeGrace: true,
  restoreSilent: true,
  typeGuard: isWallCoveringEntity,
  entityComparable: (e) => e.params,
  createService: (scope) => createWallCoveringFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveWallCovering(wallCoveringEntityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateWallCovering(e.id, { params: e.params, geometry: e.geometry, layerId: e.layerId }),
    remove: (svc, id) => svc.deleteWallCovering(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeWallCoverings(onDocs as (docs: readonly WallCoveringDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isWallCoveringEntity,
      docToEntity: wallCoveringDocToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  deleteTrigger: {
    event: 'bim:wall-covering-delete-requested',
    getId: (p) => (p as { id?: string }).id,
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useWallCoveringPersistence(
  params: UseWallCoveringPersistenceParams,
): UseWallCoveringPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } =
    useWallCoveringPersistenceBase(params as BimEntityPersistenceParams<WallCoveringEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteWallCovering: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
