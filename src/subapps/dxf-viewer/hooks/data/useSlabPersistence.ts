'use client';

/**
 * ADR-363 Phase 3 — Slab Firestore persistence React adapter.
 *
 * Bridges `SlabFirestoreService` σε scene model owned by `LevelsSystem`.
 * Mirrors `useOpeningPersistence` — same hybrid auto-save pattern, same
 * selective skip diff-merge, same first-save listener wired σε
 * `drawing:entity-created` με tool='slab'.
 *
 * Persistence trigger — hybrid:
 *   - Debounced auto-save 500 ms μετά από `slab.params` change settle.
 *   - `saveNow()` imperative escape hatch.
 *
 * Scene sync — diff-merge με selective skip:
 *   - Κάθε snapshot adds / updates / removes slabs στο active scene.
 *   - Slabs marked locally-dirty ΠΟΤΕ overwritten από snapshot data.
 *
 * Geometry re-derivation: όταν φτάνει snapshot από Firestore, η γεωμετρία
 * αναπαράγεται client-side από `params`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SlabEntity } from '../../bim/types/slab-types';
import type { BeamEntity } from '../../bim/types/beam-types';
import type { WallEntity } from '../../bim/types/wall-types';
import {
  computeSlabGeometry,
  type BeamFootprintForDeduction,
  type WallFootprintForSpan,
} from '../../bim/geometry/slab-geometry';
import { validateSlabParams } from '../../bim/validators/slab-validator';
import { EventBus } from '../../systems/events/EventBus';
import {
  createSlabFirestoreService,
  entityToSaveInput,
  SlabFirestoreService,
  type SlabDoc,
} from '../../bim/slabs/slab-firestore-service';
import { recordSlabChange } from '../../bim/slabs/slab-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';

// ============================================================================
// TYPES
// ============================================================================

export type SlabSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseSlabPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
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
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isSlab(entity: AnySceneEntity): entity is SlabEntity {
  return (entity as { type?: string }).type === 'slab';
}

/**
 * Phase 5.5i+ — Collect beam footprints from scene for slab BOQ volume deduction.
 * Reads beams already in memory (no Firestore query).
 */
function collectBeamFootprints(scene: SceneModel | null): BeamFootprintForDeduction[] {
  if (!scene) return [];
  const result: BeamFootprintForDeduction[] = [];
  for (const e of scene.entities) {
    if ((e as { type?: string }).type !== 'beam') continue;
    const beam = e as BeamEntity;
    if (beam.geometry?.outline && beam.params.depth > 0) {
      result.push({ outline: beam.geometry.outline, depthMm: beam.params.depth });
    }
  }
  return result;
}

/**
 * Phase 3.8 — Collect wall footprints from scene for slab free-span computation.
 * Constructs plan-view outline from outerEdge + innerEdge (already in memory).
 */
function collectWallFootprints(scene: SceneModel | null): WallFootprintForSpan[] {
  if (!scene) return [];
  const result: WallFootprintForSpan[] = [];
  for (const e of scene.entities) {
    if ((e as { type?: string }).type !== 'wall') continue;
    const wall = e as WallEntity;
    const outer = wall.geometry?.outerEdge?.points;
    const inner = wall.geometry?.innerEdge?.points;
    if (!outer || !inner || outer.length < 2 || inner.length < 2) continue;
    // CCW outline: outer start→end, inner reversed (end→start)
    const outlineVertices = [...outer, ...[...inner].reverse()];
    result.push({ outline: { vertices: outlineVertices } });
  }
  return result;
}

/**
 * Build scene-side `SlabEntity` από persisted `SlabDoc`. Geometry +
 * validation recomputed via SSoT pure functions. Phase 3.8: always recompute
 * geometry (ensures `maxFreeSpanM` present; wall/beam context added at
 * persist time via `computeSlabGeometry` with full footprints).
 */
function docToEntity(doc: SlabDoc): SlabEntity {
  const validation = doc.validation ?? validateSlabParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'slab',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: computeSlabGeometry(doc.params),
    validation,
    visible: true,
  } as SlabEntity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useSlabPersistence(
  params: UseSlabPersistenceParams,
): UseSlabPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    buildingId,
    userId,
    levelManager,
    primarySelectedSlab,
  } = params;

  const [saveState, setSaveState] = useState<SlabSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<SlabFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, SlabEntity['params']>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedSlabRef = useRef<SlabEntity | null>(null);
  selectedSlabRef.current = primarySelectedSlab;

  // Instantiate service όταν auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createSlabFirestoreService({
      companyId,
      projectId,
      floorplanId,
      userId,
    });
  }, [companyId, projectId, floorplanId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty slabs.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeSlabs(
      (docs) => {
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, SlabDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneSlabs = new Map<string, SlabEntity>();
        const nonSlabs: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isSlab(e)) sceneSlabs.set(e.id, e);
          else nonSlabs.push(e);
        }

        const nextSlabs: SlabEntity[] = [];
        let mutated = false;

        for (const doc of docs) {
          const existing = sceneSlabs.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextSlabs.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextSlabs.push(existing);
            continue;
          }
          if (!dequal(existing.params, doc.params)) {
            nextSlabs.push(docToEntity(doc));
            mutated = true;
          } else {
            nextSlabs.push(existing);
          }
        }

        for (const [id, entity] of sceneSlabs) {
          if (docsById.has(id)) continue;
          const neverSaved = !lastSavedParamsRef.current.has(id);
          if (dirty.has(id) || neverSaved) {
            nextSlabs.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          levelManager.setLevelScene(levelId, {
            ...scene,
            entities: [...nonSlabs, ...nextSlabs],
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

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: SlabEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const isNew = !lastSavedParamsRef.current.has(entity.id);
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveSlab(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordSlabChange(isNew ? 'created' : 'updated', entity);
      if (companyId && projectId && buildingId) {
        const levelId = levelManager.currentLevelId;
        const scene = levelId ? levelManager.getLevelScene(levelId) : null;
        const beamFootprints = collectBeamFootprints(scene);
        const wallFootprints = collectWallFootprints(scene);
        const hasSupports = beamFootprints.length > 0 || wallFootprints.length > 0;
        const boqGeometry = hasSupports
          ? computeSlabGeometry(entity.params, undefined, beamFootprints, wallFootprints)
          : entity.geometry;
        void bimToBoqBridge.upsertBoqItemForBim(
          'slab',
          { id: entity.id, kind: entity.kind, geometry: boqGeometry },
          { companyId, projectId, buildingId },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SLAB_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, levelManager]);

  // Auto-save debounce σε selected slab params change.
  useEffect(() => {
    const slab = primarySelectedSlab;
    if (!slab || !serviceRef.current) return;
    const lastSaved = lastSavedParamsRef.current.get(slab.id);
    if (lastSaved && dequal(lastSaved, slab.params)) return;

    dirtyIdsRef.current.add(slab.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(slab);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedSlab, persist]);

  const saveNow = useCallback(async () => {
    const slab = selectedSlabRef.current;
    if (!slab) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(slab);
  }, [persist]);

  // Phase 3 — Delete slab: remove από Firestore + scene + audit.
  const deleteSlab = useCallback(async (slabId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === slabId);

    try {
      await svc.deleteSlab(slabId);
      void recordSlabChange(
        'deleted',
        { id: slabId, kind: (deletedEntity as Partial<SlabEntity>)?.kind ?? 'floor' },
      );
      void bimToBoqBridge.deleteBoqItemForBim(slabId, companyId ?? '');
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== slabId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(slabId);
    lastSavedParamsRef.current.delete(slabId);
  }, [levelManager, companyId]);

  // First-save listener — fires άμεσα για freshly drawn slabs.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'slab') return;
      const entity = payload.entity as SlabEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'slab') return;
      if (!serviceRef.current) return;
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (bridge emits μετά από confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:slab-delete-requested', ({ slabId }) => {
      void deleteSlab(slabId);
    });
    return cleanup;
  }, [deleteSlab]);

  // Phase 5.5i+ — Re-BOQ all slabs when a beam changes (move/resize/delete).
  // Reads scene beams from memory — no extra Firestore query.
  useEffect(() => {
    if (!companyId || !projectId || !buildingId) return;
    const ctx = { companyId, projectId, buildingId };
    const cleanup = EventBus.on('bim:beam-persisted', () => {
      const levelId = levelManager.currentLevelId;
      const scene = levelId ? levelManager.getLevelScene(levelId) : null;
      if (!scene) return;
      const beamFootprints = collectBeamFootprints(scene);
      const wallFootprints = collectWallFootprints(scene);
      for (const entity of scene.entities) {
        if ((entity as { type?: string }).type !== 'slab') continue;
        const slab = entity as SlabEntity;
        const hasSupports = beamFootprints.length > 0 || wallFootprints.length > 0;
        const boqGeometry = hasSupports
          ? computeSlabGeometry(slab.params, undefined, beamFootprints, wallFootprints)
          : slab.geometry;
        void bimToBoqBridge.upsertBoqItemForBim(
          'slab',
          { id: slab.id, kind: slab.kind, geometry: boqGeometry },
          ctx,
          'updated',
        );
      }
    });
    return cleanup;
  }, [levelManager, companyId, projectId, buildingId]);

  // ADR-363 fix — multi-entity move dirty-flag propagation (mirrors useWallPersistence).
  useEffect(() => {
    const cleanup = EventBus.on('bim:entities-moved', ({ movedEntities }) => {
      if (!serviceRef.current) return;
      for (const entity of movedEntities) {
        if (!isSlab(entity)) continue;
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteSlab }),
    [saveState, lastSavedAt, error, saveNow, deleteSlab],
  );
}
