'use client';

/**
 * ADR-415 Φ1 — Floorplan symbol Firestore persistence React adapter.
 *
 * Bridges `FloorplanSymbolFirestoreService` to the scene model owned by
 * `LevelsSystem`. Mirrors `useFurniturePersistence` — same hybrid auto-save,
 * selective-skip diff-merge, first-save listener wired to `drawing:entity-created`
 * with `tool === 'floorplan-symbol'`, delete + undo restore. No connector
 * reconciliation (floorplan symbols carry no MEP connectors).
 *
 * Φ1 has no in-app delete UI yet, so there is no delete-requested EventBus bridge;
 * `deleteFloorplanSymbol` is exposed for a later sub-step.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { FloorplanSymbolEntity } from '../../bim/types/floorplan-symbol-types';
import { EventBus } from '../../systems/events/EventBus';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import {
  createFloorplanSymbolFirestoreService,
  entityToSaveInput,
  FloorplanSymbolFirestoreService,
  type FloorplanSymbolDoc,
} from '../../bim/floorplan-symbols/floorplan-symbol-firestore-service';
import { recordFloorplanSymbolChange } from '../../bim/floorplan-symbols/floorplan-symbol-audit-client';
import { floorplanSymbolDocToEntity as docToEntity } from './floorplan-symbol-persistence-helpers';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type FloorplanSymbolSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseFloorplanSymbolPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedSymbol: FloorplanSymbolEntity | null;
}

export interface UseFloorplanSymbolPersistenceResult {
  readonly saveState: FloorplanSymbolSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteFloorplanSymbol: (symbolId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isFloorplanSymbol(entity: AnySceneEntity): entity is FloorplanSymbolEntity {
  return (entity as { type?: string }).type === 'floorplan-symbol';
}

// ============================================================================
// HOOK
// ============================================================================

export function useFloorplanSymbolPersistence(
  params: UseFloorplanSymbolPersistenceParams,
): UseFloorplanSymbolPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    floorId,
    userId,
    levelManager,
    primarySelectedSymbol,
  } = params;

  const [saveState, setSaveState] = useState<FloorplanSymbolSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<FloorplanSymbolFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, FloorplanSymbolEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedSymbolRef = useRef<FloorplanSymbolEntity | null>(null);
  selectedSymbolRef.current = primarySelectedSymbol;

  // ⚡ STABILITY (ca9 fix 2026-06-08): key the Firestore subscription off stable
  // scope primitives + `currentLevelId`, NOT the per-render `levelManager` object,
  // so onSnapshot does not unsubscribe/re-subscribe on every render (target removed
  // before ack → `INTERNAL ASSERTION FAILED ca9 {ve:-1}`). Mirror of the fitting hook.
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
    serviceRef.current = createFloorplanSymbolFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty symbols.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeFloorplanSymbols(
      (docs) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, FloorplanSymbolDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneSymbols = new Map<string, FloorplanSymbolEntity>();
        const others: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isFloorplanSymbol(e)) sceneSymbols.set(e.id, e);
          else others.push(e);
        }

        const nextSymbols: FloorplanSymbolEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneSymbols.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextSymbols.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextSymbols.push(existing);
            continue;
          }
          const fresh = docToEntity(doc);
          if (!dequal(existing.params, fresh.params)) {
            nextSymbols.push(fresh);
            mutated = true;
          } else {
            nextSymbols.push(existing);
          }
        }

        // Seed last-saved baseline for every Firestore doc.
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        for (const [id, entity] of sceneSymbols) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextSymbols.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: [...others, ...nextSymbols],
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
  const persist = useCallback(async (entity: FloorplanSymbolEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveFloorplanSymbol(entityToSaveInput(entity));
      } else {
        await svc.updateFloorplanSymbol(entity.id, {
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
      void recordFloorplanSymbolChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FLOORPLAN_SYMBOL_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Auto-save debounce on selected symbol params change.
  useEffect(() => {
    const symbol = primarySelectedSymbol;
    if (!symbol || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(symbol.id);
    const pending = pendingFirstSaveIdsRef.current.has(symbol.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(symbol.id);
    if (lastSaved && dequal(lastSaved, symbol.params)) return;

    dirtyIdsRef.current.add(symbol.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(symbol);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedSymbol, persist]);

  const saveNow = useCallback(async () => {
    const symbol = selectedSymbolRef.current;
    if (!symbol) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(symbol);
  }, [persist]);

  // Delete symbol: remove from Firestore + scene + audit.
  const deleteFloorplanSymbol = useCallback(async (symbolId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === symbolId);
    const deletedSymbol = (deletedEntity && isFloorplanSymbol(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteFloorplanSymbol(symbolId);
      void recordFloorplanSymbolChange(
        'deleted',
        deletedSymbol
          ? { id: deletedSymbol.id, kind: deletedSymbol.kind, layerId: deletedSymbol.layerId, params: deletedSymbol.params }
          : { id: symbolId, kind: 'wc' },
      );
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== symbolId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(symbolId);
    lastSavedParamsRef.current.delete(symbolId);
    pendingFirstSaveIdsRef.current.delete(symbolId);
    deletedIdsRef.current.add(symbolId);
  }, [levelManager]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: FloorplanSymbolEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveFloorplanSymbol(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordFloorplanSymbolChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'FLOORPLAN_SYMBOL_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately for freshly drawn symbols.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'floorplan-symbol') return;
      const entity = payload.entity as FloorplanSymbolEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'floorplan-symbol') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  useBimEntityMovedPersistEffect(isFloorplanSymbol, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'floorplan-symbol',
    isFloorplanSymbol,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteFloorplanSymbol }),
    [saveState, lastSavedAt, error, saveNow, deleteFloorplanSymbol],
  );
}
