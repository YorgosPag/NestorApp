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

import type { StairEntity } from '../types/stair-types';
import { makeStairHostResolverFromScene } from '../geometry/stairs/stair-host-resolver';
import { EventBus } from '../../systems/events/EventBus';
import {
  createStairFirestoreService,
  entityToSaveInput,
  StairFirestoreService,
} from '../stairs/stair-firestore-service';
import { recordStairChange } from '../stairs/stair-audit-client';
import { useBimEntityRestoredPersistEffect } from '../../hooks/data/useBimEntityRestoredPersistEffect';
import { useBimEntityAttachedPersistEffect } from '../../hooks/data/useBimEntityAttachedPersistEffect';
import { upsertStairBoq, deleteStairBoq } from '../services/stair-boq-sync';
import { isStair, mergeStairSnapshot } from '../stairs/stair-snapshot-merge';
import { isStairCreateTool } from '../stairs/stair-create-tools';
import { DXF_TIMING } from '../../config/dxf-timing';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';

// ============================================================================
// TYPES
// ============================================================================

export type StairSaveState = 'idle' | 'saving' | 'saved' | 'error';


export interface UseStairPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-395 Phase 2 (G1) — BOQ auto-feed scope. Omitted by hosts that don't feed BOQ. */
  readonly buildingId?: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId?: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
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

const AUTO_SAVE_DEBOUNCE_MS = DXF_TIMING.persist.ENTITY_AUTOSAVE; // ADR-516
const LOCK_TTL_MS = DXF_TIMING.lifecycle.LOCK_TTL; // ADR-516

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
      floorId: floorId ?? undefined,
      userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip of locally-dirty stairs.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeStairs(
      (docs) => {
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;

        const { entities, mutated } = mergeStairSnapshot(docs, scene, {
          dirty: dirtyIdsRef.current,
          deleted: deletedIdsRef.current,
          pending: pendingFirstSaveIdsRef.current,
          lastSavedParams: lastSavedParamsRef.current,
        });

        if (mutated) {
          levelManager.setLevelScene(levelId, { ...scene, entities }, 'remote-echo');
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

  // Shared post-save side-effects (audit trail + BoQ upsert) for persist /
  // persistRestore. Action strings differ per caller; the payload shape is identical.
  const recordStairSaveSideEffects = useCallback(
    (
      entity: StairEntity,
      auditAction: Parameters<typeof recordStairChange>[0],
      boqAction: Parameters<typeof upsertStairBoq>[2],
      prevParams?: StairEntity['params'],
    ) => {
      void recordStairChange(
        auditAction,
        { id: entity.id, kind: entity.kind, layerId: entity.layerId, params: entity.params },
        { prevParams },
      );
      if (companyId && projectId && buildingId) {
        void upsertStairBoq(
          { id: entity.id, kind: entity.kind, params: entity.params },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined, resolveHostInput: buildStairHostResolver(entity) },
          boqAction,
        );
      }
    },
    [companyId, projectId, buildingId, floorId, buildStairHostResolver],
  );

  // Shared save orchestration for both persist (create/update) and persistRestore.
  // Lock → Firestore save → ref bookkeeping → audit/BoQ side-effects, wrapped in the
  // identical saving/saved/error state machine. Callers supply only the per-flow bits.
  const commitStairSave = useCallback(
    async (
      entity: StairEntity,
      auditAction: Parameters<typeof recordStairChange>[0],
      boqAction: Parameters<typeof upsertStairBoq>[2],
      errorCode: string,
      prevParams?: StairEntity['params'],
    ) => {
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
        recordStairSaveSideEffects(entity, auditAction, boqAction, prevParams);
      } catch (err) {
        setError(err instanceof Error ? err.message : errorCode);
        setSaveState('error');
      }
    },
    [acquireLock, recordStairSaveSideEffects],
  );

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: StairEntity) => {
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    await commitStairSave(
      entity,
      isNew ? 'created' : 'updated',
      isNew ? 'created' : 'updated',
      'STAIR_SAVE_ERROR',
      prevParams ?? undefined,
    );
  }, [commitStairSave]);

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
    await commitStairSave(entity, 'restored', 'created', 'STAIR_RESTORE_ERROR');
  }, [commitStairSave]);

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
      // ADR-619 Bug #6 — BOTH stair tools emit a `StairEntity`: the line-based tool
      // tags `'stair'`, «Σκάλα από περιοχή» tags `'stair-from-region'`. Without the
      // second tag the region stair never got its first Firestore save and vanished
      // on refresh (persisted local-only). SSoT `isStairCreateTool` gates the tool;
      // the `entity.type === 'stair'` guard below is the real type gate.
      if (!isStairCreateTool(payload.tool)) return;
      const entity = payload.entity as StairEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'stair') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // ADR-401 — persist stairs on attach binding change (see hook for WHY).
  useBimEntityAttachedPersistEffect(isStair, serviceRef, dirtyIdsRef, persist);

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
