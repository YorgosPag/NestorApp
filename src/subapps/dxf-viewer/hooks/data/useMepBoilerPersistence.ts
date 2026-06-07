'use client';

/**
 * ADR-408 Εύρος Β #2 — Heating boiler Firestore persistence React adapter.
 *
 * Bridges `MepBoilerFirestoreService` to the scene model owned by `LevelsSystem`.
 * Mirrors `useMepRadiatorPersistence` — same hybrid auto-save, selective-skip
 * diff-merge, and first-save listener wired to `drawing:entity-created` with
 * `tool === 'mep-boiler'`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
import {
  computeMepBoilerGeometry,
  validateMepBoilerParams,
} from '../../bim/mep-boilers/mep-boiler-geometry';
import { EventBus } from '../../systems/events/EventBus';
import {
  createMepBoilerFirestoreService,
  entityToSaveInput,
  MepBoilerFirestoreService,
  type MepBoilerDoc,
} from '../../bim/mep-boilers/mep-boiler-firestore-service';
import { recordMepBoilerChange } from '../../bim/mep-boilers/mep-boiler-audit-client';
import { projectConnectorSystemIds } from '../../bim/mep-systems/mep-system-coordinator';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type MepBoilerSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseMepBoilerPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey id. Forwarded to service config. */
  readonly floorId?: string | null;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed (BimToBoqBridge). */
  readonly buildingId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedBoiler: MepBoilerEntity | null;
}

export interface UseMepBoilerPersistenceResult {
  readonly saveState: MepBoilerSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteBoiler: (boilerId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isBoiler(entity: AnySceneEntity): entity is MepBoilerEntity {
  return (entity as { type?: string }).type === 'mep-boiler';
}

/** Build scene-side `MepBoilerEntity` from a persisted `MepBoilerDoc`. */
function docToEntity(doc: MepBoilerDoc): MepBoilerEntity {
  const validation = doc.validation ?? validateMepBoilerParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'mep-boiler',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeMepBoilerGeometry(doc.params),
    validation,
    visible: true,
  } as MepBoilerEntity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useMepBoilerPersistence(
  params: UseMepBoilerPersistenceParams,
): UseMepBoilerPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    floorId,
    buildingId,
    userId,
    levelManager,
    primarySelectedBoiler,
  } = params;

  const [saveState, setSaveState] = useState<MepBoilerSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<MepBoilerFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, MepBoilerEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedBoilerRef = useRef<MepBoilerEntity | null>(null);
  selectedBoilerRef.current = primarySelectedBoiler;

  // Instantiate service when auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createMepBoilerFirestoreService({
      companyId,
      projectId,
      floorplanId,
      floorId: floorId ?? undefined,
      userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty boilers.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeBoilers(
      (docs) => {
        const scene = levelManager.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, MepBoilerDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneBoilers = new Map<string, MepBoilerEntity>();
        const nonBoilers: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isBoiler(e)) sceneBoilers.set(e.id, e);
          else nonBoilers.push(e);
        }

        const nextBoilers: MepBoilerEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneBoilers.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextBoilers.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextBoilers.push(existing);
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
            nextBoilers.push(candidate);
            mutated = true;
          } else {
            nextBoilers.push(existing);
          }
        }

        // Seed last-saved baseline for every Firestore doc.
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        for (const [id, entity] of sceneBoilers) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextBoilers.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          levelManager.setLevelScene(levelId, {
            ...scene,
            entities: [...nonBoilers, ...nextBoilers],
          });
        }
      },
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [levelManager, companyId, projectId, floorplanId, floorId, userId]);

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: MepBoilerEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveBoiler(entityToSaveInput(entity));
      } else {
        await svc.updateBoiler(entity.id, {
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
      void recordMepBoilerChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      // ADR-408 — Η-Μ BOQ auto-feed: heating boiler = 1 piece (ΗΛΜ-7.02).
      if (companyId && projectId && buildingId) {
        void bimToBoqBridge.upsertBoqItemForBim(
          'mep-boiler',
          { id: entity.id, kind: entity.kind },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_BOILER_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId]);

  // Auto-save debounce on selected boiler params change.
  useEffect(() => {
    const boiler = primarySelectedBoiler;
    if (!boiler || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(boiler.id);
    const pending = pendingFirstSaveIdsRef.current.has(boiler.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(boiler.id);
    if (lastSaved && dequal(lastSaved, boiler.params)) return;

    dirtyIdsRef.current.add(boiler.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(boiler);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedBoiler, persist]);

  const saveNow = useCallback(async () => {
    const boiler = selectedBoilerRef.current;
    if (!boiler) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(boiler);
  }, [persist]);

  // Delete boiler: remove from Firestore + scene + audit.
  const deleteBoiler = useCallback(async (boilerId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === boilerId);
    const deletedBoiler = (deletedEntity && isBoiler(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteBoiler(boilerId);
      void recordMepBoilerChange(
        'deleted',
        deletedBoiler
          ? { id: deletedBoiler.id, kind: deletedBoiler.kind, layerId: deletedBoiler.layerId, params: deletedBoiler.params }
          : { id: boilerId, kind: 'wall-boiler' },
      );
      // ADR-408 — remove the auto-fed Η-Μ BOQ row (skips user-detached rows).
      if (companyId) void bimToBoqBridge.deleteBoqItemForBim(boilerId, companyId);
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== boilerId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(boilerId);
    lastSavedParamsRef.current.delete(boilerId);
    pendingFirstSaveIdsRef.current.delete(boilerId);
    deletedIdsRef.current.add(boilerId);
  }, [levelManager, companyId]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: MepBoilerEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveBoiler(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordMepBoilerChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_BOILER_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately for freshly drawn boilers.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'mep-boiler') return;
      const entity = payload.entity as MepBoilerEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'mep-boiler') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (smart-delete emits after batch filter).
  useEffect(() => {
    const cleanup = EventBus.on('bim:mep-boiler-delete-requested', ({ boilerId }) => {
      void deleteBoiler(boilerId);
    });
    return cleanup;
  }, [deleteBoiler]);

  useBimEntityMovedPersistEffect(isBoiler, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'mep-boiler',
    isBoiler,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteBoiler }),
    [saveState, lastSavedAt, error, saveNow, deleteBoiler],
  );
}
