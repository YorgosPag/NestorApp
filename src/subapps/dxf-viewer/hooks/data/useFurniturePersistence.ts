'use client';

/**
 * ADR-410 — Furniture Firestore persistence React adapter.
 *
 * Bridges `FurnitureFirestoreService` to the scene model owned by
 * `LevelsSystem`. Mirrors `useMepFixturePersistence` — same hybrid auto-save,
 * selective-skip diff-merge, first-save listener wired to `drawing:entity-created`
 * with `tool === 'furniture'`, delete + undo restore. No connector reconciliation
 * (furniture carries no MEP connectors).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-410-cc0-mesh-furniture-import.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { FurnitureEntity } from '../../bim/types/furniture-types';
import {
  computeFurnitureGeometry,
  validateFurnitureParams,
} from '../../bim/furniture/furniture-geometry';
import { EventBus } from '../../systems/events/EventBus';
import {
  createFurnitureFirestoreService,
  entityToSaveInput,
  FurnitureFirestoreService,
  type FurnitureDoc,
} from '../../bim/furniture/furniture-firestore-service';
import { recordFurnitureChange } from '../../bim/furniture/furniture-audit-client';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type FurnitureSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseFurniturePersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedFurniture: FurnitureEntity | null;
}

export interface UseFurniturePersistenceResult {
  readonly saveState: FurnitureSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteFurniture: (furnitureId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isFurniture(entity: AnySceneEntity): entity is FurnitureEntity {
  return (entity as { type?: string }).type === 'furniture';
}

/** Build scene-side `FurnitureEntity` from a persisted `FurnitureDoc`. */
function docToEntity(doc: FurnitureDoc): FurnitureEntity {
  const validation = doc.validation ?? validateFurnitureParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'furniture',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeFurnitureGeometry(doc.params),
    validation,
    visible: true,
  } as FurnitureEntity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useFurniturePersistence(
  params: UseFurniturePersistenceParams,
): UseFurniturePersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    floorId,
    userId,
    levelManager,
    primarySelectedFurniture,
  } = params;

  const [saveState, setSaveState] = useState<FurnitureSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<FurnitureFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, FurnitureEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedFurnitureRef = useRef<FurnitureEntity | null>(null);
  selectedFurnitureRef.current = primarySelectedFurniture;

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
    serviceRef.current = createFurnitureFirestoreService({
      companyId,
      projectId,
      floorplanId,
      floorId: floorId ?? undefined,
      userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty furniture.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeFurniture(
      (docs) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, FurnitureDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneFurniture = new Map<string, FurnitureEntity>();
        const nonFurniture: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isFurniture(e)) sceneFurniture.set(e.id, e);
          else nonFurniture.push(e);
        }

        const nextFurniture: FurnitureEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneFurniture.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextFurniture.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextFurniture.push(existing);
            continue;
          }
          const fresh = docToEntity(doc);
          if (!dequal(existing.params, fresh.params)) {
            nextFurniture.push(fresh);
            mutated = true;
          } else {
            nextFurniture.push(existing);
          }
        }

        // Seed last-saved baseline for every Firestore doc.
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        for (const [id, entity] of sceneFurniture) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextFurniture.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: [...nonFurniture, ...nextFurniture],
          }, 'remote-echo');
        }
      },
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [currentLevelId, companyId, projectId, floorplanId, floorId, userId]);

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: FurnitureEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveFurniture(entityToSaveInput(entity));
      } else {
        await svc.updateFurniture(entity.id, {
          params: entity.params,
          validation: entity.validation,
          geometry: entity.geometry,
          layerId: entity.layerId,
        });
      }
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordFurnitureChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FURNITURE_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Auto-save debounce on selected furniture params change.
  useEffect(() => {
    const furniture = primarySelectedFurniture;
    if (!furniture || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(furniture.id);
    const pending = pendingFirstSaveIdsRef.current.has(furniture.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(furniture.id);
    if (lastSaved && dequal(lastSaved, furniture.params)) return;

    dirtyIdsRef.current.add(furniture.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(furniture);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedFurniture, persist]);

  const saveNow = useCallback(async () => {
    const furniture = selectedFurnitureRef.current;
    if (!furniture) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(furniture);
  }, [persist]);

  // Delete furniture: remove from Firestore + scene + audit.
  const deleteFurniture = useCallback(async (furnitureId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === furnitureId);
    const deletedFurniture = (deletedEntity && isFurniture(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteFurniture(furnitureId);
      void recordFurnitureChange(
        'deleted',
        deletedFurniture
          ? { id: deletedFurniture.id, kind: deletedFurniture.kind, layerId: deletedFurniture.layerId, params: deletedFurniture.params }
          : { id: furnitureId, kind: 'chair' },
      );
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== furnitureId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(furnitureId);
    lastSavedParamsRef.current.delete(furnitureId);
    pendingFirstSaveIdsRef.current.delete(furnitureId);
    deletedIdsRef.current.add(furnitureId);
  }, [levelManager]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: FurnitureEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveFurniture(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordFurnitureChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FURNITURE_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately for freshly drawn furniture.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'furniture') return;
      const entity = payload.entity as FurnitureEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'furniture') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (bridge emits after confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:furniture-delete-requested', ({ furnitureId }) => {
      void deleteFurniture(furnitureId);
    });
    return cleanup;
  }, [deleteFurniture]);

  useBimEntityMovedPersistEffect(isFurniture, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'furniture',
    isFurniture,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteFurniture }),
    [saveState, lastSavedAt, error, saveNow, deleteFurniture],
  );
}
