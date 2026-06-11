'use client';

/**
 * ADR-422 L0 — Thermal-space Firestore persistence React adapter.
 *
 * Mirror of `useFloorFinishPersistence` (ADR-419, area entity). Handles:
 *   - subscribe + diff-merge incoming Firestore docs
 *   - first-save on `drawing:entity-created` (tool: 'thermal-space')
 *   - 500ms auto-save debounce on selected entity params change
 *   - delete on `bim:thermal-space-delete-requested`
 *
 * @see docs/centralized-systems/reference/adrs/ADR-422-bim-heating-mechanical-study.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { ThermalSpaceEntity } from '../../bim/types/thermal-space-types';
import { isThermalSpaceEntity } from '../../types/entities';
import { EventBus } from '../../systems/events/EventBus';
import {
  createThermalSpaceFirestoreService,
  thermalSpaceEntityToSaveInput,
  thermalSpaceDocToEntity,
  ThermalSpaceFirestoreService,
  type ThermalSpaceDoc,
} from '../../bim/thermal-spaces/thermal-space-firestore-service';
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

export type ThermalSpaceSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseThermalSpacePersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelected: ThermalSpaceEntity | null;
}

export interface UseThermalSpacePersistenceResult {
  readonly saveState: ThermalSpaceSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteThermalSpace: (id: string) => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useThermalSpacePersistence(
  params: UseThermalSpacePersistenceParams,
): UseThermalSpacePersistenceResult {
  const { companyId, projectId, floorplanId, floorId, userId, levelManager, primarySelected } = params;

  const [saveState, setSaveState] = useState<ThermalSpaceSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<ThermalSpaceFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const { recordWrite, isWithinGrace } = useBimFirestoreWriteGrace();
  const lastSavedParamsRef = useRef<Map<string, ThermalSpaceEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<ThermalSpaceEntity | null>(null);
  selectedRef.current = primarySelected;

  // ⚡ STABILITY (ca9 fix 2026-06-08): key the Firestore subscription off stable
  // scope primitives + `currentLevelId`, NOT the per-render `levelManager` object,
  // so onSnapshot does not unsubscribe/re-subscribe on every render (target removed
  // before ack → `INTERNAL ASSERTION FAILED ca9 {ve:-1}`). Mirror of the fitting hook.
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const currentLevelId = levelManager.currentLevelId;

  // Instantiate service when auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createThermalSpaceFirestoreService({
      companyId,
      projectId,
      floorplanId,
      floorId: floorId ?? undefined,
      userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeThermalSpaces(
      (docs: readonly ThermalSpaceDoc[]) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, ThermalSpaceDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneMap = new Map<string, ThermalSpaceEntity>();
        const others: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isThermalSpaceEntity(e)) sceneMap.set(e.id, e);
          else others.push(e);
        }

        const nextEntities: ThermalSpaceEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const d of docs) {
          if (deleted.has(d.id)) continue;
          const existing = sceneMap.get(d.id);
          if (!existing) {
            if (!dirty.has(d.id)) { nextEntities.push(thermalSpaceDocToEntity(d)); mutated = true; }
            continue;
          }
          if (dirty.has(d.id)) { nextEntities.push(existing); continue; }
          // Grace-period guard (useBimFirestoreWriteGrace SSoT): suppress stale
          // Firestore snapshots that arrive after a Firebase Watch-stream reset
          // during the post-write window — same fix as walls/columns/floor-finish.
          if (isWithinGrace(d.id)) { nextEntities.push(existing); continue; }
          if (!dequal(existing.params, d.params)) {
            nextEntities.push(thermalSpaceDocToEntity(d)); mutated = true;
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
  }, [currentLevelId, companyId, projectId, floorplanId, userId]);

  // Immediate persist.
  const persist = useCallback(async (entity: ThermalSpaceEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const isNew = !lastSavedParamsRef.current.has(entity.id);
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveThermalSpace(thermalSpaceEntityToSaveInput(entity));
      } else {
        await svc.updateThermalSpace(entity.id, {
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
      setError(err instanceof Error ? err.message : 'THERMAL_SPACE_SAVE_ERROR');
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

  const deleteThermalSpace = useCallback(async (id: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }

    try { await svc.deleteThermalSpace(id); } catch { /* non-fatal */ }

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
      if (payload.tool !== 'thermal-space') return;
      const entity = payload.entity as ThermalSpaceEntity | undefined;
      if (!entity || entity.type !== 'thermal-space') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener.
  useEffect(() => {
    const cleanup = EventBus.on('bim:thermal-space-delete-requested', (payload) => {
      if (payload.id) void deleteThermalSpace(payload.id);
    });
    return cleanup;
  }, [deleteThermalSpace]);

  useBimEntityMovedPersistEffect(isThermalSpaceEntity, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'thermal-space',
    isThermalSpaceEntity,
    serviceRef,
    pendingFirstSaveIdsRef,
    deletedIdsRef,
    async (entity: ThermalSpaceEntity) => {
      const svc = serviceRef.current;
      if (!svc) return;
      await svc.saveThermalSpace(thermalSpaceEntityToSaveInput(entity));
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteThermalSpace }),
    [saveState, lastSavedAt, error, saveNow, deleteThermalSpace],
  );
}
