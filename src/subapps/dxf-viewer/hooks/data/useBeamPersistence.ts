'use client';

/**
 * ADR-363 Phase 5 — Beam Firestore persistence React adapter.
 *
 * Bridges `BeamFirestoreService` σε scene model owned by `LevelsSystem`.
 * Mirrors `useColumnPersistence` — same hybrid auto-save pattern, same
 * selective skip diff-merge, same first-save listener wired σε
 * `drawing:entity-created` με tool='beam'.
 *
 * Persistence trigger — hybrid:
 *   - Debounced auto-save 500 ms μετά από `beam.params` change settle.
 *   - `saveNow()` imperative escape hatch.
 *
 * Scene sync — diff-merge με selective skip:
 *   - Κάθε snapshot adds / updates / removes beams στο active scene.
 *   - Beams marked locally-dirty ΠΟΤΕ overwritten από snapshot data.
 *
 * Geometry re-derivation: όταν φτάνει snapshot από Firestore, η γεωμετρία
 * αναπαράγεται client-side από `params`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { BeamEntity } from '../../bim/types/beam-types';
import { computeBeamGeometry } from '../../bim/geometry/beam-geometry';
import { validateBeamParams } from '../../bim/validators/beam-validator';
import { EventBus } from '../../systems/events/EventBus';
import {
  createBeamFirestoreService,
  entityToSaveInput,
  BeamFirestoreService,
  type BeamDoc,
} from '../../bim/beams/beam-firestore-service';
import { recordBeamChange } from '../../bim/beams/beam-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type BeamSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseBeamPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedBeam: BeamEntity | null;
}

export interface UseBeamPersistenceResult {
  readonly saveState: BeamSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteBeam: (beamId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isBeam(entity: AnySceneEntity): entity is BeamEntity {
  return (entity as { type?: string }).type === 'beam';
}

/**
 * Build scene-side `BeamEntity` από persisted `BeamDoc`. Geometry +
 * validation recomputed via SSoT pure functions.
 */
function docToEntity(doc: BeamDoc): BeamEntity {
  const validation = doc.validation ?? validateBeamParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'beam',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeBeamGeometry(doc.params),
    validation,
    visible: true,
  } as BeamEntity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useBeamPersistence(
  params: UseBeamPersistenceParams,
): UseBeamPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    buildingId,
    userId,
    levelManager,
    primarySelectedBeam,
  } = params;

  const [saveState, setSaveState] = useState<BeamSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<BeamFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, BeamEntity['params']>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedBeamRef = useRef<BeamEntity | null>(null);
  selectedBeamRef.current = primarySelectedBeam;

  // Instantiate service όταν auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createBeamFirestoreService({
      companyId,
      projectId,
      floorplanId,
      userId,
    });
  }, [companyId, projectId, floorplanId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty beams.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeBeams(
      (docs) => {
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, BeamDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneBeams = new Map<string, BeamEntity>();
        const nonBeams: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isBeam(e)) sceneBeams.set(e.id, e);
          else nonBeams.push(e);
        }

        const nextBeams: BeamEntity[] = [];
        let mutated = false;

        for (const doc of docs) {
          const existing = sceneBeams.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextBeams.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextBeams.push(existing);
            continue;
          }
          if (!dequal(existing.params, doc.params)) {
            nextBeams.push(docToEntity(doc));
            mutated = true;
          } else {
            nextBeams.push(existing);
          }
        }

        for (const [id, entity] of sceneBeams) {
          if (docsById.has(id)) continue;
          const neverSaved = !lastSavedParamsRef.current.has(id);
          if (dirty.has(id) || neverSaved) {
            nextBeams.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          levelManager.setLevelScene(levelId, {
            ...scene,
            entities: [...nonBeams, ...nextBeams],
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
  const persist = useCallback(async (entity: BeamEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const isNew = !lastSavedParamsRef.current.has(entity.id);
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveBeam(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordBeamChange(isNew ? 'created' : 'updated', entity);
      if (companyId && projectId && buildingId) {
        void bimToBoqBridge.upsertBoqItemForBim(
          'beam',
          { id: entity.id, kind: entity.kind, geometry: entity.geometry },
          { companyId, projectId, buildingId },
          isNew ? 'created' : 'updated',
        );
      }
      if (floorplanId) EventBus.emit('bim:beam-persisted', { floorplanId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'BEAM_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorplanId]);

  // Auto-save debounce σε selected beam params change.
  useEffect(() => {
    const beam = primarySelectedBeam;
    if (!beam || !serviceRef.current) return;
    const lastSaved = lastSavedParamsRef.current.get(beam.id);
    if (lastSaved && dequal(lastSaved, beam.params)) return;

    dirtyIdsRef.current.add(beam.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(beam);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedBeam, persist]);

  const saveNow = useCallback(async () => {
    const beam = selectedBeamRef.current;
    if (!beam) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(beam);
  }, [persist]);

  // Phase 5 — Delete beam: remove από Firestore + scene + audit.
  const deleteBeam = useCallback(async (beamId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === beamId);

    try {
      await svc.deleteBeam(beamId);
      void recordBeamChange(
        'deleted',
        { id: beamId, kind: (deletedEntity as Partial<BeamEntity>)?.kind ?? 'straight' },
      );
      void bimToBoqBridge.deleteBoqItemForBim(beamId, companyId ?? '');
      if (floorplanId) EventBus.emit('bim:beam-persisted', { floorplanId });
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== beamId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(beamId);
    lastSavedParamsRef.current.delete(beamId);
  }, [levelManager, companyId, floorplanId]);

  // First-save listener — fires άμεσα για freshly drawn beams.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'beam') return;
      const entity = payload.entity as BeamEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'beam') return;
      if (!serviceRef.current) return;
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (bridge emits μετά από confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:beam-delete-requested', ({ beamId }) => {
      void deleteBeam(beamId);
    });
    return cleanup;
  }, [deleteBeam]);

  useBimEntityMovedPersistEffect(isBeam, serviceRef, dirtyIdsRef, persist);

  // Unmount cleanup — flush pending timers.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteBeam }),
    [saveState, lastSavedAt, error, saveNow, deleteBeam],
  );
}
