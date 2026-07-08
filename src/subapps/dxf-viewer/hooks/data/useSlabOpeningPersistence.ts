'use client';

/**
 * ADR-363 Phase 3.7 — Slab-Opening Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: subscribe + diff-merge, first-save on `drawing:entity-created` (tool
 * 'slab-opening'), 500ms auto-save debounce, delete on
 * `bim:slab-opening-delete-requested`, audit via `recordSlabOpeningChange` (narrowed
 * `{id, kind, layerId, params}` snapshot on EVERY action, incl. persist), and
 * `neverUpdate` — the original ALWAYS `setDoc`s (no update path). No BOQ bridge —
 * instead re-feeds the host slab's net volume by emitting
 * `bim:slab-opening-persisted` on persist/restore/delete (ADR-395 G2). The delete
 * path falls back to the SSoT `lastSavedParamsRef` baseline (via the `useExtra`
 * escape hatch) for `hostSlabId` when the scene entity is already gone.
 *
 * Geometry re-derivation: όταν φτάνει snapshot από Firestore, η γεωμετρία
 * αναπαράγεται client-side από `params`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10 §11.Q3
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';
import type { MutableRefObject } from 'react';

import type { AnySceneEntity } from '../../types/entities';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { EventBus } from '../../systems/events/EventBus';
import {
  createSlabOpeningFirestoreService,
  entityToSaveInput,
  SlabOpeningFirestoreService,
  type SlabOpeningDoc,
} from '../../bim/slab-openings/slab-opening-firestore-service';
import { recordSlabOpeningChange } from '../../bim/slab-openings/slab-opening-audit-client';
import { slabOpeningDocToEntity as docToEntity } from './slab-opening-persistence-helpers';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type SlabOpeningSaveState = BimEntitySaveState;

export interface UseSlabOpeningPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key for Firestore query/write. */
  readonly floorId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedSlabOpening: SlabOpeningEntity | null;
}

export interface UseSlabOpeningPersistenceResult {
  readonly saveState: SlabOpeningSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteSlabOpening: (slabOpeningId: string) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

function isSlabOpening(entity: AnySceneEntity): entity is SlabOpeningEntity {
  return (entity as { type?: string }).type === 'slab-opening';
}

/** Extra ref bag — mirrors the SSoT `lastSavedParamsRef` so `onDeleted` can fall
 *  back to the last-known `slabId` when the scene entity is already gone. */
interface SlabOpeningExtra {
  lastSavedParamsRef: MutableRefObject<Map<string, SlabOpeningEntity['params']>> | null;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useSlabOpeningPersistenceBase = createBimEntityPersistenceHook<
  SlabOpeningFirestoreService,
  SlabOpeningDoc,
  SlabOpeningEntity,
  SlabOpeningEntity['params'],
  void,
  SlabOpeningExtra
>({
  entityType: 'slab-opening',
  restoreEntityType: 'slab-opening',
  saveErrorKey: 'SLAB_OPENING_SAVE_ERROR',
  restoreErrorKey: 'SLAB_OPENING_RESTORE_ERROR',
  neverUpdate: true,
  typeGuard: isSlabOpening,
  entityComparable: (e) => e.params,
  createService: (scope) => createSlabOpeningFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveSlabOpening(entityToSaveInput(e)),
    // Dead path (neverUpdate: true — the original always setDoc's), kept for the
    // adapter's required shape.
    update: (svc, e) =>
      svc.updateSlabOpening(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteSlabOpening(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeSlabOpenings(onDocs as (docs: readonly SlabOpeningDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isSlabOpening,
      docToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  deleteTrigger: {
    event: 'bim:slab-opening-delete-requested',
    getId: (p) => (p as { slabOpeningId?: string }).slabOpeningId,
  },
  createExtraRefs: (): SlabOpeningExtra => ({ lastSavedParamsRef: null }),
  useExtra: (ctx) => {
    ctx.extra.lastSavedParamsRef = ctx.lastSavedParamsRef;
  },
  onPersisted: (entity, { isNew, prevComparable }) => {
    void recordSlabOpeningChange(
      isNew ? 'created' : 'updated',
      { id: entity.id, kind: entity.kind, layerId: entity.layerId, params: entity.params },
      { prevParams: prevComparable ?? undefined },
    );
    // ADR-395 G2 — host slab net volume depends on its cutouts; signal the slab
    // persistence hook to re-feed BOQ with the updated subtraction.
    EventBus.emit('bim:slab-opening-persisted', { slabId: entity.params.slabId });
  },
  onDeleted: (id, deleted, { extra }) => {
    const hostSlabId = deleted?.params.slabId ?? extra.lastSavedParamsRef?.current.get(id)?.slabId;
    void recordSlabOpeningChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'shaft' },
    );
    // ADR-395 G2 — removing a cutout grows the host slab's net volume.
    if (hostSlabId) {
      EventBus.emit('bim:slab-opening-persisted', { slabId: hostSlabId });
    }
  },
  onRestored: (entity) => {
    void recordSlabOpeningChange('restored', {
      id: entity.id,
      kind: entity.kind,
      layerId: entity.layerId,
      params: entity.params,
    });
    // ADR-395 G2 — restored cutout re-shrinks the host slab's net volume.
    EventBus.emit('bim:slab-opening-persisted', { slabId: entity.params.slabId });
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useSlabOpeningPersistence(
  params: UseSlabOpeningPersistenceParams,
): UseSlabOpeningPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useSlabOpeningPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    buildingId: params.buildingId,
    floorId: params.floorId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedSlabOpening,
  } as BimEntityPersistenceParams<SlabOpeningEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteSlabOpening: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
