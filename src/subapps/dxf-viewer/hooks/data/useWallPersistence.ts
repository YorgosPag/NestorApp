'use client';

/**
 * ADR-363 Phase 1B — Wall Firestore persistence + soft-lock React adapter.
 *
 * Bridges `WallFirestoreService` to the scene model owned by `LevelsSystem`.
 * Mirrors `useStairPersistence` (ADR-358 Phase 8) — same hybrid auto-save
 * pattern, same selective skip diff-merge, same soft-lock TTL semantics.
 *
 * Persistence trigger — hybrid (DD-1 stair parallel):
 *   - Debounced auto-save 500 ms after `wall.params` change settles.
 *   - `saveNow()` imperative escape hatch (explicit "Αποθήκευση" button).
 *
 * Scene sync — diff-merge with selective skip:
 *   - Each snapshot adds / updates / removes walls in the active scene.
 *   - Walls marked locally-dirty are NEVER overwritten by snapshot data
 *     (local edits always win until the round-trip completes).
 *
 * First-save event: listens for `drawing:entity-created` with `tool: 'wall'`
 * so the freshly drawn wall is persisted immediately without waiting for
 * a user select+edit pass (mirrors stair Phase Q17 9B-6).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';
import { recomputeWallTrimsAfterDelete } from '../../bim/walls/add-wall-to-scene';

import type { SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { WallEntity } from '../../bim/types/wall-types';
import { EventBus } from '../../systems/events/EventBus';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import {
  createWallFirestoreService,
  entityToSaveInput,
  WallFirestoreService,
} from '../../bim/walls/wall-firestore-service';
import { recordWallChange } from '../../bim/walls/wall-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';
import { useBimFirestoreWriteGrace } from './useBimFirestoreWriteGrace';
import { DXF_TIMING } from '../../config/dxf-timing';
import {
  isWall,
  mergeWallDocsIntoScene,
  wallUpdatePatch,
  wallTypeLinkChanged,
  type WallTypeLink,
} from './wall-persistence-helpers';
import { wallBoqEntity } from './wall-boq-feed';
import { useWallTypeReresolution } from './useWallTypeReresolution';
import { useWallSoftLock } from './useWallSoftLock';
import { createPersistSerializer } from './persist-serializer';

// ============================================================================
// TYPES
// ============================================================================

export type WallSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseWallPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
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
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = DXF_TIMING.persist.ENTITY_AUTOSAVE; // ADR-516

// ============================================================================
// HOOK
// ============================================================================

export function useWallPersistence(
  params: UseWallPersistenceParams,
): UseWallPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId,
    levelManager,
    primarySelectedWall,
  } = params;

  const [saveState, setSaveState] = useState<WallSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<WallFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const { recordWrite, isWithinGrace } = useBimFirestoreWriteGrace();
  // ADR-390 — pending first save (drawn or restored).
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, WallEntity['params']>>(new Map());
  // ADR-412 — last-persisted family-type link per wall. The params-only diff
  // cannot see a detach (params stay identical, Q6), so the auto-save trigger
  // ORs in a type-link change detected against this snapshot.
  const lastSavedTypeRef = useRef<Map<string, WallTypeLink>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ADR-401 / N.7 — per-id write serializer: auto-attach re-persists a wall in the
  // same tick as its creation; serializing prevents a duplicate `created` audit.
  const persistSerializerRef = useRef(createPersistSerializer());
  const selectedWallRef = useRef<WallEntity | null>(null);
  selectedWallRef.current = primarySelectedWall;

  // ⚡ STABILITY (ca9 fix 2026-06-08): key the Firestore subscription off stable
  // scope primitives + `currentLevelId`, NOT the per-render `levelManager` object,
  // so onSnapshot does not unsubscribe/re-subscribe on every render. With pipes on
  // canvas the reconcilers re-render in bursts, so the wall subscription target was
  // removed before the server ack → `INTERNAL ASSERTION FAILED ca9 {ve:-1}` (the
  // original report's stack started in THIS hook's cleanup). Mirror of the fitting hook.
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const currentLevelId = levelManager.currentLevelId;

  // Instantiate service when auth + scope ready.
  useEffect(() => {
    const scope = resolveBimPersistenceScope({ companyId, projectId, userId, floorId, floorplanId });
    if (!scope) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createWallFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip of locally-dirty walls.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeWalls(
      (docs) => mergeWallDocsIntoScene(docs, levelId, levelManagerRef.current, {
        dirty: dirtyIdsRef.current,
        deleted: deletedIdsRef.current,
        pending: pendingFirstSaveIdsRef.current,
        lastSavedParams: lastSavedParamsRef.current,
        lastSavedType: lastSavedTypeRef.current,
        isWithinGrace,
      }),
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [currentLevelId, companyId, projectId, floorplanId, floorId, userId]);

  // ADR-412 «type always wins» — re-resolve typed walls on catalog change.
  useWallTypeReresolution(levelManager, dirtyIdsRef);

  // Acquire / release soft-lock around primary selection lifecycle (extracted).
  const { acquireLock, releaseLock, getHeldWallId } = useWallSoftLock(
    serviceRef,
    primarySelectedWall,
  );

  // Immediate persist body — one save + one audit per call (used by both
  // auto-save flush and explicit button). Always invoked through the serialized
  // `persist` wrapper below so concurrent calls for the same id run in order.
  const persistOnce = useCallback(async (entity: WallEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      await acquireLock(entity.id);
      // setDoc (saveWall) only on first write — it stamps createdAt, which the
      // UPDATE rule treats as immutable. Existing walls go through updateWall
      // (updateDoc) so re-edits persist instead of being rejected (mirror the
      // opening persistence saveOpening/updateOpening split).
      if (isNew) {
        await svc.saveWall(entityToSaveInput(entity));
      } else {
        // ADR-412 — patch carries the family-type link (clear → deleteField).
        await svc.updateWall(entity.id, wallUpdatePatch(entity));
      }
      lastSavedParamsRef.current.set(entity.id, entity.params);
      lastSavedTypeRef.current.set(entity.id, {
        typeId: entity.typeId,
        typeOverrides: entity.typeOverrides,
      });
      recordWrite(entity.id);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordWallChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      if (companyId && projectId && buildingId) {
        const levelId = levelManager.currentLevelId;
        const scene = levelId ? levelManager.getLevelScene(levelId) : null;
        void bimToBoqBridge.upsertBoqItemForBim(
          'wall',
          wallBoqEntity(entity, scene),
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WALL_SAVE_ERROR');
      setSaveState('error');
    }
  }, [acquireLock, companyId, projectId, buildingId, floorId, levelManager]);

  // Serialized persist (ADR-401 / N.7): chains concurrent saves for the same id so
  // a create-tick auto-attach re-persist sees the committed baseline → emits one
  // `created` then an `updated` diff, instead of a duplicate `created`.
  const persist = useCallback(
    (entity: WallEntity) =>
      persistSerializerRef.current.run(entity.id, () => persistOnce(entity)),
    [persistOnce],
  );

  // Auto-save debounce on selected wall params change.
  useEffect(() => {
    const wall = primarySelectedWall;
    if (!wall || !serviceRef.current) return;
    // ADR-390 — Bug A defense-in-depth.
    const known = lastSavedParamsRef.current.has(wall.id);
    const pendingWall = pendingFirstSaveIdsRef.current.has(wall.id);
    if (!known && !pendingWall) return;
    const lastSaved = lastSavedParamsRef.current.get(wall.id);
    // ADR-412 — bail only when BOTH params AND the family-type link are unchanged
    // (a detach keeps params identical, so params-only would never re-save it).
    const paramsUnchanged = !!lastSaved && dequal(lastSaved, wall.params);
    const typeUnchanged = !wallTypeLinkChanged(lastSavedTypeRef.current.get(wall.id), wall);
    if (paramsUnchanged && typeUnchanged) return;

    dirtyIdsRef.current.add(wall.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(wall);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedWall, persist]);

  const saveNow = useCallback(async () => {
    const wall = selectedWallRef.current;
    if (!wall) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(wall);
  }, [persist]);

  // ADR-363 Phase 1E — Delete wall: remove from Firestore + scene + audit.
  const deleteWall = useCallback(async (wallId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    // Cancel pending auto-save for this wall to prevent a save-after-delete race.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === wallId);

    const deletedWall = (deletedEntity && isWall(deletedEntity)) ? deletedEntity : null;

    // Google-level OPTIMISTIC UPDATE (N.7): αφαίρεσε τον τοίχο από τη σκηνή ΣΥΓΧΡΟΝΑ,
    // ΠΡΙΝ το Firestore `await` (το προηγούμενο σχόλιο «optimistically» ήταν ψευδές —
    // η αφαίρεση έτρεχε ΜΕΤΑ το await). Οι coalesced (queueMicrotask) structural
    // αντιδράσεις στο ίδιο `bim:wall-delete-requested` emit πρέπει να δουν φρέσκια σκηνή
    // (mirror του column delete fix· διαφορετικά παράγωγα footings/loads μένουν stale).
    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== wallId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
      // Recompute neighbour miter/bevel patches now that this wall is gone, and
      // persist the updated params so Firestore stays in sync. Symmetric to the
      // addWallToScene re-trim pass that runs on insertion.
      recomputeWallTrimsAfterDelete(levelManager);
    }

    try {
      await svc.deleteWall(wallId);
      void recordWallChange(
        'deleted',
        deletedWall
          ? { id: deletedWall.id, kind: deletedWall.kind, layerId: deletedWall.layerId, params: deletedWall.params }
          : { id: wallId, kind: 'straight' },
      );
      void bimToBoqBridge.deleteBoqItemForBim(wallId, companyId ?? '');
    } catch {
      // Non-fatal: deletion failure is silent — user can retry.
    }

    dirtyIdsRef.current.delete(wallId);
    lastSavedParamsRef.current.delete(wallId);
    pendingFirstSaveIdsRef.current.delete(wallId);

    if (getHeldWallId() === wallId) {
      void releaseLock();
    }
  }, [levelManager, releaseLock, getHeldWallId, companyId]);

  // ADR-390 — persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: WallEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await acquireLock(entity.id);
      await svc.saveWall(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      recordWrite(entity.id);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordWallChange('restored', entity);
      if (companyId && projectId && buildingId) {
        const levelId = levelManager.currentLevelId;
        const scene = levelId ? levelManager.getLevelScene(levelId) : null;
        void bimToBoqBridge.upsertBoqItemForBim(
          'wall',
          wallBoqEntity(entity, scene),
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          'created',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WALL_RESTORE_ERROR');
      setSaveState('error');
    }
  }, [acquireLock, companyId, projectId, buildingId, floorId, levelManager]);

  // First-save listener — fires immediately for freshly drawn walls so the
  // local scene survives the next Firestore snapshot AND lands in
  // `floorplan_walls/{wallId}` on the same tick (stair Q17 9B-6 parallel).
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'wall') return;
      const entity = payload.entity as WallEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'wall') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // ADR-363 Phase 1E — Delete-requested listener. Mark ID before async delete
  // so subscription never re-adds a wall that is pending Firestore removal.
  useEffect(() => {
    const cleanup = EventBus.on('bim:wall-delete-requested', ({ wallId }) => {
      deletedIdsRef.current.add(wallId);
      void deleteWall(wallId);
    });
    return cleanup;
  }, [deleteWall]);

  // ADR-395 G6 — re-feed host wall net BOQ area when one of its openings changes (mirror slab bim:beam-persisted). Scene read from memory.
  useEffect(() => {
    if (!companyId || !projectId || !buildingId) return;
    const ctx = { companyId, projectId, buildingId, floorId: floorId ?? undefined };
    const cleanup = EventBus.on('bim:opening-persisted', ({ wallId }) => {
      // Skip walls whose first save hasn't landed — their own persist feeds net.
      if (!lastSavedParamsRef.current.has(wallId)) return;
      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      if (!scene) return;
      const host = scene.entities.find((e) => e.id === wallId);
      if (!host || !isWall(host)) return;
      void bimToBoqBridge.upsertBoqItemForBim('wall', wallBoqEntity(host, scene), ctx, 'updated');
    });
    return cleanup;
  }, [levelManager, companyId, projectId, buildingId, floorId]);

  useBimEntityMovedPersistEffect(isWall, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'wall',
    isWall,
    serviceRef,
    pendingFirstSaveIdsRef,
    deletedIdsRef,
    persistRestore,
  );

  // Unmount cleanup — flush pending auto-save timer (soft-lock timer + release
  // are owned by useWallSoftLock's own unmount cleanup).
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteWall }),
    [saveState, lastSavedAt, error, saveNow, deleteWall],
  );
}
