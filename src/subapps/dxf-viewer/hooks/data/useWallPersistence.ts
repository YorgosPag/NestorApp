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

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { WallEntity } from '../../bim/types/wall-types';
import { EventBus } from '../../systems/events/EventBus';
import {
  createWallFirestoreService,
  entityToSaveInput,
  WallFirestoreService,
  type WallDoc,
} from '../../bim/walls/wall-firestore-service';
import { recordWallChange } from '../../bim/walls/wall-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';
import { docToEntity, isWall } from './wall-persistence-helpers';

// ============================================================================
// TYPES
// ============================================================================

export type WallSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
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

const AUTO_SAVE_DEBOUNCE_MS = 500;
const LOCK_TTL_MS = 5 * 60 * 1000;

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
  // ADR-390 — pending first save (drawn or restored).
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, WallEntity['params']>>(new Map());
  const lockHeldRef = useRef<string | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedWallRef = useRef<WallEntity | null>(null);
  selectedWallRef.current = primarySelectedWall;

  // Instantiate service when auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createWallFirestoreService({
      companyId,
      projectId,
      floorplanId,
      userId,
    });
  }, [companyId, projectId, floorplanId, userId]);

  // Subscribe + diff-merge + selective skip of locally-dirty walls.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeWalls(
      (docs) => {
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, WallDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const nonWalls: AnySceneEntity[] = [];
        const sceneWalls = new Map<string, WallEntity>();
        for (const e of scene.entities) {
          if (isWall(e)) sceneWalls.set(e.id, e);
          else nonWalls.push(e);
        }

        const nextWalls: WallEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        for (const doc of docs) {
          const existing = sceneWalls.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id) && !deleted.has(doc.id)) {
              nextWalls.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextWalls.push(existing);
            continue;
          }
          if (!dequal(existing.params, doc.params) || !dequal(existing.editingBy, doc.editingBy)) {
            nextWalls.push(docToEntity(doc));
            mutated = true;
          } else {
            nextWalls.push(existing);
          }
        }

        // Mark every Firestore doc as "exists in DB" (mirror useOpeningPersistence)
        // so the auto-save gate treats loaded walls as `known` and `persist`
        // routes through `updateWall` (UPDATE) instead of `saveWall` (setDoc,
        // resets createdAt → rejected by the immutability rule). Without this,
        // editing a wall loaded from a previous session was silently never
        // persisted, and the next snapshot reverted it to the stored position.
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        const pending = pendingFirstSaveIdsRef.current;
        for (const [id, entity] of sceneWalls) {
          if (docsById.has(id)) continue;
          // Explicitly deleted — never re-add regardless of save state.
          if (deleted.has(id)) { mutated = true; continue; }
          // ADR-390 — replaces buggy `neverSaved` guard. Preserve walls only αν
          // είναι dirty ή pendingFirstSave (just drawn / restored via undo).
          if (dirty.has(id) || pending.has(id)) {
            nextWalls.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          levelManager.setLevelScene(levelId, {
            ...scene,
            entities: [...nonWalls, ...nextWalls],
          });
        }
      },
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [levelManager, companyId, projectId, floorplanId, userId]);

  // Acquire / release soft-lock around primary selection lifecycle.
  const releaseLock = useCallback(async () => {
    const svc = serviceRef.current;
    const held = lockHeldRef.current;
    if (!svc || !held) return;
    lockHeldRef.current = null;
    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    try {
      await svc.releaseLock(held);
    } catch {
      /* non-fatal — lock will TTL-expire on remote side */
    }
  }, []);

  const acquireLock = useCallback(async (wallId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    if (lockHeldRef.current === wallId) return;
    if (lockHeldRef.current && lockHeldRef.current !== wallId) {
      await releaseLock();
    }
    try {
      await svc.acquireLock(wallId);
      lockHeldRef.current = wallId;
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => {
        void releaseLock();
      }, LOCK_TTL_MS);
    } catch {
      /* non-fatal */
    }
  }, [releaseLock]);

  // Release lock when primary selection drops or changes wall.
  useEffect(() => {
    if (!primarySelectedWall) {
      void releaseLock();
    } else if (
      lockHeldRef.current &&
      lockHeldRef.current !== primarySelectedWall.id
    ) {
      void releaseLock();
    }
    return () => {
      void releaseLock();
    };
  }, [primarySelectedWall?.id, releaseLock]);

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: WallEntity) => {
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
        await svc.updateWall(entity.id, {
          params: entity.params,
          validation: entity.validation,
          geometry: entity.geometry,
          layerId: entity.layerId,
        });
      }
      lastSavedParamsRef.current.set(entity.id, entity.params);
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
        void bimToBoqBridge.upsertBoqItemForBim(
          'wall',
          { id: entity.id, kind: entity.kind, params: entity.params as unknown as Readonly<{ category?: string; [key: string]: unknown }>, geometry: entity.geometry },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WALL_SAVE_ERROR');
      setSaveState('error');
    }
  }, [acquireLock, companyId, projectId, buildingId, floorId]);

  // Auto-save debounce on selected wall params change.
  useEffect(() => {
    const wall = primarySelectedWall;
    if (!wall || !serviceRef.current) return;
    // ADR-390 — Bug A defense-in-depth.
    const known = lastSavedParamsRef.current.has(wall.id);
    const pendingWall = pendingFirstSaveIdsRef.current.has(wall.id);
    if (!known && !pendingWall) return;
    const lastSaved = lastSavedParamsRef.current.get(wall.id);
    if (lastSaved && dequal(lastSaved, wall.params)) return;

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

    // Remove from local scene optimistically (already done Firestore-side).
    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== wallId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(wallId);
    lastSavedParamsRef.current.delete(wallId);
    pendingFirstSaveIdsRef.current.delete(wallId);

    if (lockHeldRef.current === wallId) {
      void releaseLock();
    }
  }, [levelManager, releaseLock, companyId]);

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
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordWallChange('restored', entity);
      if (companyId && projectId && buildingId) {
        void bimToBoqBridge.upsertBoqItemForBim(
          'wall',
          { id: entity.id, kind: entity.kind, params: entity.params as unknown as Readonly<{ category?: string; [key: string]: unknown }>, geometry: entity.geometry },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          'created',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WALL_RESTORE_ERROR');
      setSaveState('error');
    }
  }, [acquireLock, companyId, projectId, buildingId, floorId]);

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

  useBimEntityMovedPersistEffect(isWall, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'wall',
    isWall,
    serviceRef,
    pendingFirstSaveIdsRef,
    deletedIdsRef,
    persistRestore,
  );

  // Unmount cleanup — release lock + flush pending timers.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      void releaseLock();
    };
  }, [releaseLock]);

  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteWall }),
    [saveState, lastSavedAt, error, saveNow, deleteWall],
  );
}
