'use client';

/**
 * ADR-507 — Hatch Firestore persistence React adapter.
 *
 * Simplified mirror of `useFloorFinishPersistence` (ADR-419). The hatch is a FLAT
 * DXF primitive, so this slice handles only what fixes "draw → hard refresh →
 * hatch gone":
 *   - subscribe + diff-merge incoming Firestore docs
 *   - first-save on `drawing:complete` (tool: 'hatch')  ← NOT `drawing:entity-created`
 *   - 500ms auto-save debounce on selected hatch payload change
 *   - delete on `bim:hatch-delete-requested` (delete-tool + undo-of-create)
 *   - ADR-390 symmetric undo/redo: `bim:entity-restore-requested` ('hatch') → re-create
 *     doc με ίδιο id (create-redo + delete-undo). Reuse του `persist` ως `persistRestore`
 *     (η `isNew` διαδρομή ξαναγράφει με `setDoc` + ίδιο id) — μηδέν διπλότυπο.
 *
 * DEFER (ADR-507 later phase): move/grip-edit re-persist (`useBimEntityMovedPersistEffect`).
 *
 * ⚠️ The create event divergence is deliberate: hatch completes via
 * `completeEntity()` which emits `drawing:complete {tool, entityId, entity}`
 * (completeEntity.ts), NOT the `drawing:entity-created` that floor-finish's
 * `useSpecialTools` emits. Listening to the wrong event = silent never-first-save.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-507-hatch-creation-system.md
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel, HatchEntity } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import { isHatchEntity } from '../../types/entities';
import { EventBus } from '../../systems/events/EventBus';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
import {
  createHatchFirestoreService,
  hatchEntityToSaveInput,
  hatchDocToEntity,
  pickHatchData,
  HatchFirestoreService,
  type HatchDoc,
  type HatchDocData,
} from '../../bim/hatch/hatch-firestore-service';
import { useBimFirestoreWriteGrace } from './useBimFirestoreWriteGrace';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// TYPES
// ============================================================================

export type HatchSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseHatchPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelected: HatchEntity | null;
}

export interface UseHatchPersistenceResult {
  readonly saveState: HatchSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteHatch: (id: string) => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useHatchPersistence(params: UseHatchPersistenceParams): UseHatchPersistenceResult {
  const { companyId, projectId, floorplanId, floorId, userId, levelManager, primarySelected } = params;

  const [saveState, setSaveState] = useState<HatchSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<HatchFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const { recordWrite, isWithinGrace } = useBimFirestoreWriteGrace();
  const lastSavedDataRef = useRef<Map<string, HatchDocData>>(new Map());
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef<HatchEntity | null>(null);
  selectedRef.current = primarySelected;

  // ⚡ STABILITY (ca9): key the Firestore subscription off stable scope primitives +
  // `currentLevelId`, NOT the per-render `levelManager` object (mirror floor-finish).
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
    serviceRef.current = createHatchFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge (keyed on STABLE primitives only — ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeHatches(
      (docs: readonly HatchDoc[]) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, HatchDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneMap = new Map<string, HatchEntity>();
        const others: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isHatchEntity(e)) sceneMap.set(e.id, e);
          else others.push(e);
        }

        const nextEntities: HatchEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const d of docs) {
          if (deleted.has(d.id)) continue;
          const existing = sceneMap.get(d.id);
          if (!existing) {
            if (!dirty.has(d.id)) { nextEntities.push(hatchDocToEntity(d)); mutated = true; }
            continue;
          }
          if (dirty.has(d.id)) { nextEntities.push(existing); continue; }
          // Grace-period guard: suppress stale snapshots after a ca9 Watch reset.
          if (isWithinGrace(d.id)) { nextEntities.push(existing); continue; }
          if (!dequal(pickHatchData(existing), d.data)) {
            nextEntities.push(hatchDocToEntity(d)); mutated = true;
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
          if (!lastSavedDataRef.current.has(d.id)) lastSavedDataRef.current.set(d.id, d.data);
        }
      },
      (err: Error) => { setError(err.message); setSaveState('error'); },
    );
    return () => unsubscribe();
  }, [currentLevelId, companyId, projectId, floorplanId, floorId, userId]);

  // Immediate persist.
  const persist = useCallback(async (entity: HatchEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const isNew = !lastSavedDataRef.current.has(entity.id);
    setSaveState('saving');
    setError(null);
    try {
      if (isNew) {
        await svc.saveHatch(hatchEntityToSaveInput(entity));
      } else {
        await svc.updateHatch(entity.id, { data: pickHatchData(entity), layerId: entity.layerId });
      }
      lastSavedDataRef.current.set(entity.id, pickHatchData(entity));
      recordWrite(entity.id);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'HATCH_SAVE_ERROR');
      setSaveState('error');
    }
  }, []);

  // Auto-save debounce.
  useEffect(() => {
    const entity = primarySelected;
    if (!entity || !serviceRef.current) return;
    const known = lastSavedDataRef.current.has(entity.id);
    const pending = pendingFirstSaveIdsRef.current.has(entity.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedDataRef.current.get(entity.id);
    if (lastSaved && dequal(lastSaved, pickHatchData(entity))) return;

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

  const deleteHatch = useCallback(async (id: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }

    try { await svc.deleteHatch(id); } catch { /* non-fatal */ }

    const scene = levelManager.getLevelScene(levelId);
    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== id);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(id);
    lastSavedDataRef.current.delete(id);
    pendingFirstSaveIdsRef.current.delete(id);
    deletedIdsRef.current.add(id);
  }, [levelManager]);

  // First-save listener — `drawing:complete` (NOT `drawing:entity-created`).
  useEffect(() => {
    const cleanup = EventBus.on('drawing:complete', (payload) => {
      if (payload.tool !== 'hatch') return;
      const entity = payload.entity;
      if (!entity || entity.type !== 'hatch') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity as HatchEntity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (delete-tool + undo-of-create).
  useEffect(() => {
    const cleanup = EventBus.on('bim:hatch-delete-requested', (payload) => {
      if (payload.id) void deleteHatch(payload.id);
    });
    return cleanup;
  }, [deleteHatch]);

  // ADR-390 — restore-requested listener (create-redo + delete-undo). Reuse `persist`
  // ως `persistRestore`: μετά από delete/undo το `lastSavedDataRef` δεν έχει το id →
  // η `isNew` διαδρομή ξαναγράφει το doc με ίδιο id (`setDoc`). Ο effect κάνει ήδη
  // `pendingFirstSaveIdsRef.add` + `deletedIdsRef.delete` ώστε ο subscribe-loop να μην
  // πετάξει/μπλοκάρει το entity στο race με το Firestore Watch.
  useBimEntityRestoredPersistEffect(
    'hatch',
    isHatchEntity,
    serviceRef,
    pendingFirstSaveIdsRef,
    deletedIdsRef,
    persist,
  );

  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteHatch }),
    [saveState, lastSavedAt, error, saveNow, deleteHatch],
  );
}
