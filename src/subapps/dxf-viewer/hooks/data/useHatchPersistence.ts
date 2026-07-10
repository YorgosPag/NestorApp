'use client';

/**
 * ADR-507 — Hatch Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Simplified
 * mirror of `useFloorFinishPersistence` (ADR-419). The hatch is a FLAT DXF
 * primitive, so this slice handles only what fixes "draw → hard refresh → hatch
 * gone":
 *   - subscribe + diff-merge incoming Firestore docs
 *   - first-save on `drawing:complete` (tool: 'hatch')  ← NOT `drawing:entity-created`
 *   - 500ms auto-save debounce on selected hatch payload change
 *   - delete on `bim:hatch-delete-requested` (delete-tool + undo-of-create)
 *   - ADR-390 symmetric undo/redo: `bim:entity-restore-requested` ('hatch') → re-create
 *     doc με ίδιο id (create-redo + delete-undo). Reuse του `persist` ως `persistRestore`
 *     (η `isNew` διαδρομή ξαναγράφει με `setDoc` + ίδιο id) — μηδέν διπλότυπο, δηλαδή
 *     `restoreSilent` παραμένει OFF (default persistRestore = reuse persist logic).
 *   - ADR-507 §8 move/transform re-persist: `bim:entities-moved`
 *     (`useBimEntityMovedPersistEffect`, ίδιο SSoT με wall/beam/slab/column). Το MOVE
 *     tool / body-drag εκπέμπει το μετακινημένο hatch (νέο `boundaryPaths` + pattern
 *     anchors) → immediate persist από το payload, ΑΝΕΞΑΡΤΗΤΑ από selection
 *     (belt-and-suspenders με το auto-save-while-selected debounce).
 *
 * ⚠️ The create event divergence is deliberate: hatch completes via
 * `completeEntity()` which emits `drawing:complete {tool, entityId, entity}`
 * (completeEntity.ts), NOT the `drawing:entity-created` that floor-finish's
 * `useSpecialTools` emits. Listening to the wrong event = silent never-first-save.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { HatchEntity } from '../../types/entities';
import { isHatchEntity } from '../../types/entities';
import {
  createHatchFirestoreService,
  hatchEntityToSaveInput,
  hatchDocToEntity,
  pickHatchData,
  HatchFirestoreService,
  type HatchDoc,
  type HatchDocData,
} from '../../bim/hatch/hatch-firestore-service';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type HatchSaveState = BimEntitySaveState;

export interface UseHatchPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelected: HatchEntity | null;
}

export interface UseHatchPersistenceResult {
  readonly saveState: HatchSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteHatch: (id: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useHatchPersistenceBase = createBimEntityPersistenceHook<
  HatchFirestoreService,
  HatchDoc,
  HatchEntity,
  HatchDocData
>({
  entityType: 'hatch',
  restoreEntityType: 'hatch',
  saveErrorKey: 'HATCH_SAVE_ERROR',
  restoreErrorKey: 'HATCH_RESTORE_ERROR',
  writeGrace: true,
  typeGuard: isHatchEntity,
  // ⚠️ hatch completes via `drawing:complete` (completeEntity.ts), NOT the
  // `drawing:entity-created` default — listening to the wrong event = silent
  // never-first-save.
  createTrigger: { event: 'drawing:complete', tool: 'hatch' },
  // ADR-531 Φ5b.6 — ο .tek import εκπέμπει `drawing:entity-created` (tool 'hatch') όπως wall/slab/
  // column· χρειάζεται 2ος trigger ώστε η εισαγόμενη hatch να first-save-άρει χωρίς τα side-effects
  // του `drawing:complete` (auto-guide prompt / scene-resync ανά hatch).
  extraCreateTriggers: [{ event: 'drawing:entity-created', tool: 'hatch' }],
  entityComparable: (e) => pickHatchData(e),
  createService: (scope) => createHatchFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveHatch(hatchEntityToSaveInput(e)),
    update: (svc, e) => svc.updateHatch(e.id, { data: pickHatchData(e), layerId: e.layerId }),
    remove: (svc, id) => svc.deleteHatch(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeHatches(onDocs as (docs: readonly HatchDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isHatchEntity,
      docToEntity: hatchDocToEntity,
      entityComparable: (e) => pickHatchData(e),
      docComparable: (d) => d.data,
    },
  },
  deleteTrigger: {
    event: 'bim:hatch-delete-requested',
    getId: (p) => (p as { id?: string }).id,
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useHatchPersistence(
  params: UseHatchPersistenceParams,
): UseHatchPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } =
    useHatchPersistenceBase(params as BimEntityPersistenceParams<HatchEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteHatch: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
