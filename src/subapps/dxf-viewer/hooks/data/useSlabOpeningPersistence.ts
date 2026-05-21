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
import type { SlabOpeningEntity } from '../../bim/types/slab-opening-types';
import { computeSlabOpeningGeometry } from '../../bim/geometry/slab-opening-geometry';
import { validateSlabOpeningParams } from '../../bim/validators/slab-opening-validator';
import { EventBus } from '../../systems/events/EventBus';
import {
  createSlabOpeningFirestoreService,
  entityToSaveInput,
  SlabOpeningFirestoreService,
  type SlabOpeningDoc,
} from '../../bim/slab-openings/slab-opening-firestore-service';
import { recordSlabOpeningChange } from '../../bim/slab-openings/slab-opening-audit-client';

// ============================================================================
// TYPES
// ============================================================================

export type SlabOpeningSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseSlabOpeningPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<SlabOpeningEntity | null>(null);
  selectedRef.current = primarySelectedSlabOpening;

  // Instantiate service όταν auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createSlabOpeningFirestoreService({
      companyId,
      projectId,
      floorplanId,
      userId,
    });
  }, [companyId, projectId, floorplanId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty docs.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeSlabOpenings(
      (docs) => {
        const scene = levelManager.getLevelScene(levelId);
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

        for (const doc of docs) {
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

        for (const [id, entity] of sceneEntities) {
          if (docsById.has(id)) continue;
          const neverSaved = !lastSavedParamsRef.current.has(id);
          if (dirty.has(id) || neverSaved) {
            nextSlabOpenings.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          levelManager.setLevelScene(levelId, {
            ...scene,
            entities: [...others, ...nextSlabOpenings],
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

  const persist = useCallback(async (entity: SlabOpeningEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const isNew = !lastSavedParamsRef.current.has(entity.id);
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveSlabOpening(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordSlabOpeningChange(isNew ? 'created' : 'updated', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SLAB_OPENING_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Auto-save debounce σε selected slab-opening params change.
  useEffect(() => {
    const entity = primarySelectedSlabOpening;
    if (!entity || !serviceRef.current) return;
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

    try {
      await svc.deleteSlabOpening(slabOpeningId);
      void recordSlabOpeningChange(
        'deleted',
        {
          id: slabOpeningId,
          kind: (deletedEntity as Partial<SlabOpeningEntity>)?.kind ?? 'shaft',
        },
      );
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== slabOpeningId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(slabOpeningId);
    lastSavedParamsRef.current.delete(slabOpeningId);
  }, [levelManager]);

  // First-save listener — fires άμεσα για freshly drawn slab-openings.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'slab-opening') return;
      const entity = payload.entity as SlabOpeningEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'slab-opening') return;
      if (!serviceRef.current) return;
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

  // ADR-363 fix — multi-entity move dirty-flag propagation (mirrors useWallPersistence).
  useEffect(() => {
    const cleanup = EventBus.on('bim:entities-moved', ({ movedEntities }) => {
      if (!serviceRef.current) return;
      for (const entity of movedEntities) {
        if (!isSlabOpening(entity)) continue;
        dirtyIdsRef.current.add(entity.id);
        void persist(entity);
      }
    });
    return cleanup;
  }, [persist]);

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
