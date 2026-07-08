'use client';

/**
 * ADR-363 Phase 3 — Slab Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-593). Behaviour
 * unchanged: hybrid auto-save + `saveNow`, diff-merge with ADR-412 "type always
 * wins" (`slabEntityDiffersFromDoc` + family-type link baseline seed), always-save
 * persist (setDoc, no update path), BOQ feed (create/update/delete/restore), and two
 * cross-entity re-BOQ listeners (`bim:beam-persisted`, `bim:slab-opening-persisted`)
 * + `useSlabTypeReresolution`. First-save on `drawing:entity-created` (tool 'slab').
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 * @see docs/centralized-systems/reference/adrs/ADR-593-bim-entity-persistence-hook-ssot.md
 */

import { useEffect, useMemo } from 'react';
import { dequal } from 'dequal';

import type { SlabEntity } from '../../bim/types/slab-types';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { EventBus } from '../../systems/events/EventBus';
import {
  createSlabFirestoreService,
  entityToSaveInput,
  SlabFirestoreService,
  type SlabDoc,
} from '../../bim/slabs/slab-firestore-service';
import { recordSlabChange } from '../../bim/slabs/slab-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { slabBoqGeometry } from './slab-boq-feed';
import {
  docToEntity,
  isSlab,
  slabEntityDiffersFromDoc,
  slabTypeLinkChanged,
  type SlabTypeLink,
} from './slab-persistence-helpers';
import { useSlabTypeReresolution } from './useSlabTypeReresolution';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type SlabSaveState = BimEntitySaveState;

export interface UseSlabPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedSlab: SlabEntity | null;
}

export interface UseSlabPersistenceResult {
  readonly saveState: SlabSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteSlab: (slabId: string) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

type SlabExtra = { readonly lastSavedTypeLink: Map<string, SlabTypeLink> };

function feedSlabBoq(
  entity: SlabEntity,
  scope: { companyId: string | null; projectId: string | null | undefined; buildingId?: string | null; floorId?: string | null; levelManager: LevelSceneWriter },
  action: 'created' | 'updated',
): void {
  if (!(scope.companyId && scope.projectId && scope.buildingId)) return;
  const levelId = scope.levelManager.currentLevelId;
  const scene = levelId ? scope.levelManager.getLevelScene(levelId) : null;
  void bimToBoqBridge.upsertBoqItemForBim(
    'slab',
    { id: entity.id, kind: entity.kind, geometry: slabBoqGeometry(entity, scene) },
    {
      companyId: scope.companyId,
      projectId: scope.projectId,
      buildingId: scope.buildingId,
      floorId: scope.floorId ?? undefined,
    },
    action,
  );
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useSlabPersistenceBase = createBimEntityPersistenceHook<
  SlabFirestoreService,
  SlabDoc,
  SlabEntity,
  SlabEntity['params'],
  void,
  SlabExtra
>({
  entityType: 'slab',
  restoreEntityType: 'slab',
  saveErrorKey: 'SLAB_SAVE_ERROR',
  restoreErrorKey: 'SLAB_RESTORE_ERROR',
  neverUpdate: true, // always setDoc via saveSlab (no updateSlab path)
  entityComparable: (e) => e.params,
  createExtraRefs: () => ({ lastSavedTypeLink: new Map<string, SlabTypeLink>() }),
  createService: (scope) => createSlabFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveSlab(entityToSaveInput(e)),
    update: (svc, e) => svc.saveSlab(entityToSaveInput(e)), // unused (neverUpdate)
    remove: (svc, id) => svc.deleteSlab(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeSlabs(onDocs as (docs: readonly SlabDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: (extra) => ({
      isEntity: isSlab,
      docToEntity: (doc) => docToEntity(doc),
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
      differs: (existing, doc) => slabEntityDiffersFromDoc(existing, doc),
      seedExtraBaseline: (doc) => {
        if (!extra.lastSavedTypeLink.has(doc.id)) {
          extra.lastSavedTypeLink.set(doc.id, { typeId: doc.typeId, typeOverrides: doc.typeOverrides });
        }
      },
    }),
  },
  deleteTrigger: {
    event: 'bim:slab-delete-requested',
    getId: (p) => (p as { slabId?: string }).slabId,
  },
  // ADR-412 — a detach keeps params identical, so OR-in the type-link diff.
  autoSaveDirty: (entity, lastSaved, extra) => {
    const linkChanged = slabTypeLinkChanged(extra.lastSavedTypeLink.get(entity.id), entity);
    return !(lastSaved !== undefined && dequal(lastSaved, entity.params) && !linkChanged);
  },
  onPersisted: (entity, { isNew, prevComparable, scope, extra }) => {
    extra.lastSavedTypeLink.set(entity.id, { typeId: entity.typeId, typeOverrides: entity.typeOverrides });
    void recordSlabChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
    feedSlabBoq(entity, scope, isNew ? 'created' : 'updated');
  },
  onDeleted: (id, deleted, { scope }) => {
    void recordSlabChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'floor' },
    );
    void bimToBoqBridge.deleteBoqItemForBim(id, scope.companyId ?? '');
  },
  onDeleteCleanup: (id, extra) => {
    extra.lastSavedTypeLink.delete(id);
  },
  onRestored: (entity, { scope, extra }) => {
    extra.lastSavedTypeLink.set(entity.id, { typeId: entity.typeId, typeOverrides: entity.typeOverrides });
    void recordSlabChange('restored', entity);
    feedSlabBoq(entity, scope, 'created');
  },
  useExtra: (ctx) => {
    // Phase 5.5i+ — re-BOQ all slabs when a beam changes (move/resize/delete).
    useEffect(() => {
      const cleanup = EventBus.on('bim:beam-persisted', () => {
        const s = ctx.scopeRef.current;
        if (!s.companyId || !s.projectId || !s.buildingId) return;
        const levelId = s.levelManager.currentLevelId;
        const scene = levelId ? s.levelManager.getLevelScene(levelId) : null;
        if (!scene) return;
        const boqCtx = { companyId: s.companyId, projectId: s.projectId, buildingId: s.buildingId, floorId: s.floorId ?? undefined };
        for (const entity of scene.entities) {
          if ((entity as { type?: string }).type !== 'slab') continue;
          const slab = entity as SlabEntity;
          void bimToBoqBridge.upsertBoqItemForBim(
            'slab',
            { id: slab.id, kind: slab.kind, geometry: slabBoqGeometry(slab, scene) },
            boqCtx,
            'updated',
          );
        }
      });
      return cleanup;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ADR-395 G2 — re-feed host slab net volume when a cutout is added/edited/deleted.
    useEffect(() => {
      const cleanup = EventBus.on('bim:slab-opening-persisted', ({ slabId }) => {
        const s = ctx.scopeRef.current;
        if (!s.companyId || !s.projectId || !s.buildingId) return;
        if (!ctx.lastSavedParamsRef.current.has(slabId)) return;
        const levelId = s.levelManager.currentLevelId;
        const scene = levelId ? s.levelManager.getLevelScene(levelId) : null;
        if (!scene) return;
        const host = scene.entities.find((e) => e.id === slabId);
        if (!host || !isSlab(host)) return;
        void bimToBoqBridge.upsertBoqItemForBim(
          'slab',
          { id: host.id, kind: host.kind, geometry: slabBoqGeometry(host, scene) },
          { companyId: s.companyId, projectId: s.projectId, buildingId: s.buildingId, floorId: s.floorId ?? undefined },
          'updated',
        );
      });
      return cleanup;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ADR-412 — re-flow type edits / late type loads onto placed slabs.
    useSlabTypeReresolution(ctx.levelManagerRef.current, ctx.dirtyIdsRef);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useSlabPersistence(
  params: UseSlabPersistenceParams,
): UseSlabPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useSlabPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    buildingId: params.buildingId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedSlab,
  } as BimEntityPersistenceParams<SlabEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteSlab: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
