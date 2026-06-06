'use client';

/**
 * ADR-419 — Floor-finish Firestore persistence React adapter.
 *
 * Simplified mirror of `useRoofPersistence` (ADR-417) — no family types,
 * no BOQ feed, no audit trail. Handles:
 *   - subscribe + diff-merge incoming Firestore docs
 *   - first-save on `drawing:entity-created` (tool: 'floor-finish')
 *   - 500ms auto-save debounce on selected entity params change
 *   - delete on `bim:floor-finish-delete-requested`
 *
 * @see docs/centralized-systems/reference/adrs/ADR-419-floor-finish-per-room.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { FloorFinishEntity } from '../../bim/types/floor-finish-types';
import { isFloorFinishEntity } from '../../types/entities';
import { EventBus } from '../../systems/events/EventBus';
import {
  createFloorFinishFirestoreService,
  floorFinishEntityToSaveInput,
  floorFinishDocToEntity,
  FloorFinishFirestoreService,
  type FloorFinishDoc,
} from '../../bim/floor-finishes/floor-finish-firestore-service';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// TYPES
// ============================================================================

export type FloorFinishSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseFloorFinishPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelected: FloorFinishEntity | null;
}

export interface UseFloorFinishPersistenceResult {
  readonly saveState: FloorFinishSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteFloorFinish: (id: string) => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFloorFinishPersistence(
  params: UseFloorFinishPersistenceParams,
): UseFloorFinishPersistenceResult {
  const { companyId, projectId, floorplanId, userId, levelManager, primarySelected } = params;

  const [saveState, setSaveState] = useState<FloorFinishSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<FloorFinishFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, FloorFinishEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<FloorFinishEntity | null>(null);
  selectedRef.current = primarySelected;

  // Instantiate service when auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createFloorFinishFirestoreService({
      companyId, projectId, floorplanId, userId,
    });
  }, [companyId, projectId, floorplanId, userId]);

  // Subscribe + diff-merge.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeFloorFinishes(
      (docs: readonly FloorFinishDoc[]) => {
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, FloorFinishDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneMap = new Map<string, FloorFinishEntity>();
        const others: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isFloorFinishEntity(e)) sceneMap.set(e.id, e);
          else others.push(e);
        }

        const nextEntities: FloorFinishEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const d of docs) {
          if (deleted.has(d.id)) continue;
          const existing = sceneMap.get(d.id);
          if (!existing) {
            if (!dirty.has(d.id)) { nextEntities.push(floorFinishDocToEntity(d)); mutated = true; }
            continue;
          }
          if (dirty.has(d.id)) { nextEntities.push(existing); continue; }
          if (!dequal(existing.params, d.params)) {
            nextEntities.push(floorFinishDocToEntity(d)); mutated = true;
          } else {
            nextEntities.push(existing);
          }
        }

        for (const [id, entity] of sceneMap) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) nextEntities.push(entity);
          else mutated = true;
        }

        if (mutated) {
          levelManager.setLevelScene(levelId, { ...scene, entities: [...others, ...nextEntities] });
        }

        for (const d of docs) {
          if (!lastSavedParamsRef.current.has(d.id)) {
            lastSavedParamsRef.current.set(d.id, d.params);
          }
        }
      },
      (err: Error) => { setError(err.message); setSaveState('error'); },
    );
    return () => unsubscribe();
  }, [levelManager, companyId, projectId, floorplanId, userId]);

  // Immediate persist.
  const persist = useCallback(async (entity: FloorFinishEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const isNew = !lastSavedParamsRef.current.has(entity.id);
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveFloorFinish(floorFinishEntityToSaveInput(entity));
      } else {
        await svc.updateFloorFinish(entity.id, {
          params: entity.params,
          geometry: entity.geometry,
          layerId: entity.layerId,
        });
      }
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FLOOR_FINISH_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Auto-save debounce.
  useEffect(() => {
    const entity = primarySelected;
    if (!entity || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(entity.id);
    const pending = pendingFirstSaveIdsRef.current.has(entity.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(entity.id);
    if (lastSaved && dequal(lastSaved, entity.params)) return;

    dirtyIdsRef.current.add(entity.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { void persist(entity); }, AUTO_SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    };
  }, [primarySelected, persist]);

  const saveNow = useCallback(async () => {
    const entity = selectedRef.current;
    if (!entity) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
    await persist(entity);
  }, [persist]);

  const deleteFloorFinish = useCallback(async (id: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }

    try { await svc.deleteFloorFinish(id); } catch { /* non-fatal */ }

    const scene = levelManager.getLevelScene(levelId);
    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== id);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(id);
    lastSavedParamsRef.current.delete(id);
    pendingFirstSaveIdsRef.current.delete(id);
    deletedIdsRef.current.add(id);
  }, [levelManager]);

  // First-save listener.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'floor-finish') return;
      const entity = payload.entity as FloorFinishEntity | undefined;
      if (!entity || entity.type !== 'floor-finish') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener.
  useEffect(() => {
    const cleanup = EventBus.on('bim:floor-finish-delete-requested' as Parameters<typeof EventBus.on>[0], (payload: unknown) => {
      const id = (payload as { id?: string })?.id;
      if (id) void deleteFloorFinish(id);
    });
    return cleanup;
  }, [deleteFloorFinish]);

  useBimEntityMovedPersistEffect(isFloorFinishEntity, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'floor-finish',
    isFloorFinishEntity,
    serviceRef,
    pendingFirstSaveIdsRef,
    deletedIdsRef,
    async (entity: FloorFinishEntity) => {
      const svc = serviceRef.current;
      if (!svc) return;
      await svc.saveFloorFinish(floorFinishEntityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
    },
  );

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteFloorFinish }),
    [saveState, lastSavedAt, error, saveNow, deleteFloorFinish],
  );
}
