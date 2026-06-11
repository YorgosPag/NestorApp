'use client';

/**
 * ADR-408 Φ12 — Plumbing manifold Firestore persistence React adapter.
 *
 * Bridges `MepManifoldFirestoreService` to the scene model owned by
 * `LevelsSystem`. Mirrors `useElectricalPanelPersistence` — same hybrid auto-save,
 * selective-skip diff-merge, and first-save listener wired to
 * `drawing:entity-created` with `tool === 'mep-manifold'`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import {
  computeMepManifoldGeometry,
  validateMepManifoldParams,
} from '../../bim/mep-manifolds/mep-manifold-geometry';
import { EventBus } from '../../systems/events/EventBus';
import {
  createMepManifoldFirestoreService,
  entityToSaveInput,
  MepManifoldFirestoreService,
  type MepManifoldDoc,
} from '../../bim/mep-manifolds/mep-manifold-firestore-service';
import { recordMepManifoldChange } from '../../bim/mep-manifolds/mep-manifold-audit-client';
import { projectConnectorSystemIds } from '../../bim/mep-systems/mep-system-coordinator';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type MepManifoldSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseMepManifoldPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string | null;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed (BimToBoqBridge). */
  readonly buildingId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedManifold: MepManifoldEntity | null;
}

export interface UseMepManifoldPersistenceResult {
  readonly saveState: MepManifoldSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteManifold: (manifoldId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isManifold(entity: AnySceneEntity): entity is MepManifoldEntity {
  return (entity as { type?: string }).type === 'mep-manifold';
}

/** Build scene-side `MepManifoldEntity` from a persisted `MepManifoldDoc`. */
function docToEntity(doc: MepManifoldDoc): MepManifoldEntity {
  const validation = doc.validation ?? validateMepManifoldParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'mep-manifold',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeMepManifoldGeometry(doc.params),
    validation,
    visible: true,
  } as MepManifoldEntity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMepManifoldPersistence(
  params: UseMepManifoldPersistenceParams,
): UseMepManifoldPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    floorId,
    buildingId,
    userId,
    levelManager,
    primarySelectedManifold,
  } = params;

  const [saveState, setSaveState] = useState<MepManifoldSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<MepManifoldFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, MepManifoldEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedManifoldRef = useRef<MepManifoldEntity | null>(null);
  selectedManifoldRef.current = primarySelectedManifold;

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
    serviceRef.current = createMepManifoldFirestoreService({
      companyId,
      projectId,
      floorplanId,
      floorId: floorId ?? undefined,
      userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty manifolds.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeManifolds(
      (docs) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, MepManifoldDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneManifolds = new Map<string, MepManifoldEntity>();
        const nonManifolds: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isManifold(e)) sceneManifolds.set(e.id, e);
          else nonManifolds.push(e);
        }

        const nextManifolds: MepManifoldEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneManifolds.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextManifolds.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextManifolds.push(existing);
            continue;
          }
          // Project the live (reconciler-owned) systemId cache onto the fresh
          // doc entity, ignoring the doc's non-authoritative systemId — same
          // ping-pong guard as the fixture hook (ADR-408 idle-loop fix).
          const fresh = docToEntity(doc);
          const freshConnectors = fresh.params.connectors ?? [];
          const projected = projectConnectorSystemIds(freshConnectors, existing.params.connectors);
          const candidate =
            projected === freshConnectors
              ? fresh
              : { ...fresh, params: { ...fresh.params, connectors: projected } };
          if (!dequal(existing.params, candidate.params)) {
            nextManifolds.push(candidate);
            mutated = true;
          } else {
            nextManifolds.push(existing);
          }
        }

        // Seed last-saved baseline for every Firestore doc.
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        for (const [id, entity] of sceneManifolds) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextManifolds.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: [...nonManifolds, ...nextManifolds],
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
  const persist = useCallback(async (entity: MepManifoldEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveManifold(entityToSaveInput(entity));
      } else {
        await svc.updateManifold(entity.id, {
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
      void recordMepManifoldChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      // ADR-408 — Η-Μ BOQ auto-feed: manifold body = 1 piece (ΗΛΜ-7.03 συλλέκτης
      // θέρμανσης / ΗΛΜ-6.02 φρεάτιο αποχέτευσης, keyed by kind).
      if (companyId && projectId && buildingId) {
        void bimToBoqBridge.upsertBoqItemForBim(
          'mep-manifold',
          { id: entity.id, kind: entity.kind },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_MANIFOLD_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId]);

  // Auto-save debounce on selected manifold params change.
  useEffect(() => {
    const manifold = primarySelectedManifold;
    if (!manifold || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(manifold.id);
    const pending = pendingFirstSaveIdsRef.current.has(manifold.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(manifold.id);
    if (lastSaved && dequal(lastSaved, manifold.params)) return;

    dirtyIdsRef.current.add(manifold.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(manifold);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedManifold, persist]);

  const saveNow = useCallback(async () => {
    const manifold = selectedManifoldRef.current;
    if (!manifold) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(manifold);
  }, [persist]);

  // Delete manifold: remove from Firestore + scene + audit.
  const deleteManifold = useCallback(async (manifoldId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === manifoldId);
    const deletedManifold = (deletedEntity && isManifold(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteManifold(manifoldId);
      void recordMepManifoldChange(
        'deleted',
        deletedManifold
          ? { id: deletedManifold.id, kind: deletedManifold.kind, layerId: deletedManifold.layerId, params: deletedManifold.params }
          : { id: manifoldId, kind: 'floor-manifold' },
      );
      // ADR-408 — remove the auto-fed Η-Μ BOQ row (skips user-detached rows).
      if (companyId) void bimToBoqBridge.deleteBoqItemForBim(manifoldId, companyId);
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== manifoldId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(manifoldId);
    lastSavedParamsRef.current.delete(manifoldId);
    pendingFirstSaveIdsRef.current.delete(manifoldId);
    deletedIdsRef.current.add(manifoldId);
  }, [levelManager, companyId]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: MepManifoldEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveManifold(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordMepManifoldChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_MANIFOLD_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately for freshly drawn manifolds.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'mep-manifold') return;
      const entity = payload.entity as MepManifoldEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'mep-manifold') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (smart-delete emits after batch filter).
  useEffect(() => {
    const cleanup = EventBus.on('bim:mep-manifold-delete-requested', ({ manifoldId }) => {
      void deleteManifold(manifoldId);
    });
    return cleanup;
  }, [deleteManifold]);

  useBimEntityMovedPersistEffect(isManifold, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'mep-manifold',
    isManifold,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteManifold }),
    [saveState, lastSavedAt, error, saveNow, deleteManifold],
  );
}
