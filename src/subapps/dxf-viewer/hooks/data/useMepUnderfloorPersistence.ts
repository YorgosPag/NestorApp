'use client';

/**
 * ADR-408 Εύρος Β #3 — Underfloor heating loop Firestore persistence React adapter.
 *
 * Bridges `MepUnderfloorFirestoreService` to the scene model owned by `LevelsSystem`.
 * Mirrors `useMepBoilerPersistence` — same hybrid auto-save, selective-skip
 * diff-merge, connector-systemId projection guard, and first-save listener wired to
 * `drawing:entity-created` with `tool === 'mep-underfloor'`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';
import {
  computeMepUnderfloorGeometry,
  validateMepUnderfloorParams,
} from '../../bim/mep-underfloor/mep-underfloor-geometry';
import { EventBus } from '../../systems/events/EventBus';
import {
  createMepUnderfloorFirestoreService,
  entityToSaveInput,
  MepUnderfloorFirestoreService,
  type MepUnderfloorDoc,
} from '../../bim/mep-underfloor/mep-underfloor-firestore-service';
import { recordMepUnderfloorChange } from '../../bim/mep-underfloor/mep-underfloor-audit-client';
import { projectConnectorSystemIds } from '../../bim/mep-systems/mep-system-coordinator';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type MepUnderfloorSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseMepUnderfloorPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey id. Forwarded to service config. */
  readonly floorId?: string | null;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed (BimToBoqBridge). */
  readonly buildingId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedUnderfloor: MepUnderfloorEntity | null;
}

export interface UseMepUnderfloorPersistenceResult {
  readonly saveState: MepUnderfloorSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteUnderfloor: (underfloorId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isUnderfloor(entity: AnySceneEntity): entity is MepUnderfloorEntity {
  return (entity as { type?: string }).type === 'mep-underfloor';
}

/** Build scene-side `MepUnderfloorEntity` from a persisted `MepUnderfloorDoc`. */
function docToEntity(doc: MepUnderfloorDoc): MepUnderfloorEntity {
  const validation = doc.validation ?? validateMepUnderfloorParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'mep-underfloor',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeMepUnderfloorGeometry(doc.params),
    validation,
    visible: true,
  } as MepUnderfloorEntity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMepUnderfloorPersistence(
  params: UseMepUnderfloorPersistenceParams,
): UseMepUnderfloorPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    floorId,
    buildingId,
    userId,
    levelManager,
    primarySelectedUnderfloor,
  } = params;

  const [saveState, setSaveState] = useState<MepUnderfloorSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<MepUnderfloorFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, MepUnderfloorEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedUnderfloorRef = useRef<MepUnderfloorEntity | null>(null);
  selectedUnderfloorRef.current = primarySelectedUnderfloor;

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
    serviceRef.current = createMepUnderfloorFirestoreService({
      companyId,
      projectId,
      floorplanId,
      floorId: floorId ?? undefined,
      userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty underfloors.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeUnderfloors(
      (docs) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, MepUnderfloorDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneUnderfloors = new Map<string, MepUnderfloorEntity>();
        const nonUnderfloors: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isUnderfloor(e)) sceneUnderfloors.set(e.id, e);
          else nonUnderfloors.push(e);
        }

        const nextUnderfloors: MepUnderfloorEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneUnderfloors.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextUnderfloors.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextUnderfloors.push(existing);
            continue;
          }
          // Project the live (reconciler-owned) systemId cache onto the fresh doc
          // entity, ignoring the doc's non-authoritative systemId — same ping-pong
          // guard as the boiler/fixture/manifold hook (ADR-408 idle-loop fix).
          const fresh = docToEntity(doc);
          const freshConnectors = fresh.params.connectors ?? [];
          const projected = projectConnectorSystemIds(freshConnectors, existing.params.connectors);
          const candidate =
            projected === freshConnectors
              ? fresh
              : { ...fresh, params: { ...fresh.params, connectors: projected } };
          if (!dequal(existing.params, candidate.params)) {
            nextUnderfloors.push(candidate);
            mutated = true;
          } else {
            nextUnderfloors.push(existing);
          }
        }

        // Seed last-saved baseline for every Firestore doc.
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        for (const [id, entity] of sceneUnderfloors) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextUnderfloors.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: [...nonUnderfloors, ...nextUnderfloors],
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
  const persist = useCallback(async (entity: MepUnderfloorEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveUnderfloor(entityToSaveInput(entity));
      } else {
        await svc.updateUnderfloor(entity.id, {
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
      void recordMepUnderfloorChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      // ADR-408 — Η-Μ BOQ auto-feed: underfloor loop = developed serpentine pipe
      // length (m, ΗΛΜ-7.04). totalLengthM → BimEntityForBoq.geometry.lengthM.
      if (companyId && projectId && buildingId) {
        void bimToBoqBridge.upsertBoqItemForBim(
          'mep-underfloor',
          { id: entity.id, kind: entity.kind, geometry: { lengthM: entity.geometry.totalLengthM } },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_UNDERFLOOR_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId]);

  // Auto-save debounce on selected underfloor params change.
  useEffect(() => {
    const underfloor = primarySelectedUnderfloor;
    if (!underfloor || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(underfloor.id);
    const pending = pendingFirstSaveIdsRef.current.has(underfloor.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(underfloor.id);
    if (lastSaved && dequal(lastSaved, underfloor.params)) return;

    dirtyIdsRef.current.add(underfloor.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(underfloor);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedUnderfloor, persist]);

  const saveNow = useCallback(async () => {
    const underfloor = selectedUnderfloorRef.current;
    if (!underfloor) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(underfloor);
  }, [persist]);

  // Delete underfloor: remove from Firestore + scene + audit.
  const deleteUnderfloor = useCallback(async (underfloorId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === underfloorId);
    const deletedUnderfloor = (deletedEntity && isUnderfloor(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteUnderfloor(underfloorId);
      void recordMepUnderfloorChange(
        'deleted',
        deletedUnderfloor
          ? { id: deletedUnderfloor.id, kind: deletedUnderfloor.kind, layerId: deletedUnderfloor.layerId, params: deletedUnderfloor.params }
          : { id: underfloorId, kind: 'hydronic-loop' },
      );
      // ADR-408 — remove the auto-fed Η-Μ BOQ row (skips user-detached rows).
      if (companyId) void bimToBoqBridge.deleteBoqItemForBim(underfloorId, companyId);
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== underfloorId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(underfloorId);
    lastSavedParamsRef.current.delete(underfloorId);
    pendingFirstSaveIdsRef.current.delete(underfloorId);
    deletedIdsRef.current.add(underfloorId);
  }, [levelManager, companyId]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: MepUnderfloorEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveUnderfloor(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordMepUnderfloorChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_UNDERFLOOR_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately for freshly drawn underfloors.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'mep-underfloor') return;
      const entity = payload.entity as MepUnderfloorEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'mep-underfloor') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (smart-delete emits after batch filter).
  useEffect(() => {
    const cleanup = EventBus.on('bim:mep-underfloor-delete-requested', ({ underfloorId }) => {
      void deleteUnderfloor(underfloorId);
    });
    return cleanup;
  }, [deleteUnderfloor]);

  useBimEntityRestoredPersistEffect(
    'mep-underfloor',
    isUnderfloor,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteUnderfloor }),
    [saveState, lastSavedAt, error, saveNow, deleteUnderfloor],
  );
}
