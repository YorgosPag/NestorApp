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
import { Timestamp } from 'firebase/firestore';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type {
  StairDoc,
  StairEntity,
  StairValidationState,
} from '../../types/stair';
import { computeStairGeometry } from '../../systems/stairs/StairGeometryService';
import { EventBus } from '../../systems/events/EventBus';
import {
  createStairFirestoreService,
  entityToSaveInput,
  StairFirestoreService,
} from '../../systems/stairs/stair-firestore-service';

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
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedStair: StairEntity | null;
}

export interface UseStairPersistenceResult {
  readonly saveState: StairSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;
const LOCK_TTL_MS = 5 * 60 * 1000;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a scene-side `StairEntity` from a persisted `StairDoc`. Geometry is
 * recomputed via the SSoT `computeStairGeometry` — ADR §G6: geometry is NOT
 * persisted (re-derivable from params).
 */
function docToEntity(doc: StairDoc): StairEntity {
  const validation: StairValidationState = doc.validation ?? {
    hasCodeViolations: false,
    violationKeys: [],
    lastValidatedAt: Timestamp.now(),
  };
  return {
    id: doc.id,
    type: 'stair',
    kind: doc.kind,
    params: doc.params,
    geometry: computeStairGeometry(doc.params),
    validation,
    layer: doc.layer ?? 'STAIRS',
    levelId: doc.levelId,
    visible: true,
    editingBy: doc.editingBy,
    qto: doc.qto,
  } as StairEntity;
}

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

        for (const doc of docs) {
          const existing = sceneStairs.get(doc.id);
          if (!existing) {
            // Remote add — only if not currently in local-create flow.
            if (!dirty.has(doc.id)) {
              nextStairs.push(docToEntity(doc));
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
            nextStairs.push(docToEntity(doc));
            mutated = true;
          } else {
            nextStairs.push(existing);
          }
        }

        for (const [id, entity] of sceneStairs) {
          if (docsById.has(id)) continue;
          // ADR-358 Phase Q17 9B-6 — preserve local stairs that have NEVER
          // been persisted yet (optimistic insert). Without this guard, a
          // freshly drawn stair flickers in then out: tool adds it to the
          // local scene → snapshot fires → diff-merge sees "in scene but
          // not in docs" and drops it. Industry pattern (Revit transaction
          // model + Firestore optimistic UI 5/5): local-never-saved always
          // wins until either a save round-trip completes OR the user
          // explicitly deletes it via a delete command.
          const neverSaved = !lastSavedParamsRef.current.has(id);
          if (dirty.has(id) || neverSaved) {
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

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: StairEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await acquireLock(entity.id);
      await svc.saveStair(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STAIR_SAVE_ERROR');
      setSaveState('error');
    }
  }, [acquireLock]);

  // Auto-save debounce on selected stair params change.
  useEffect(() => {
    const stair = primarySelectedStair;
    if (!stair || !serviceRef.current) return;
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
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Unmount cleanup — release lock + flush pending timers.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      void releaseLock();
    };
  }, [releaseLock]);

  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow }),
    [saveState, lastSavedAt, error, saveNow],
  );
}
