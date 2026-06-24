'use client';

/**
 * ADR-408 Φ8 — MEP segment Firestore persistence React adapter.
 *
 * Bridges `MepSegmentFirestoreService` to the scene model owned by
 * `LevelsSystem`. Mirrors `useElectricalPanelPersistence` — same hybrid
 * auto-save, selective-skip diff-merge, and first-save listener wired to
 * `drawing:entity-created` with `tool === 'mep-segment'`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import { DXF_TIMING } from '../../config/dxf-timing';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import { EventBus } from '../../systems/events/EventBus';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import {
  createMepSegmentFirestoreService,
  entityToSaveInput,
  MepSegmentFirestoreService,
  type MepSegmentDoc,
} from '../../bim/mep-segments/mep-segment-firestore-service';
import { recordMepSegmentChange } from '../../bim/mep-segments/mep-segment-audit-client';
import { mepSegmentDocToEntity as docToEntity } from './mep-segment-persistence-helpers';
import { mergeDocsIntoScene } from './merge-docs-into-scene';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// TYPES
// ============================================================================

export type MepSegmentSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseMepSegmentPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string | null;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed (BimToBoqBridge). */
  readonly buildingId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedSegment: MepSegmentEntity | null;
}

export interface UseMepSegmentPersistenceResult {
  readonly saveState: MepSegmentSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteSegment: (segmentId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = DXF_TIMING.persist.ENTITY_AUTOSAVE; // ADR-516

// ============================================================================
// HELPERS
// ============================================================================

function isSegment(entity: AnySceneEntity): entity is MepSegmentEntity {
  return (entity as { type?: string }).type === 'mep-segment';
}

// ============================================================================
// HOOK
// ============================================================================

export function useMepSegmentPersistence(
  params: UseMepSegmentPersistenceParams,
): UseMepSegmentPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    floorId,
    buildingId,
    userId,
    levelManager,
    primarySelectedSegment,
  } = params;

  const [saveState, setSaveState] = useState<MepSegmentSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<MepSegmentFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, MepSegmentEntity['params']>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedSegmentRef = useRef<MepSegmentEntity | null>(null);
  selectedSegmentRef.current = primarySelectedSegment;

  // ⚡ STABILITY (ca9 fix 2026-06-08): `levelManager` is a NEW object on most
  // renders (`useLevels` returns a fresh memo). Depending on it in the Firestore
  // subscription effect made onSnapshot unsubscribe + re-subscribe on every render
  // — and with pipes on canvas the reconcilers re-render in bursts, so a watch
  // target was removed before the server acknowledged it → SDK assertion
  // `INTERNAL ASSERTION FAILED (ID: ca9) {ve:-1}`. Read it via a ref and key the
  // subscription off STABLE scope primitives + `currentLevelId` only (mirror of
  // useMepFittingAutoReconciliation's render-loop fix).
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
    serviceRef.current = createMepSegmentFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty segments.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeSegments(
      // Diff-merge μέσω του `mergeDocsIntoScene` SSoT — comparable = `params`. Δεν έχει
      // write-grace. EDGE (Tier 4): `shouldDropOrphan` κρατά segments που δεν έχουν
      // ποτέ persist-αριστεί (`!lastSavedBaseline.has`) — segment loaded από το DXF
      // `scene.json` δεν έχει ακόμα Firestore doc· drop ΜΟΝΟ όταν ΗΤΑΝ persisted (στο
      // baseline) ΚΑΙ το doc εξαφανίστηκε (genuine remote delete) — αλλιώς οι σωλήνες
      // εξαφανίζονται σε hard refresh.
      (docs) => {
        mergeDocsIntoScene<MepSegmentDoc, MepSegmentEntity, MepSegmentEntity['params']>(
          docs,
          levelId,
          levelManagerRef.current,
          {
            isEntity: isSegment,
            docToEntity,
            entityComparable: (e) => e.params,
            docComparable: (d) => d.params,
            shouldDropOrphan: (id, r) =>
              !r.dirty.has(id) && !r.pending.has(id) && r.lastSavedBaseline.has(id),
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

  // Immediate persist (used by auto-save flush and explicit button).
  const persist = useCallback(async (entity: MepSegmentEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    // Race guard (delete-wins): the segment was already deleted before this persist ran
    // (e.g. delete fired before the first-save's write started) — writing now would leave a
    // Firestore zombie that reappears on reload. Skip the write entirely.
    if (deletedIdsRef.current.has(entity.id)) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveSegment(entityToSaveInput(entity));
      } else {
        await svc.updateSegment(entity.id, {
          params: entity.params,
          validation: entity.validation,
          geometry: entity.geometry,
          layerId: entity.layerId,
        });
      }
      // Race guard (delete raced AHEAD while this write was in-flight): a delete's `deleteDoc`
      // ran before this `setDoc` landed, so it deleted nothing and our write is now a zombie
      // that would reappear on reload. Compensate by deleting the doc we just wrote, and skip
      // the post-save bookkeeping (the deleteSegment handler already recorded the audit/BOQ).
      if (deletedIdsRef.current.has(entity.id)) {
        await svc.deleteSegment(entity.id);
        return;
      }
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordMepSegmentChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      // ADR-408 — Η-Μ BOQ auto-feed: pipe/duct = running length (m), billed per
      // plumbing classification (Revit System takeoff). length → geometry.lengthM.
      if (companyId && projectId && buildingId) {
        void bimToBoqBridge.upsertBoqItemForBim(
          'mep-segment',
          {
            id: entity.id,
            kind: entity.kind,
            params: { classification: entity.params.classification },
            geometry: { lengthM: entity.geometry.length },
          },
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_SEGMENT_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId]);

  // Auto-save debounce on bim:mep-segment-params-updated.
  useEffect(() => {
    const cleanup = EventBus.on('bim:mep-segment-params-updated', ({ segmentId }) => {
      const svc = serviceRef.current;
      if (!svc) return;
      const levelId = levelManager.currentLevelId;
      if (!levelId) return;
      const scene = levelManager.getLevelScene(levelId);
      const entity = scene?.entities.find((e) => e.id === segmentId && isSegment(e));
      if (!entity || !isSegment(entity)) return;

      const known = lastSavedParamsRef.current.has(entity.id);
      const isPending = pendingFirstSaveIdsRef.current.has(entity.id);
      if (!known && !isPending) return;
      const lastSaved = lastSavedParamsRef.current.get(entity.id);
      if (lastSaved && dequal(lastSaved, entity.params)) return;

      dirtyIdsRef.current.add(entity.id);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        void persist(entity);
      }, AUTO_SAVE_DEBOUNCE_MS);
    });
    return cleanup;
  }, [levelManager, persist]);

  const saveNow = useCallback(async () => {
    const segment = selectedSegmentRef.current;
    if (!segment) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(segment);
  }, [persist]);

  // Delete segment: remove from Firestore + scene + audit.
  const deleteSegment = useCallback(async (segmentId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === segmentId);
    const deletedSegment = deletedEntity && isSegment(deletedEntity) ? deletedEntity : null;
    try {
      await svc.deleteSegment(segmentId);
      void recordMepSegmentChange(
        'deleted',
        deletedSegment
          ? { id: deletedSegment.id, kind: deletedSegment.kind, layerId: deletedSegment.layerId, params: deletedSegment.params }
          : { id: segmentId, kind: 'duct' },
      );
      // ADR-408 — remove the auto-fed Η-Μ BOQ row (skips user-detached rows).
      if (companyId) void bimToBoqBridge.deleteBoqItemForBim(segmentId, companyId);
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== segmentId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(segmentId);
    lastSavedParamsRef.current.delete(segmentId);
    pendingFirstSaveIdsRef.current.delete(segmentId);
    deletedIdsRef.current.add(segmentId);
  }, [levelManager, companyId]);

  // persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: MepSegmentEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveSegment(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordMepSegmentChange('restored', entity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'MEP_SEGMENT_RESTORE_ERROR');
      setSaveState('error');
    }
  }, []);

  // First-save listener — fires immediately for freshly drawn segments.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'mep-segment') return;
      const entity = payload.entity as MepSegmentEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'mep-segment') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener.
  useEffect(() => {
    const cleanup = EventBus.on('bim:mep-segment-delete-requested', ({ segmentId }) => {
      // Mark deleted SYNCHRONOUSLY (before the async delete) so an in-flight first-save
      // persist detects the race and compensates instead of leaving a Firestore zombie.
      // Mirrors useWallPersistence. The async deleteSegment re-adds it harmlessly (Set).
      deletedIdsRef.current.add(segmentId);
      void deleteSegment(segmentId);
    });
    return cleanup;
  }, [deleteSegment]);

  useBimEntityMovedPersistEffect(isSegment, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'mep-segment',
    isSegment,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteSegment }),
    [saveState, lastSavedAt, error, saveNow, deleteSegment],
  );
}
