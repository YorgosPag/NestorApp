'use client';

/**
 * ADR-407 — Railing Firestore persistence React adapter.
 *
 * Bridges `RailingFirestoreService` to the scene model owned by `LevelsSystem`.
 * Mirrors `useMepFixturePersistence` — same hybrid auto-save, selective-skip
 * diff-merge, and first-save listener wired to `drawing:entity-created` with
 * `tool === 'railing'`. Geometry is re-derived from params on hydrate (PATH ⊥
 * TYPE → derived geometry, never persisted as truth).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { RailingEntity } from '../../bim/types/railing-types';
import { EventBus } from '../../systems/events/EventBus';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import {
  createRailingFirestoreService,
  entityToSaveInput,
  RailingFirestoreService,
  type RailingDoc,
} from '../../bim/railings/railing-firestore-service';
import { recordRailingChange } from '../../bim/railings/railing-audit-client';
import { railingDocToEntity as docToEntity } from './railing-persistence-helpers';
import { mergeDocsIntoScene } from './merge-docs-into-scene';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type RailingSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseRailingPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-407 — tenant scope for the ΑΤΟΕ BOQ auto-feed (running length, m). */
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedRailing: RailingEntity | null;
}

export interface UseRailingPersistenceResult {
  readonly saveState: RailingSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteRailing: (railingId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isRailing(entity: AnySceneEntity): entity is RailingEntity {
  return (entity as { type?: string }).type === 'railing';
}

// ============================================================================
// HOOK
// ============================================================================

export function useRailingPersistence(
  params: UseRailingPersistenceParams,
): UseRailingPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId,
    levelManager,
    primarySelectedRailing,
  } = params;

  const [saveState, setSaveState] = useState<RailingSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<RailingFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, RailingEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRailingRef = useRef<RailingEntity | null>(null);
  selectedRailingRef.current = primarySelectedRailing;

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
    serviceRef.current = createRailingFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty railings.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeRailings(
      // Diff-merge μέσω του `mergeDocsIntoScene` SSoT — comparable = `params`
      // (μηδέν copy-pasted loop· mirror column/hatch). Δεν έχει write-grace →
      // `isWithinGrace: () => false`.
      (docs) => {
        mergeDocsIntoScene<RailingDoc, RailingEntity, RailingEntity['params']>(
          docs,
          levelId,
          levelManagerRef.current,
          {
            isEntity: isRailing,
            docToEntity,
            entityComparable: (e) => e.params,
            docComparable: (d) => d.params,
          },
          {
            dirty: dirtyIdsRef.current,
            deleted: deletedIdsRef.current,
            pending: pendingFirstSaveIdsRef.current,
            isWithinGrace: () => false,
            lastSavedBaseline: lastSavedParamsRef.current,
          },
        );
      },
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [currentLevelId, companyId, projectId, floorplanId, floorId, userId]);

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: RailingEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveRailing(entityToSaveInput(entity));
      } else {
        await svc.updateRailing(entity.id, {
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
      void recordRailingChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      // ADR-407 — ΑΤΟΕ BOQ auto-feed: railing = running length (m) via
      // geometry.lengthM (OIK-12.01 «Κιγκλίδωμα μεταλλικό»). Mirror of beam.
      if (companyId && projectId && buildingId) {
        void bimToBoqBridge.upsertBoqItemForBim(
          'railing',
          { id: entity.id, kind: entity.kind, geometry: entity.geometry },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RAILING_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId]);

  // Auto-save debounce on selected railing params change.
  useEffect(() => {
    const railing = primarySelectedRailing;
    if (!railing || !serviceRef.current) return;
    const known = lastSavedParamsRef.current.has(railing.id);
    const pending = pendingFirstSaveIdsRef.current.has(railing.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(railing.id);
    if (lastSaved && dequal(lastSaved, railing.params)) return;

    dirtyIdsRef.current.add(railing.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(railing);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedRailing, persist]);

  const saveNow = useCallback(async () => {
    const railing = selectedRailingRef.current;
    if (!railing) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(railing);
  }, [persist]);

  // Delete railing: remove from Firestore + scene + audit.
  const deleteRailing = useCallback(async (railingId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === railingId);
    const deletedRailing = (deletedEntity && isRailing(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteRailing(railingId);
      void recordRailingChange(
        'deleted',
        deletedRailing
          ? { id: deletedRailing.id, kind: deletedRailing.kind, layerId: deletedRailing.layerId, params: deletedRailing.params }
          : { id: railingId, kind: 'railing' },
      );
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== railingId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(railingId);
    lastSavedParamsRef.current.delete(railingId);
    pendingFirstSaveIdsRef.current.delete(railingId);
    deletedIdsRef.current.add(railingId);
  }, [levelManager]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: RailingEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveRailing(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordRailingChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RAILING_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately for freshly drawn railings.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'railing') return;
      const entity = payload.entity as RailingEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'railing') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (bridge emits after confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:railing-delete-requested', ({ railingId }) => {
      void deleteRailing(railingId);
    });
    return cleanup;
  }, [deleteRailing]);

  useBimEntityMovedPersistEffect(isRailing, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'railing',
    isRailing,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteRailing }),
    [saveState, lastSavedAt, error, saveNow, deleteRailing],
  );
}
