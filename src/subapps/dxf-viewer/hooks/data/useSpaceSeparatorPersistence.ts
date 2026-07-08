'use client';

/**
 * ADR-437 — Space-separator Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: subscribe + diff-merge, first-save on `drawing:entity-created`
 * (tool: 'space-separator'), 500ms auto-save debounce, delete on
 * `bim:space-separator-delete-requested`, write-grace, lean (silent) restore.
 * No audit, no BOQ (mirror of `useThermalSpacePersistence`, ADR-422 L0).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-437-space-separation-lines.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { SpaceSeparatorEntity } from '../../bim/types/space-separator-types';
import { isSpaceSeparatorEntity } from '../../types/entities';
import {
  createSpaceSeparatorFirestoreService,
  spaceSeparatorEntityToSaveInput,
  spaceSeparatorDocToEntity,
  SpaceSeparatorFirestoreService,
  type SpaceSeparatorDoc,
} from '../../bim/space-separators/space-separator-firestore-service';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type SpaceSeparatorSaveState = BimEntitySaveState;

export interface UseSpaceSeparatorPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelected: SpaceSeparatorEntity | null;
}

export interface UseSpaceSeparatorPersistenceResult {
  readonly saveState: SpaceSeparatorSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteSpaceSeparator: (id: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useSpaceSeparatorPersistenceBase = createBimEntityPersistenceHook<
  SpaceSeparatorFirestoreService,
  SpaceSeparatorDoc,
  SpaceSeparatorEntity,
  SpaceSeparatorEntity['params']
>({
  entityType: 'space-separator',
  restoreEntityType: 'space-separator',
  saveErrorKey: 'SPACE_SEPARATOR_SAVE_ERROR',
  restoreErrorKey: 'SPACE_SEPARATOR_RESTORE_ERROR',
  writeGrace: true,
  restoreSilent: true,
  typeGuard: isSpaceSeparatorEntity,
  entityComparable: (e) => e.params,
  createService: (scope) => createSpaceSeparatorFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveSpaceSeparator(spaceSeparatorEntityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateSpaceSeparator(e.id, { params: e.params, geometry: e.geometry, layerId: e.layerId }),
    remove: (svc, id) => svc.deleteSpaceSeparator(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeSpaceSeparators(onDocs as (docs: readonly SpaceSeparatorDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isSpaceSeparatorEntity,
      docToEntity: spaceSeparatorDocToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  deleteTrigger: {
    event: 'bim:space-separator-delete-requested',
    getId: (p) => (p as { id?: string }).id,
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useSpaceSeparatorPersistence(
  params: UseSpaceSeparatorPersistenceParams,
): UseSpaceSeparatorPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } =
    useSpaceSeparatorPersistenceBase(params as BimEntityPersistenceParams<SpaceSeparatorEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteSpaceSeparator: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
