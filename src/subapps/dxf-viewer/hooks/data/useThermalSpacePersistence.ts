'use client';

/**
 * ADR-422 L0 — Thermal-space Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-593). Behaviour
 * unchanged: subscribe + diff-merge, first-save on `drawing:entity-created`
 * (tool 'thermal-space'), 500ms auto-save debounce, delete on
 * `bim:thermal-space-delete-requested`. Area entity, write-grace, no audit/BOQ,
 * lean (silent) restore.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 * @see docs/centralized-systems/reference/adrs/ADR-593-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { ThermalSpaceEntity } from '../../bim/types/thermal-space-types';
import { isThermalSpaceEntity } from '../../types/entities';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import {
  createThermalSpaceFirestoreService,
  thermalSpaceEntityToSaveInput,
  thermalSpaceDocToEntity,
  ThermalSpaceFirestoreService,
  type ThermalSpaceDoc,
} from '../../bim/thermal-spaces/thermal-space-firestore-service';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type ThermalSpaceSaveState = BimEntitySaveState;

export interface UseThermalSpacePersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelected: ThermalSpaceEntity | null;
}

export interface UseThermalSpacePersistenceResult {
  readonly saveState: ThermalSpaceSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteThermalSpace: (id: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useThermalSpacePersistenceBase = createBimEntityPersistenceHook<
  ThermalSpaceFirestoreService,
  ThermalSpaceDoc,
  ThermalSpaceEntity,
  ThermalSpaceEntity['params']
>({
  entityType: 'thermal-space',
  restoreEntityType: 'thermal-space',
  saveErrorKey: 'THERMAL_SPACE_SAVE_ERROR',
  restoreErrorKey: 'THERMAL_SPACE_RESTORE_ERROR',
  writeGrace: true,
  restoreSilent: true,
  typeGuard: isThermalSpaceEntity,
  entityComparable: (e) => e.params,
  createService: (scope) => createThermalSpaceFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveThermalSpace(thermalSpaceEntityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateThermalSpace(e.id, { params: e.params, geometry: e.geometry, layerId: e.layerId }),
    remove: (svc, id) => svc.deleteThermalSpace(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeThermalSpaces(onDocs as (docs: readonly ThermalSpaceDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isThermalSpaceEntity,
      docToEntity: thermalSpaceDocToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  deleteTrigger: {
    event: 'bim:thermal-space-delete-requested',
    getId: (p) => (p as { id?: string }).id,
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useThermalSpacePersistence(
  params: UseThermalSpacePersistenceParams,
): UseThermalSpacePersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } =
    useThermalSpacePersistenceBase(params as BimEntityPersistenceParams<ThermalSpaceEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteThermalSpace: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
