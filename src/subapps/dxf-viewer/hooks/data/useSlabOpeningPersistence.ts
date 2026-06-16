'use client';

/**
 * ADR-363 Phase 3.7 — Slab-Opening Firestore persistence React adapter.
 *
 * Bridges `SlabOpeningFirestoreService` σε scene model owned by `LevelsSystem`.
 * Mirrors `useSlabPersistence` — same hybrid auto-save pattern, same selective
 * skip diff-merge, same first-save listener wired σε `drawing:entity-created`
 * με tool='slab-opening'.
 *
 * Persistence trigger — hybrid:
 *   - Debounced auto-save 500 ms μετά από `slabOpening.params` change settle.
 *   - `saveNow()` imperative escape hatch.
 *
 * Scene sync — diff-merge με selective skip:
 *   - Κάθε snapshot adds / updates / removes slab-openings στο active scene.
 *   - Locally-dirty entities ΠΟΤΕ overwritten από snapshot data.
 *
 * Geometry re-derivation: όταν φτάνει snapshot από Firestore, η γεωμετρία
 * αναπαράγεται client-side από `params`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10 §11.Q3
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { computeSlabOpeningGeometry } from '../../bim/geometry/slab-opening-geometry';
import { validateSlabOpeningParams } from '../../bim/validators/slab-opening-validator';
import { EventBus } from '../../systems/events/EventBus';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import {
  createSlabOpeningFirestoreService,
  entityToSaveInput,
  SlabOpeningFirestoreService,
  type SlabOpeningDoc,
} from '../../bim/slab-openings/slab-opening-firestore-service';
import { recordSlabOpeningChange } from '../../bim/slab-openings/slab-opening-audit-client';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type SlabOpeningSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseSlabOpeningPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key for Firestore query/write. */
  readonly floorId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
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
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isSlabOpening(entity: AnySceneEntity): entity is SlabOpeningEntity {
  return (entity as { type?: string }).type === 'slab-opening';
}

/**
 * Build scene-side `SlabOpeningEntity` από persisted `SlabOpeningDoc`.
 * Geometry + validation recomputed via SSoT pure functions.
 */
function docToEntity(doc: SlabOpeningDoc): SlabOpeningEntity {
  const validation = doc.validation ?? validateSlabOpeningParams(doc.params, null).bimValidation;
  return {
    id: doc.id,
    type: 'slab-opening',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeSlabOpeningGeometry(doc.params),
    validation,
    visible: true,
  } as SlabOpeningEntity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSlabOpeningPersistence(
  params: UseSlabOpeningPersistenceParams,
): UseSlabOpeningPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    floorId,
    userId,
    levelManager,
    primarySelectedSlabOpening,
  } = params;

  const [saveState, setSaveState] = useState<SlabOpeningSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<SlabOpeningFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, SlabOpeningEntity['params']>>(new Map());
  // ADR-390 — pending first save (drawn or restored) + tombstone tracking.
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<SlabOpeningEntity | null>(null);
  selectedRef.current = primarySelectedSlabOpening;

  // ⚡ STABILITY (ca9 fix 2026-06-08): key the Firestore subscription off stable
  // scope primitives + `currentLevelId`, NOT the per-render `levelManager` object,
  // so onSnapshot does not unsubscribe/re-subscribe on every render (target removed
  // before ack → `INTERNAL ASSERTION FAILED ca9 {ve:-1}`). Mirror of the fitting hook.
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const currentLevelId = levelManager.currentLevelId;

  // Instantiate service όταν auth + scope ready.
  useEffect(() => {
    const scope = resolveBimPersistenceScope({ companyId, projectId, userId, floorId, floorplanId });
    if (!scope) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createSlabOpeningFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty docs.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeSlabOpenings(
      (docs) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, SlabOpeningDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneEntities = new Map<string, SlabOpeningEntity>();
        const others: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isSlabOpening(e)) sceneEntities.set(e.id, e);
          else others.push(e);
        }

        const nextSlabOpenings: SlabOpeningEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneEntities.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextSlabOpenings.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextSlabOpenings.push(existing);
            continue;
          }
          if (!dequal(existing.params, doc.params)) {
            nextSlabOpenings.push(docToEntity(doc));
            mutated = true;
          } else {
            nextSlabOpenings.push(existing);
          }
        }

        // ADR-390 — replaces buggy `neverSaved` guard.
        for (const [id, entity] of sceneEntities) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextSlabOpenings.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: [...others, ...nextSlabOpenings],
          }, 'remote-echo');
        }
      },
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [currentLevelId, companyId, projectId, floorplanId, userId]);

  const persist = useCallback(async (entity: SlabOpeningEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveSlabOpening(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordSlabOpeningChange(
        isNew ? 'created' : 'updated',
        { id: entity.id, kind: entity.kind, layerId: entity.layerId, params: entity.params },
        { prevParams: prevParams ?? undefined },
      );
      // ADR-395 G2 — host slab net volume depends on its cutouts; signal the slab
      // persistence hook to re-feed BOQ with the updated subtraction.
      EventBus.emit('bim:slab-opening-persisted', { slabId: entity.params.slabId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SLAB_OPENING_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Auto-save debounce σε selected slab-opening params change.
  useEffect(() => {
    const entity = primarySelectedSlabOpening;
    if (!entity || !serviceRef.current) return;
    // ADR-390 — Bug A defense-in-depth.
    const known = lastSavedParamsRef.current.has(entity.id);
    const pendingEntity = pendingFirstSaveIdsRef.current.has(entity.id);
    if (!known && !pendingEntity) return;
    const lastSaved = lastSavedParamsRef.current.get(entity.id);
    if (lastSaved && dequal(lastSaved, entity.params)) return;

    dirtyIdsRef.current.add(entity.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(entity);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedSlabOpening, persist]);

  const saveNow = useCallback(async () => {
    const entity = selectedRef.current;
    if (!entity) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(entity);
  }, [persist]);

  const deleteSlabOpening = useCallback(async (slabOpeningId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === slabOpeningId);
    const deletedSlabOpening = (deletedEntity && isSlabOpening(deletedEntity)) ? deletedEntity : null;
    const hostSlabId =
      deletedSlabOpening?.params.slabId ?? lastSavedParamsRef.current.get(slabOpeningId)?.slabId;

    try {
      await svc.deleteSlabOpening(slabOpeningId);
      void recordSlabOpeningChange(
        'deleted',
        deletedSlabOpening
          ? {
              id: deletedSlabOpening.id,
              kind: deletedSlabOpening.kind,
              layerId: deletedSlabOpening.layerId,
              params: deletedSlabOpening.params,
            }
          : { id: slabOpeningId, kind: 'shaft' },
      );
      // ADR-395 G2 — removing a cutout grows the host slab's net volume.
      if (hostSlabId) {
        EventBus.emit('bim:slab-opening-persisted', { slabId: hostSlabId });
      }
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== slabOpeningId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(slabOpeningId);
    lastSavedParamsRef.current.delete(slabOpeningId);
    pendingFirstSaveIdsRef.current.delete(slabOpeningId);
    deletedIdsRef.current.add(slabOpeningId);
  }, [levelManager]);

  // ADR-390 — persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: SlabOpeningEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveSlabOpening(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordSlabOpeningChange(
        'restored',
        { id: entity.id, kind: entity.kind, layerId: entity.layerId, params: entity.params },
      );
      // ADR-395 G2 — restored cutout re-shrinks the host slab's net volume.
      EventBus.emit('bim:slab-opening-persisted', { slabId: entity.params.slabId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SLAB_OPENING_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires άμεσα για freshly drawn slab-openings.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'slab-opening') return;
      const entity = payload.entity as SlabOpeningEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'slab-opening') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (bridge emits μετά από confirm).
  useEffect(() => {
    const cleanup = EventBus.on(
      'bim:slab-opening-delete-requested',
      ({ slabOpeningId }) => {
        void deleteSlabOpening(slabOpeningId);
      },
    );
    return cleanup;
  }, [deleteSlabOpening]);

  useBimEntityMovedPersistEffect(isSlabOpening, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'slab-opening',
    isSlabOpening,
    serviceRef,
    pendingFirstSaveIdsRef,
    deletedIdsRef,
    persistRestore,
  );

  // Unmount cleanup — flush pending timers.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteSlabOpening }),
    [saveState, lastSavedAt, error, saveNow, deleteSlabOpening],
  );
}
