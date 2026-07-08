'use client';

/**
 * ADR-363 Phase 1B / ADR-594 Phase 2 — Wall Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT. Wall threads its bespoke
 * pieces through the factory's escape hatches:
 *   - `beforeSave` — acquire the ADR soft-lock before every write (released on delete).
 *   - `merge.mode: 'custom'` — `mergeWallDocsIntoScene` (family-type baseline + grace),
 *     reading `lastSavedType` from the extra bag.
 *   - family-type link: `createExtraRefs` (lastSavedType) + `autoSaveDirty` (params OR
 *     link changed) + `onPersisted` seeds the map.
 *   - `sceneRemovalTiming: 'before'` + `onAfterOptimisticRemoval` — recompute neighbour
 *     miter/bevel trims synchronously so coalesced structural reactions see a fresh scene.
 *   - `useExtra` — soft-lock lifecycle, family-type re-resolution, and the ADR-395 G6
 *     host-wall BOQ re-feed on `bim:opening-persisted`.
 *
 * KNOWN MINOR DEVIATION (ADR-594 §Notes): undo→restore does NOT re-acquire the soft-lock
 * (the factory `persistRestore` has no pre-save hook). The lock is advisory (TTL) and a
 * just-restored wall has no concurrent editor, so the observable persistence is identical.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { dequal } from 'dequal';

import type { WallEntity } from '../../bim/types/wall-types';
import { EventBus } from '../../systems/events/EventBus';
import { recomputeWallTrimsAfterDelete } from '../../bim/walls/add-wall-to-scene';
import {
  createWallFirestoreService,
  entityToSaveInput,
  WallFirestoreService,
  type WallDoc,
} from '../../bim/walls/wall-firestore-service';
import { recordWallChange } from '../../bim/walls/wall-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import {
  isWall,
  mergeWallDocsIntoScene,
  wallUpdatePatch,
  wallTypeLinkChanged,
  type WallTypeLink,
} from './wall-persistence-helpers';
import { wallBoqEntity } from './wall-boq-feed';
import { useWallTypeReresolution } from './useWallTypeReresolution';
import { useWallSoftLock, type UseWallSoftLockResult } from './useWallSoftLock';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
  BimPersistenceHookContext,
  BimPersistenceScope,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// SHARED BOQ FEED (create/update + restore share it)
// ============================================================================

function feedWallBoq(
  entity: WallEntity,
  scope: BimPersistenceScope,
  action: 'created' | 'updated',
): void {
  const { companyId, projectId, buildingId, floorId, levelManager } = scope;
  if (!companyId || !projectId || !buildingId) return;
  const levelId = levelManager.currentLevelId;
  const scene = levelId ? levelManager.getLevelScene(levelId) : null;
  void bimToBoqBridge.upsertBoqItemForBim(
    'wall',
    wallBoqEntity(entity, scene),
    { companyId, projectId, buildingId, floorId: floorId ?? undefined },
    action,
  );
}

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type WallSaveState = BimEntitySaveState;

export interface UseWallPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedWall: WallEntity | null;
}

export interface UseWallPersistenceResult {
  readonly saveState: WallSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteWall: (wallId: string) => Promise<void>;
}

// ============================================================================
// EXTRA REF BAG (family-type link map + soft-lock + live levelManager)
// ============================================================================

interface WallExtra {
  /** ADR-412 — last-persisted family-type link per wall. */
  readonly lastSavedType: Map<string, WallTypeLink>;
  /** Soft-lock handle, set by `useExtra` (needs the hook lifecycle). */
  readonly softLockRef: { current: UseWallSoftLockResult | null };
  /** Live levelManager, read by `onAfterOptimisticRemoval` (trim recompute). */
  readonly live: { levelManager: LevelSceneWriter | null };
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useWallPersistenceBase = createBimEntityPersistenceHook<
  WallFirestoreService,
  WallDoc,
  WallEntity,
  WallEntity['params'],
  void,
  WallExtra
>({
  entityType: 'wall',
  restoreEntityType: 'wall',
  saveErrorKey: 'WALL_SAVE_ERROR',
  restoreErrorKey: 'WALL_RESTORE_ERROR',
  typeGuard: isWall,
  entityComparable: (e) => e.params,
  writeGrace: true,
  serialize: true,
  markDeletedOnRequest: true,
  sceneRemovalTiming: 'before',
  createExtraRefs: () => ({
    lastSavedType: new Map<string, WallTypeLink>(),
    softLockRef: { current: null },
    live: { levelManager: null },
  }),
  createService: (scope) => createWallFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveWall(entityToSaveInput(e)).then(() => undefined),
    update: (svc, e) => svc.updateWall(e.id, wallUpdatePatch(e)),
    remove: (svc, id) => svc.deleteWall(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeWalls(onDocs as (docs: readonly WallDoc[]) => void, onErr),
  },
  merge: {
    mode: 'custom',
    run: (docs, levelId, lm, refs, extra) =>
      mergeWallDocsIntoScene(docs as readonly WallDoc[], levelId, lm, {
        dirty: refs.dirty,
        deleted: refs.deleted,
        pending: refs.pending,
        lastSavedParams: refs.lastSavedParams,
        lastSavedType: extra.lastSavedType,
        isWithinGrace: refs.isWithinGrace,
      }),
  },
  // Acquire the soft-lock before every write (ADR soft-lock TTL semantics).
  beforeSave: async (entity, { extra }) => {
    await extra.softLockRef.current?.acquireLock(entity.id);
    return entity;
  },
  // ADR-412 — persist when params OR the family-type link changed (a detach keeps
  // params identical, so a params-only diff would never re-save it).
  autoSaveDirty: (entity, lastSaved, extra) => {
    const typeUnchanged = !wallTypeLinkChanged(extra.lastSavedType.get(entity.id), entity);
    const paramsUnchanged = lastSaved !== undefined && dequal(lastSaved, entity.params);
    return !(paramsUnchanged && typeUnchanged);
  },
  deleteTrigger: {
    event: 'bim:wall-delete-requested',
    getId: (p) => (p as { wallId?: string }).wallId,
  },
  onAfterOptimisticRemoval: (_id, extra) => {
    // Recompute neighbour miter/bevel patches now this wall is gone (symmetric to the
    // addWallToScene re-trim on insertion), before the network await.
    if (extra.live.levelManager) recomputeWallTrimsAfterDelete(extra.live.levelManager);
  },
  onPersisted: (entity, { isNew, prevComparable, scope, extra }) => {
    extra.lastSavedType.set(entity.id, {
      typeId: entity.typeId,
      typeOverrides: entity.typeOverrides,
    });
    void recordWallChange(
      isNew ? 'created' : 'updated',
      entity,
      { prevParams: prevComparable ?? undefined },
    );
    feedWallBoq(entity, scope, isNew ? 'created' : 'updated');
  },
  onDeleted: (id, deleted, { scope }) => {
    void recordWallChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'straight' },
    );
    void bimToBoqBridge.deleteBoqItemForBim(id, scope.companyId ?? '');
  },
  onDeleteCleanup: (id, extra) => {
    const sl = extra.softLockRef.current;
    if (sl && sl.getHeldWallId() === id) void sl.releaseLock();
  },
  onRestored: (entity, { scope }) => {
    void recordWallChange('restored', entity);
    feedWallBoq(entity, scope, 'created');
  },
  useExtra: (ctx) => useWallExtra(ctx),
});

// ============================================================================
// useExtra — soft-lock lifecycle + reresolution + host-wall BOQ re-feed
// ============================================================================

function useWallExtra(
  ctx: BimPersistenceHookContext<WallEntity, WallEntity['params'], WallExtra>,
): void {
  const lm = ctx.levelManagerRef.current;
  ctx.extra.live.levelManager = lm;

  // Soft-lock (acquire/release around the primary-selection lifecycle).
  const softLock = useWallSoftLock(
    ctx.serviceRef as MutableRefObject<WallFirestoreService | null>,
    ctx.primarySelected,
  );
  ctx.extra.softLockRef.current = softLock;

  // ADR-412 «type always wins» — re-resolve typed walls on catalog change.
  useWallTypeReresolution(lm, ctx.dirtyIdsRef);

  // ADR-395 G6 — re-feed host wall net BOQ area when one of its openings changes.
  const { companyId, projectId, buildingId, floorId } = ctx.scope;
  const { lastSavedParamsRef, levelManagerRef } = ctx;
  useEffect(() => {
    if (!companyId || !projectId || !buildingId) return;
    const cleanup = EventBus.on('bim:opening-persisted', ({ wallId }) => {
      // Skip walls whose first save hasn't landed — their own persist feeds net.
      if (!lastSavedParamsRef.current.has(wallId)) return;
      const manager = levelManagerRef.current;
      const levelId = manager.currentLevelId;
      const scene = levelId ? manager.getLevelScene(levelId) : null;
      if (!scene) return;
      const host = scene.entities.find((e) => e.id === wallId);
      if (!host || !isWall(host)) return;
      void bimToBoqBridge.upsertBoqItemForBim(
        'wall',
        wallBoqEntity(host, scene),
        { companyId, projectId, buildingId, floorId: floorId ?? undefined },
        'updated',
      );
    });
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, projectId, buildingId, floorId]);
}

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useWallPersistence(
  params: UseWallPersistenceParams,
): UseWallPersistenceResult {
  const { primarySelectedWall, ...rest } = params;
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } =
    useWallPersistenceBase({
      ...rest,
      primarySelected: primarySelectedWall,
    } as BimEntityPersistenceParams<WallEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteWall: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
