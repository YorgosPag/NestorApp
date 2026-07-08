'use client';

/**
 * ADR-436 Slice 1-persist — Foundation Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-593). Behaviour
 * unchanged: subscribe + diff-merge, first-save on `drawing:entity-created` (tool
 * 'foundation'), 500ms auto-save debounce, delete on
 * `bim:foundation-delete-requested`, write-grace, full persistRestore + audit via
 * `recordFoundationChange`. **ΧΩΡΙΣ BOQ bridge** (structural substructure·
 * BOQ/ATOE = Slice 4) και **ΧΩΡΙΣ buildingId**.
 *
 * Geometry re-derivation: όταν φτάνει snapshot από Firestore, η γεωμετρία
 * αναπαράγεται client-side από `params` (SSoT `createFoundation` factory).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
 * @see docs/centralized-systems/reference/adrs/ADR-593-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { AnySceneEntity } from '../../types/entities';
import type { FoundationEntity } from '../../bim/types/foundation-types';
import {
  createFoundationFirestoreService,
  entityToSaveInput,
  foundationDocToEntity,
  FoundationFirestoreService,
  type FoundationDoc,
} from '../../bim/foundations/foundation-firestore-service';
import { recordFoundationChange } from '../../bim/foundations/foundation-audit-client';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type FoundationSaveState = BimEntitySaveState;

export interface UseFoundationPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedFoundation: FoundationEntity | null;
}

export interface UseFoundationPersistenceResult {
  readonly saveState: FoundationSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteFoundation: (foundationId: string) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

function isFoundation(entity: AnySceneEntity): entity is FoundationEntity {
  return (entity as { type?: string }).type === 'foundation';
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useFoundationPersistenceBase = createBimEntityPersistenceHook<
  FoundationFirestoreService,
  FoundationDoc,
  FoundationEntity,
  FoundationEntity['params']
>({
  entityType: 'foundation',
  restoreEntityType: 'foundation',
  saveErrorKey: 'FOUNDATION_SAVE_ERROR',
  restoreErrorKey: 'FOUNDATION_RESTORE_ERROR',
  writeGrace: true,
  typeGuard: isFoundation,
  entityComparable: (e) => e.params,
  createService: (scope) => createFoundationFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveFoundation(entityToSaveInput(e)),
    // ADR-397 — setDoc (saveFoundation) only on first write (stamps createdAt, which
    // the Firestore UPDATE rule treats as immutable). Existing foundations go through
    // updateFoundation (updateDoc) so re-edits persist instead of being silently
    // rejected → snapshot revert / snap-back. Mirror column.
    update: (svc, e) =>
      svc.updateFoundation(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
        // ADR-441 Slice 6b — re-host writes hosting bindings into the existing doc.
        guideBindings: e.guideBindings,
        // ADR-539 — carry the per-face appearance edit so painted faces persist on
        // re-edit (faced paint fires `bim:entities-attached` → persist → updateDoc).
        faceAppearance: e.faceAppearance,
      }),
    remove: (svc, id) => svc.deleteFoundation(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeFoundations(onDocs as (docs: readonly FoundationDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isFoundation,
      docToEntity: foundationDocToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  deleteTrigger: {
    event: 'bim:foundation-delete-requested',
    getId: (p) => (p as { foundationId?: string }).foundationId,
  },
  onPersisted: (entity, { isNew, prevComparable }) => {
    void recordFoundationChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
  },
  onDeleted: (id, deleted) => {
    void recordFoundationChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'pad' },
    );
  },
  onRestored: (entity) => {
    void recordFoundationChange('restored', entity);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useFoundationPersistence(
  params: UseFoundationPersistenceParams,
): UseFoundationPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useFoundationPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedFoundation,
  } as BimEntityPersistenceParams<FoundationEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteFoundation: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
