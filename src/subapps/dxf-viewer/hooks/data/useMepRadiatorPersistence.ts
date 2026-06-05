'use client';

/**
 * ADR-408 Εύρος Β #1 — Heating radiator Firestore persistence React adapter.
 *
 * Bridges `MepRadiatorFirestoreService` to the scene model owned by `LevelsSystem`.
 * Mirrors `useMepManifoldPersistence` — same hybrid auto-save, selective-skip
 * diff-merge, and first-save listener wired to `drawing:entity-created` with
 * `tool === 'mep-radiator'`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import {
  computeMepRadiatorGeometry,
  validateMepRadiatorParams,
} from '../../bim/mep-radiators/mep-radiator-geometry';
import { EventBus } from '../../systems/events/EventBus';
import {
  createMepRadiatorFirestoreService,
  entityToSaveInput,
  MepRadiatorFirestoreService,
  type MepRadiatorDoc,
} from '../../bim/mep-radiators/mep-radiator-firestore-service';
import { recordMepRadiatorChange } from '../../bim/mep-radiators/mep-radiator-audit-client';
import { projectConnectorSystemIds } from '../../bim/mep-systems/mep-system-coordinator';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type MepRadiatorSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseMepRadiatorPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedRadiator: MepRadiatorEntity | null;
}

export interface UseMepRadiatorPersistenceResult {
  readonly saveState: MepRadiatorSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteRadiator: (radiatorId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isRadiator(entity: AnySceneEntity): entity is MepRadiatorEntity {
  return (entity as { type?: string }).type === 'mep-radiator';
}

/** Build scene-side `MepRadiatorEntity` from a persisted `MepRadiatorDoc`. */
function docToEntity(doc: MepRadiatorDoc): MepRadiatorEntity {
  const validation = doc.validation ?? validateMepRadiatorParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'mep-radiator',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeMepRadiatorGeometry(doc.params),
    validation,
    visible: true,
  } as MepRadiatorEntity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMepRadiatorPersistence(
  params: UseMepRadiatorPersistenceParams,
): UseMepRadiatorPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    userId,
    levelManager,
    primarySelectedRadiator,
  } = params;

  const [saveState, setSaveState] = useState<MepRadiatorSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<MepRadiatorFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, MepRadiatorEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRadiatorRef = useRef<MepRadiatorEntity | null>(null);
  selectedRadiatorRef.current = primarySelectedRadiator;

  // Instantiate service when auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createMepRadiatorFirestoreService({
      companyId,
      projectId,
      floorplanId,
      userId,
    });
  }, [companyId, projectId, floorplanId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty radiators.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeRadiators(
      (docs) => {
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, MepRadiatorDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneRadiators = new Map<string, MepRadiatorEntity>();
        const nonRadiators: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isRadiator(e)) sceneRadiators.set(e.id, e);
          else nonRadiators.push(e);
        }

        const nextRadiators: MepRadiatorEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneRadiators.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextRadiators.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextRadiators.push(existing);
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
            nextRadiators.push(candidate);
            mutated = true;
          } else {
            nextRadiators.push(existing);
          }
        }

        // Seed last-saved baseline for every Firestore doc.
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        for (const [id, entity] of sceneRadiators) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextRadiators.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          levelManager.setLevelScene(levelId, {
            ...scene,
            entities: [...nonRadiators, ...nextRadiators],
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
  const persist = useCallback(async (entity: MepRadiatorEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveRadiator(entityToSaveInput(entity));
      } else {
        await svc.updateRadiator(entity.id, {
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
      void recordMepRadiatorChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_RADIATOR_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Auto-save debounce on selected radiator params change.
  useEffect(() => {
    const radiator = primarySelectedRadiator;
    if (!radiator || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(radiator.id);
    const pending = pendingFirstSaveIdsRef.current.has(radiator.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(radiator.id);
    if (lastSaved && dequal(lastSaved, radiator.params)) return;

    dirtyIdsRef.current.add(radiator.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(radiator);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedRadiator, persist]);

  const saveNow = useCallback(async () => {
    const radiator = selectedRadiatorRef.current;
    if (!radiator) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(radiator);
  }, [persist]);

  // Delete radiator: remove from Firestore + scene + audit.
  const deleteRadiator = useCallback(async (radiatorId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === radiatorId);
    const deletedRadiator = (deletedEntity && isRadiator(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteRadiator(radiatorId);
      void recordMepRadiatorChange(
        'deleted',
        deletedRadiator
          ? { id: deletedRadiator.id, kind: deletedRadiator.kind, layerId: deletedRadiator.layerId, params: deletedRadiator.params }
          : { id: radiatorId, kind: 'panel-radiator' },
      );
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== radiatorId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(radiatorId);
    lastSavedParamsRef.current.delete(radiatorId);
    pendingFirstSaveIdsRef.current.delete(radiatorId);
    deletedIdsRef.current.add(radiatorId);
  }, [levelManager]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: MepRadiatorEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveRadiator(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordMepRadiatorChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_RADIATOR_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately for freshly drawn radiators.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'mep-radiator') return;
      const entity = payload.entity as MepRadiatorEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'mep-radiator') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (smart-delete emits after batch filter).
  useEffect(() => {
    const cleanup = EventBus.on('bim:mep-radiator-delete-requested', ({ radiatorId }) => {
      void deleteRadiator(radiatorId);
    });
    return cleanup;
  }, [deleteRadiator]);

  useBimEntityMovedPersistEffect(isRadiator, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'mep-radiator',
    isRadiator,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteRadiator }),
    [saveState, lastSavedAt, error, saveNow, deleteRadiator],
  );
}
