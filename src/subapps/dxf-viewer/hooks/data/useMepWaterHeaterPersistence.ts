'use client';

/**
 * ADR-408 DHW — Domestic hot water heater Firestore persistence React adapter.
 *
 * Bridges `MepWaterHeaterFirestoreService` to the scene model owned by `LevelsSystem`.
 * Mirrors `useMepBoilerPersistence` — same hybrid auto-save, selective-skip
 * diff-merge, and first-save listener wired to `drawing:entity-created` with
 * `tool === 'mep-water-heater'`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import {
  computeMepWaterHeaterGeometry,
  validateMepWaterHeaterParams,
} from '../../bim/mep-water-heaters/mep-water-heater-geometry';
import { EventBus } from '../../systems/events/EventBus';
import {
  createMepWaterHeaterFirestoreService,
  entityToSaveInput,
  MepWaterHeaterFirestoreService,
  type MepWaterHeaterDoc,
} from '../../bim/mep-water-heaters/mep-water-heater-firestore-service';
import { recordMepWaterHeaterChange } from '../../bim/mep-water-heaters/mep-water-heater-audit-client';
import { projectConnectorSystemIds } from '../../bim/mep-systems/mep-system-coordinator';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type MepWaterHeaterSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseMepWaterHeaterPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey id. Forwarded to service config. */
  readonly floorId?: string | null;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed (BimToBoqBridge). */
  readonly buildingId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedWaterHeater: MepWaterHeaterEntity | null;
}

export interface UseMepWaterHeaterPersistenceResult {
  readonly saveState: MepWaterHeaterSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteWaterHeater: (waterHeaterId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isWaterHeater(entity: AnySceneEntity): entity is MepWaterHeaterEntity {
  return (entity as { type?: string }).type === 'mep-water-heater';
}

/** Build scene-side `MepWaterHeaterEntity` from a persisted `MepWaterHeaterDoc`. */
function docToEntity(doc: MepWaterHeaterDoc): MepWaterHeaterEntity {
  const validation = doc.validation ?? validateMepWaterHeaterParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'mep-water-heater',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeMepWaterHeaterGeometry(doc.params),
    validation,
    visible: true,
  } as MepWaterHeaterEntity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMepWaterHeaterPersistence(
  params: UseMepWaterHeaterPersistenceParams,
): UseMepWaterHeaterPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    floorId,
    buildingId,
    userId,
    levelManager,
    primarySelectedWaterHeater,
  } = params;

  const [saveState, setSaveState] = useState<MepWaterHeaterSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<MepWaterHeaterFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, MepWaterHeaterEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedWaterHeaterRef = useRef<MepWaterHeaterEntity | null>(null);
  selectedWaterHeaterRef.current = primarySelectedWaterHeater;

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
    serviceRef.current = createMepWaterHeaterFirestoreService({
      companyId,
      projectId,
      floorplanId,
      floorId: floorId ?? undefined,
      userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty water heaters.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeWaterHeaters(
      (docs) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, MepWaterHeaterDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneWaterHeaters = new Map<string, MepWaterHeaterEntity>();
        const nonWaterHeaters: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isWaterHeater(e)) sceneWaterHeaters.set(e.id, e);
          else nonWaterHeaters.push(e);
        }

        const nextWaterHeaters: MepWaterHeaterEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneWaterHeaters.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextWaterHeaters.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextWaterHeaters.push(existing);
            continue;
          }
          // Project the live (reconciler-owned) systemId cache onto the fresh doc
          // entity, ignoring the doc's non-authoritative systemId — same ping-pong
          // guard as the fixture/manifold hook (ADR-408 idle-loop fix).
          const fresh = docToEntity(doc);
          const freshConnectors = fresh.params.connectors ?? [];
          const projected = projectConnectorSystemIds(freshConnectors, existing.params.connectors);
          const candidate =
            projected === freshConnectors
              ? fresh
              : { ...fresh, params: { ...fresh.params, connectors: projected } };
          if (!dequal(existing.params, candidate.params)) {
            nextWaterHeaters.push(candidate);
            mutated = true;
          } else {
            nextWaterHeaters.push(existing);
          }
        }

        // Seed last-saved baseline for every Firestore doc.
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        for (const [id, entity] of sceneWaterHeaters) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextWaterHeaters.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: [...nonWaterHeaters, ...nextWaterHeaters],
          });
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
  const persist = useCallback(async (entity: MepWaterHeaterEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveWaterHeater(entityToSaveInput(entity));
      } else {
        await svc.updateWaterHeater(entity.id, {
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
      void recordMepWaterHeaterChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      // ADR-408 — Η-Μ BOQ auto-feed: domestic hot water heater = 1 piece.
      if (companyId && projectId && buildingId) {
        void bimToBoqBridge.upsertBoqItemForBim(
          'mep-water-heater',
          { id: entity.id, kind: entity.kind },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_WATER_HEATER_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId]);

  // Auto-save debounce on selected water heater params change.
  useEffect(() => {
    const waterHeater = primarySelectedWaterHeater;
    if (!waterHeater || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(waterHeater.id);
    const pending = pendingFirstSaveIdsRef.current.has(waterHeater.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(waterHeater.id);
    if (lastSaved && dequal(lastSaved, waterHeater.params)) return;

    dirtyIdsRef.current.add(waterHeater.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(waterHeater);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedWaterHeater, persist]);

  const saveNow = useCallback(async () => {
    const waterHeater = selectedWaterHeaterRef.current;
    if (!waterHeater) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(waterHeater);
  }, [persist]);

  // Delete water heater: remove from Firestore + scene + audit.
  const deleteWaterHeater = useCallback(async (waterHeaterId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === waterHeaterId);
    const deletedWaterHeater = (deletedEntity && isWaterHeater(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteWaterHeater(waterHeaterId);
      void recordMepWaterHeaterChange(
        'deleted',
        deletedWaterHeater
          ? { id: deletedWaterHeater.id, kind: deletedWaterHeater.kind, layerId: deletedWaterHeater.layerId, params: deletedWaterHeater.params }
          : { id: waterHeaterId, kind: 'electric-water-heater' },
      );
      // ADR-408 — remove the auto-fed Η-Μ BOQ row (skips user-detached rows).
      if (companyId) void bimToBoqBridge.deleteBoqItemForBim(waterHeaterId, companyId);
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== waterHeaterId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(waterHeaterId);
    lastSavedParamsRef.current.delete(waterHeaterId);
    pendingFirstSaveIdsRef.current.delete(waterHeaterId);
    deletedIdsRef.current.add(waterHeaterId);
  }, [levelManager, companyId]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: MepWaterHeaterEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveWaterHeater(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordMepWaterHeaterChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_WATER_HEATER_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately for freshly drawn water heaters.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'mep-water-heater') return;
      const entity = payload.entity as MepWaterHeaterEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'mep-water-heater') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (smart-delete emits after batch filter).
  useEffect(() => {
    const cleanup = EventBus.on('bim:mep-water-heater-delete-requested', ({ waterHeaterId }) => {
      void deleteWaterHeater(waterHeaterId);
    });
    return cleanup;
  }, [deleteWaterHeater]);

  useBimEntityMovedPersistEffect(isWaterHeater, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'mep-water-heater',
    isWaterHeater,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteWaterHeater }),
    [saveState, lastSavedAt, error, saveNow, deleteWaterHeater],
  );
}
