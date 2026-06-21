'use client';

/**
 * ADR-511 — Wall-covering Firestore persistence React adapter.
 *
 * Πιστό mirror του `useFloorFinishPersistence` (ADR-419). Χειρίζεται:
 *   - subscribe + diff-merge incoming Firestore docs
 *   - first-save σε `drawing:entity-created` (tool: 'wall-covering')
 *   - 500ms auto-save debounce σε αλλαγή params της επιλεγμένης οντότητας
 *   - delete σε `bim:wall-covering-delete-requested`
 *
 * @see docs/centralized-systems/reference/adrs/ADR-511-wall-finish-per-room.md
 * @see hooks/data/useFloorFinishPersistence.ts — το πρότυπο
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { WallCoveringEntity } from '../../bim/types/wall-covering-types';
import { isWallCoveringEntity } from '../../types/entities';
import { EventBus } from '../../systems/events/EventBus';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import {
  createWallCoveringFirestoreService,
  wallCoveringEntityToSaveInput,
  wallCoveringDocToEntity,
  WallCoveringFirestoreService,
  type WallCoveringDoc,
} from '../../bim/wall-coverings/wall-covering-firestore-service';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';
import { useBimFirestoreWriteGrace } from './useBimFirestoreWriteGrace';

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// TYPES
// ============================================================================

export type WallCoveringSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseWallCoveringPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelected: WallCoveringEntity | null;
}

export interface UseWallCoveringPersistenceResult {
  readonly saveState: WallCoveringSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteWallCovering: (id: string) => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useWallCoveringPersistence(
  params: UseWallCoveringPersistenceParams,
): UseWallCoveringPersistenceResult {
  const { companyId, projectId, floorplanId, floorId, userId, levelManager, primarySelected } = params;

  const [saveState, setSaveState] = useState<WallCoveringSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<WallCoveringFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const { recordWrite, isWithinGrace } = useBimFirestoreWriteGrace();
  const lastSavedParamsRef = useRef<Map<string, WallCoveringEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<WallCoveringEntity | null>(null);
  selectedRef.current = primarySelected;

  // ⚡ STABILITY: key the Firestore subscription off stable scope primitives +
  // `currentLevelId`, NOT the per-render `levelManager` object (ca9 churn fix).
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
    serviceRef.current = createWallCoveringFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge (keyed on STABLE primitives only — ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeWallCoverings(
      (docs: readonly WallCoveringDoc[]) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, WallCoveringDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneMap = new Map<string, WallCoveringEntity>();
        const others: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isWallCoveringEntity(e)) sceneMap.set(e.id, e);
          else others.push(e);
        }

        const nextEntities: WallCoveringEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const d of docs) {
          if (deleted.has(d.id)) continue;
          const existing = sceneMap.get(d.id);
          if (!existing) {
            if (!dirty.has(d.id)) { nextEntities.push(wallCoveringDocToEntity(d)); mutated = true; }
            continue;
          }
          if (dirty.has(d.id)) { nextEntities.push(existing); continue; }
          // Grace-period guard (useBimFirestoreWriteGrace SSoT) — suppress stale snapshots.
          if (isWithinGrace(d.id)) { nextEntities.push(existing); continue; }
          if (!dequal(existing.params, d.params)) {
            nextEntities.push(wallCoveringDocToEntity(d)); mutated = true;
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
          lm.setLevelScene(levelId, { ...scene, entities: [...others, ...nextEntities] }, 'remote-echo');
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
  }, [currentLevelId, companyId, projectId, floorplanId, floorId, userId]);

  // Immediate persist.
  const persist = useCallback(async (entity: WallCoveringEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const isNew = !lastSavedParamsRef.current.has(entity.id);
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveWallCovering(wallCoveringEntityToSaveInput(entity));
      } else {
        await svc.updateWallCovering(entity.id, {
          params: entity.params,
          geometry: entity.geometry,
          layerId: entity.layerId,
        });
      }
      lastSavedParamsRef.current.set(entity.id, entity.params);
      recordWrite(entity.id);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WALL_COVERING_SAVE_ERROR');
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

  const deleteWallCovering = useCallback(async (id: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }

    try { await svc.deleteWallCovering(id); } catch { /* non-fatal */ }

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
      if (payload.tool !== 'wall-covering') return;
      const entity = payload.entity as WallCoveringEntity | undefined;
      if (!entity || entity.type !== 'wall-covering') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener.
  useEffect(() => {
    const cleanup = EventBus.on('bim:wall-covering-delete-requested', (payload) => {
      if (payload.id) void deleteWallCovering(payload.id);
    });
    return cleanup;
  }, [deleteWallCovering]);

  useBimEntityMovedPersistEffect(isWallCoveringEntity, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'wall-covering',
    isWallCoveringEntity,
    serviceRef,
    pendingFirstSaveIdsRef,
    deletedIdsRef,
    async (entity: WallCoveringEntity) => {
      const svc = serviceRef.current;
      if (!svc) return;
      await svc.saveWallCovering(wallCoveringEntityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      recordWrite(entity.id);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
    },
  );

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteWallCovering }),
    [saveState, lastSavedAt, error, saveNow, deleteWallCovering],
  );
}
