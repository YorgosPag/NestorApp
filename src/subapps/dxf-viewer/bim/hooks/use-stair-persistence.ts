'use client';

/**
 * ADR-358 Phase 8 — Stair Firestore persistence + soft-lock React adapter.
 *
 * Bridges `StairFirestoreService` to the scene model owned by `LevelsSystem`.
 *
 * Persistence trigger — **hybrid** (DD-1, 2026-05-17): debounced auto-save
 * 500ms after a `stair.params` change settles (mouseUp / drag end), plus an
 * `saveNow()` imperative escape hatch exposed for an explicit "Αποθήκευση"
 * button in `StairPersistenceSection`. Mirrors Revit transaction + Ctrl+S
 * pattern (industry-aligned with Revit / ProjectWise).
 *
 * Scene sync — **diff-merge with selective skip** (DD-4, 2026-05-17): each
 * snapshot adds/updates/removes stair entities in the active scene, with one
 * exception — stairs marked `locallyDirty` (currently in local edit, awaiting
 * the debounced save flush) are NEVER overwritten by snapshot data. Local
 * edits always win until the round-trip completes. Industry-aligned with
 * Revit Cloud + ArchiCAD BIMcloud selective-merge model.
 *
 * Soft-lock G24 (§6.8): `acquireLock` fires on the first local edit of a
 * stair (DD-2 resolved by ADR §6.8); `releaseLock` fires on deselection of
 * the stair, on unmount, and after 5min idle (DD-3 resolved by ADR §6.8).
 * The lock is display-only — never blocks other users; remote readers render
 * an "Editing by …" badge.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §6.1, §6.8, §7.2 row 8
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { StairDoc, StairEntity } from '../types/stair-types';
import { makeStairHostResolverFromScene } from '../geometry/stairs/stair-host-resolver';
import { EventBus } from '../../systems/events/EventBus';
import {
  createStairFirestoreService,
  entityToSaveInput,
  StairFirestoreService,
} from '../stairs/stair-firestore-service';
import { recordStairChange } from '../stairs/stair-audit-client';
import { useBimEntityRestoredPersistEffect } from '../../hooks/data/useBimEntityRestoredPersistEffect';
import { stairDocToEntity } from '../stairs/stair-doc-hydration';
import { upsertStairBoq, deleteStairBoq } from '../services/stair-boq-sync';

// ============================================================================
// TYPES
// ============================================================================

export type StairSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseStairPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-395 Phase 2 (G1) — BOQ auto-feed scope. Omitted by hosts that don't feed BOQ. */
  readonly buildingId?: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId?: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedStair: StairEntity | null;
}

export interface UseStairPersistenceResult {
  readonly saveState: StairSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteStair: (stairId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;
const LOCK_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// HELPERS
// ============================================================================

function isStair(entity: AnySceneEntity): entity is StairEntity {
  return (entity as { type?: string }).type === 'stair';
}

// ============================================================================
// HOOK
// ============================================================================

export function useStairPersistence(
  params: UseStairPersistenceParams,
): UseStairPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId,
    levelManager,
    primarySelectedStair,
  } = params;

  const [saveState, setSaveState] = useState<StairSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<StairFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, StairEntity['params']>>(new Map());
  // ADR-390 — pending first save (drawn or restored) + tombstone tracking.
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const lockHeldRef = useRef<string | null>(null);
  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedStairRef = useRef<StairEntity | null>(null);
  selectedStairRef.current = primarySelectedStair;

  // Instantiate service when auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createStairFirestoreService({
      companyId,
      projectId,
      floorplanId,
      userId,
    });
  }, [companyId, projectId, floorplanId, userId]);

  // Subscribe + diff-merge + selective skip of locally-dirty stairs.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeStairs(
      (docs) => {
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, StairDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const nonStairs: AnySceneEntity[] = [];
        const sceneStairs = new Map<string, StairEntity>();
        for (const e of scene.entities) {
          if (isStair(e)) sceneStairs.set(e.id, e);
          else nonStairs.push(e);
        }

        const nextStairs: StairEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          // ADR-402 — seed the saved baseline for loaded stairs (mirror
          // useWallPersistence) so the auto-save gate treats them as `known`.
          // Without this a 3D gizmo edit of a previously-loaded stair never
          // passed the `known` check → never persisted → the next snapshot's
          // diff-merge reverted it to the stored position (the revert bug).
          if (!dirty.has(doc.id) && !lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
          const existing = sceneStairs.get(doc.id);
          if (!existing) {
            // Remote add — only if not currently in local-create flow.
            if (!dirty.has(doc.id)) {
              nextStairs.push(stairDocToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            // Local wins — preserve in-flight edit.
            nextStairs.push(existing);
            continue;
          }
          // Remote update — merge if params actually differ.
          if (!dequal(existing.params, doc.params) || !dequal(existing.editingBy, doc.editingBy)) {
            nextStairs.push(stairDocToEntity(doc));
            mutated = true;
          } else {
            nextStairs.push(existing);
          }
        }

        // ADR-390 — replaces buggy `neverSaved` guard. Preserve stairs only
        // αν είναι dirty ή pendingFirstSave (drawn / restored via undo). Closes
        // the Bug B ghost-render path όπου fresh refresh με κενό `lastSavedParamsRef`
        // κρατούσε ορφανές entities σε scene.
        for (const [id, entity] of sceneStairs) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextStairs.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          levelManager.setLevelScene(levelId, {
            ...scene,
            entities: [...nonStairs, ...nextStairs],
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
  // DD-2 (ADR §6.8) — acquire on first local edit, release on deselection / TTL.
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

  const acquireLock = useCallback(async (stairId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    if (lockHeldRef.current === stairId) return;
    if (lockHeldRef.current && lockHeldRef.current !== stairId) {
      await releaseLock();
    }
    try {
      await svc.acquireLock(stairId);
      lockHeldRef.current = stairId;
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(() => {
        void releaseLock();
      }, LOCK_TTL_MS);
    } catch {
      /* non-fatal */
    }
  }, [releaseLock]);

  // Release lock when primary selection drops or changes stair.
  useEffect(() => {
    if (!primarySelectedStair) {
      void releaseLock();
    } else if (
      lockHeldRef.current &&
      lockHeldRef.current !== primarySelectedStair.id
    ) {
      void releaseLock();
    }
    return () => {
      void releaseLock();
    };
  }, [primarySelectedStair?.id, releaseLock]);

  // ADR-401 Phase G.2 — profile-aware BOQ host resolver όταν η σκάλα είναι `attached`
  // (ΙΔΙΟ SSoT με το 3D scene-sync → ποτέ δεν αποκλίνουν). Μη-attached → undefined.
  const buildStairHostResolver = useCallback(
    (entity: StairEntity) => {
      if (entity.params.topBinding !== 'attached' && entity.params.baseBinding !== 'attached') return undefined;
      const levelId = levelManager.currentLevelId;
      return makeStairHostResolverFromScene(levelId ? levelManager.getLevelScene(levelId) : null);
    },
    [levelManager],
  );

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: StairEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      await acquireLock(entity.id);
      await svc.saveStair(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordStairChange(
        isNew ? 'created' : 'updated',
        { id: entity.id, kind: entity.kind, layerId: entity.layerId, params: entity.params },
        { prevParams: prevParams ?? undefined },
      );
      if (companyId && projectId && buildingId) {
        void upsertStairBoq(
          { id: entity.id, kind: entity.kind, params: entity.params },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined, resolveHostInput: buildStairHostResolver(entity) },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STAIR_SAVE_ERROR');
      setSaveState('error');
    }
  }, [acquireLock, companyId, projectId, buildingId, floorId, buildStairHostResolver]);

  // Auto-save debounce on selected stair params change.
  useEffect(() => {
    const stair = primarySelectedStair;
    if (!stair || !serviceRef.current) return;
    // ADR-390 — Bug A defense-in-depth.
    const known = lastSavedParamsRef.current.has(stair.id);
    const pendingStair = pendingFirstSaveIdsRef.current.has(stair.id);
    if (!known && !pendingStair) return;
    const lastSaved = lastSavedParamsRef.current.get(stair.id);
    if (lastSaved && dequal(lastSaved, stair.params)) return;

    dirtyIdsRef.current.add(stair.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(stair);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedStair, persist]);

  // ADR-358 Phase 9C-3 — delete stair from Firestore + scene cleanup.
  // Mirrors useWallPersistence.deleteWall. Called via bim:stair-delete-requested
  // event emitted by useSmartDelete after DeleteEntityCommand removes from scene.
  const deleteStair = useCallback(async (stairId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === stairId);
    const deletedStair = (deletedEntity && isStair(deletedEntity)) ? deletedEntity : null;

    try {
      await svc.deleteStair(stairId);
      void recordStairChange(
        'deleted',
        deletedStair
          ? { id: deletedStair.id, kind: deletedStair.kind, layerId: deletedStair.layerId, params: deletedStair.params }
          : { id: stairId, kind: 'straight' },
      );
      void deleteStairBoq(stairId);
    } catch {
      // Non-fatal — scene already updated by DeleteEntityCommand.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== stairId);
      if (nextEntities.length !== scene.entities.length) {
        levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
      }
    }

    dirtyIdsRef.current.delete(stairId);
    lastSavedParamsRef.current.delete(stairId);
    pendingFirstSaveIdsRef.current.delete(stairId);
    deletedIdsRef.current.add(stairId);

    if (lockHeldRef.current === stairId) {
      void releaseLock();
    }
  }, [levelManager, releaseLock]);

  // ADR-390 — persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: StairEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await acquireLock(entity.id);
      await svc.saveStair(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordStairChange(
        'restored',
        { id: entity.id, kind: entity.kind, layerId: entity.layerId, params: entity.params },
      );
      if (companyId && projectId && buildingId) {
        void upsertStairBoq(
          { id: entity.id, kind: entity.kind, params: entity.params },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined, resolveHostInput: buildStairHostResolver(entity) },
          'created',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STAIR_RESTORE_ERROR');
      setSaveState('error');
    }
  }, [acquireLock, companyId, projectId, buildingId, floorId, buildStairHostResolver]);

  // Imperative save trigger (explicit "Αποθήκευση" button).
  const saveNow = useCallback(async () => {
    const stair = selectedStairRef.current;
    if (!stair) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(stair);
  }, [persist]);

  // ADR-358 Phase 9C-3 — delete-requested listener (useSmartDelete emits after confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:stair-delete-requested', ({ stairId }) => {
      void deleteStair(stairId);
    });
    return cleanup;
  }, [deleteStair]);

  // ADR-358 Phase Q17 9B-6 — listen for `drawing:entity-created` so the
  // first persistence of a freshly drawn stair fires immediately, without
  // requiring the user to select + edit it. Pairs with the diff-merge
  // preserve guard above: the local stair survives the next Firestore
  // snapshot AND lands in `floorplan_stairs/{stairId}` on the same tick.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'stair') return;
      const entity = payload.entity as StairEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'stair') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // ADR-390 — symmetric undo→Firestore restore.
  useBimEntityRestoredPersistEffect(
    'stair',
    isStair,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteStair }),
    [saveState, lastSavedAt, error, saveNow, deleteStair],
  );
}
