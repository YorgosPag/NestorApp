'use client';

/**
 * ADR-363 Phase 4 — Column Firestore persistence React adapter.
 *
 * Bridges `ColumnFirestoreService` σε scene model owned by `LevelsSystem`.
 * Mirrors `useSlabPersistence` — same hybrid auto-save pattern, same
 * selective skip diff-merge, same first-save listener wired σε
 * `drawing:entity-created` με tool='column'.
 *
 * Persistence trigger — hybrid:
 *   - Debounced auto-save 500 ms μετά από `column.params` change settle.
 *   - `saveNow()` imperative escape hatch.
 *
 * Scene sync — diff-merge με selective skip:
 *   - Κάθε snapshot adds / updates / removes columns στο active scene.
 *   - Columns marked locally-dirty ΠΟΤΕ overwritten από snapshot data.
 *
 * Geometry re-derivation: όταν φτάνει snapshot από Firestore, η γεωμετρία
 * αναπαράγεται client-side από `params`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { dequal } from 'dequal';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { ColumnEntity } from '../../bim/types/column-types';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { validateColumnParams } from '../../bim/validators/column-validator';
import { EventBus } from '../../systems/events/EventBus';
import {
  createColumnFirestoreService,
  entityToSaveInput,
  ColumnFirestoreService,
  type ColumnDoc,
} from '../../bim/columns/column-firestore-service';
import { recordColumnChange } from '../../bim/columns/column-audit-client';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { columnBoqEntity } from './column-boq-feed';
import { useBimEntityMovedPersistEffect } from './useBimEntityMovedPersistEffect';
import { useBimEntityRestoredPersistEffect } from './useBimEntityRestoredPersistEffect';
import { useBimFirestoreWriteGrace } from './useBimFirestoreWriteGrace';

// ============================================================================
// TYPES
// ============================================================================

export type ColumnSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel, origin?: SceneWriteOrigin): void;
}

export interface UseColumnPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelManagerLike;
  readonly primarySelectedColumn: ColumnEntity | null;
}

export interface UseColumnPersistenceResult {
  readonly saveState: ColumnSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteColumn: (columnId: string) => Promise<void>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AUTO_SAVE_DEBOUNCE_MS = 500;

// ============================================================================
// HELPERS
// ============================================================================

function isColumn(entity: AnySceneEntity): entity is ColumnEntity {
  return (entity as { type?: string }).type === 'column';
}

/**
 * Build scene-side `ColumnEntity` από persisted `ColumnDoc`. Geometry +
 * validation recomputed via SSoT pure functions.
 */
function docToEntity(doc: ColumnDoc): ColumnEntity {
  const validation = doc.validation ?? validateColumnParams(doc.params).bimValidation;
  return {
    id: doc.id,
    type: 'column',
    kind: doc.kind,
    layerId: doc.layerId ?? '0',
    params: doc.params,
    geometry: doc.geometry ?? computeColumnGeometry(doc.params),
    validation,
    visible: true,
    // ADR-441 Slice COL — restore grid hosting bindings so the reconciler keeps the
    // column following its axes after reload.
    ...(doc.guideBindings !== undefined ? { guideBindings: doc.guideBindings } : {}),
  } as ColumnEntity;
}

// ============================================================================
// HOOK
// ============================================================================

export function useColumnPersistence(
  params: UseColumnPersistenceParams,
): UseColumnPersistenceResult {
  const {
    companyId,
    projectId,
    floorplanId,
    buildingId,
    floorId,
    userId,
    levelManager,
    primarySelectedColumn,
  } = params;

  const [saveState, setSaveState] = useState<ColumnSaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serviceRef = useRef<ColumnFirestoreService | null>(null);
  const dirtyIdsRef = useRef<Set<string>>(new Set());
  const lastSavedParamsRef = useRef<Map<string, ColumnEntity['params']>>(new Map());
  const { recordWrite, isWithinGrace } = useBimFirestoreWriteGrace();
  // ADR-390 — pending first save (drawn or restored) + tombstone tracking.
  const pendingFirstSaveIdsRef = useRef<Set<string>>(new Set());
  const deletedIdsRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedColumnRef = useRef<ColumnEntity | null>(null);
  selectedColumnRef.current = primarySelectedColumn;

  // ⚡ STABILITY (ca9 fix 2026-06-08): key the Firestore subscription off stable
  // scope primitives + `currentLevelId`, NOT the per-render `levelManager` object,
  // so onSnapshot does not unsubscribe/re-subscribe on every render (target removed
  // before ack → `INTERNAL ASSERTION FAILED ca9 {ve:-1}`). Mirror of the fitting hook.
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const currentLevelId = levelManager.currentLevelId;

  // Instantiate service όταν auth + scope ready.
  useEffect(() => {
    if (!companyId || !projectId || !floorplanId || !userId) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createColumnFirestoreService({
      companyId,
      projectId,
      floorplanId,
      floorId: floorId ?? undefined,
      userId,
    });
  }, [companyId, projectId, floorplanId, floorId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty columns.
  // Keyed on STABLE primitives only (scope + currentLevelId) — NOT the per-render
  // `levelManager` object — so onSnapshot subscribes once per real scope/level
  // change (ca9 churn fix).
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeColumns(
      (docs) => {
        const lm = levelManagerRef.current;
        const scene = lm.getLevelScene(levelId);
        if (!scene) return;

        const docsById = new Map<string, ColumnDoc>();
        for (const d of docs) docsById.set(d.id, d);

        const dirty = dirtyIdsRef.current;
        const sceneColumns = new Map<string, ColumnEntity>();
        const nonColumns: AnySceneEntity[] = [];
        for (const e of scene.entities) {
          if (isColumn(e)) sceneColumns.set(e.id, e);
          else nonColumns.push(e);
        }

        const nextColumns: ColumnEntity[] = [];
        let mutated = false;

        const deleted = deletedIdsRef.current;
        const pending = pendingFirstSaveIdsRef.current;

        for (const doc of docs) {
          if (deleted.has(doc.id)) continue;
          const existing = sceneColumns.get(doc.id);
          if (!existing) {
            if (!dirty.has(doc.id)) {
              nextColumns.push(docToEntity(doc));
              mutated = true;
            }
            continue;
          }
          if (dirty.has(doc.id)) {
            nextColumns.push(existing);
            continue;
          }
          // Grace-period guard (useBimFirestoreWriteGrace SSoT).
          if (isWithinGrace(doc.id)) {
            nextColumns.push(existing);
            continue;
          }
          if (!dequal(existing.params, doc.params)) {
            nextColumns.push(docToEntity(doc));
            mutated = true;
          } else {
            nextColumns.push(existing);
          }
        }

        // ADR-397 — seed the "known/last-saved" baseline for every Firestore doc
        // so a subsequently edited column (loaded this session, not freshly drawn)
        // passes the auto-save gate (`lastSavedParamsRef.has(id)`) and its dirty
        // flag protects the local edit from this snapshot. Without this, edits to
        // pre-existing columns were silently skipped → snapshot reverted the
        // rotation/move (snap-back). Mirror of useWallPersistence.
        for (const doc of docs) {
          if (!lastSavedParamsRef.current.has(doc.id)) {
            lastSavedParamsRef.current.set(doc.id, doc.params);
          }
        }

        // ADR-390 — replaces buggy `neverSaved` guard.
        for (const [id, entity] of sceneColumns) {
          if (docsById.has(id)) continue;
          if (dirty.has(id) || pending.has(id)) {
            nextColumns.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          lm.setLevelScene(levelId, {
            ...scene,
            entities: [...nonColumns, ...nextColumns],
          }, 'remote-echo');
        }
      },
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [currentLevelId, companyId, projectId, floorplanId, userId]);

  // Immediate persist (used by both auto-save flush and explicit button).
  const persist = useCallback(async (entity: ColumnEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const prevParams = lastSavedParamsRef.current.get(entity.id) ?? null;
    const isNew = prevParams === null;
    setSaveState('saving');
    setError(null);
    try {
      // ADR-397 — setDoc (saveColumn) only on first write — it stamps createdAt,
      // which the Firestore UPDATE rule treats as immutable. Existing columns go
      // through updateColumn (updateDoc) so re-edits (rotation/move/resize)
      // persist instead of being silently rejected → snapshot revert / snap-back.
      // Mirror of useWallPersistence (saveWall/updateWall split).
      if (isNew) {
        await svc.saveColumn(entityToSaveInput(entity));
      } else {
        await svc.updateColumn(entity.id, {
          params: entity.params,
          validation: entity.validation,
          geometry: entity.geometry,
          layerId: entity.layerId,
        });
      }
      lastSavedParamsRef.current.set(entity.id, entity.params);
      recordWrite(entity.id);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordColumnChange(
        isNew ? 'created' : 'updated',
        entity,
        { prevParams: prevParams ?? undefined },
      );
      if (companyId && projectId && buildingId) {
        // ADR-401 F.2 — profile-aware BOQ (attached κολώνα → ύψος/όγκος από top−base).
        const levelId = levelManager.currentLevelId;
        const scene = levelId ? levelManager.getLevelScene(levelId) ?? null : null;
        void bimToBoqBridge.upsertBoqItemForBim(
          'column',
          columnBoqEntity(entity, scene),
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'COLUMN_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId, levelManager]);

  // Auto-save debounce σε selected column params change.
  useEffect(() => {
    const column = primarySelectedColumn;
    if (!column || !serviceRef.current) return;
    // ADR-390 — Bug A defense-in-depth.
    const known = lastSavedParamsRef.current.has(column.id);
    const pending = pendingFirstSaveIdsRef.current.has(column.id);
    if (!known && !pending) return;
    const lastSaved = lastSavedParamsRef.current.get(column.id);
    if (lastSaved && dequal(lastSaved, column.params)) return;

    dirtyIdsRef.current.add(column.id);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void persist(column);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [primarySelectedColumn, persist]);

  const saveNow = useCallback(async () => {
    const column = selectedColumnRef.current;
    if (!column) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persist(column);
  }, [persist]);

  // Phase 4 — Delete column: remove από Firestore + scene + audit.
  const deleteColumn = useCallback(async (columnId: string) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const levelId = levelManager.currentLevelId;
    if (!levelId) return;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const scene = levelManager.getLevelScene(levelId);
    const deletedEntity = scene?.entities.find((e) => e.id === columnId);

    const deletedColumn = (deletedEntity && isColumn(deletedEntity)) ? deletedEntity : null;
    try {
      await svc.deleteColumn(columnId);
      void recordColumnChange(
        'deleted',
        deletedColumn
          ? { id: deletedColumn.id, kind: deletedColumn.kind, layerId: deletedColumn.layerId, params: deletedColumn.params }
          : { id: columnId, kind: 'rectangular' },
      );
      void bimToBoqBridge.deleteBoqItemForBim(columnId, companyId ?? '');
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== columnId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(columnId);
    lastSavedParamsRef.current.delete(columnId);
    pendingFirstSaveIdsRef.current.delete(columnId);
    deletedIdsRef.current.add(columnId);
  }, [levelManager, companyId]);

  // ADR-390 — persistRestore: undo→Firestore re-create + audit 'restored'.
  const persistRestore = useCallback(async (entity: ColumnEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveColumn(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      recordWrite(entity.id);
      dirtyIdsRef.current.delete(entity.id);
      pendingFirstSaveIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordColumnChange('restored', entity);
      if (companyId && projectId && buildingId) {
        // ADR-401 F.2 — profile-aware BOQ (attached κολώνα → ύψος/όγκος από top−base).
        const levelId = levelManager.currentLevelId;
        const scene = levelId ? levelManager.getLevelScene(levelId) ?? null : null;
        void bimToBoqBridge.upsertBoqItemForBim(
          'column',
          columnBoqEntity(entity, scene),
          { companyId, projectId, buildingId, floorId: floorId ?? undefined },
          'created',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'COLUMN_RESTORE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId, levelManager]);

  // First-save listener — fires άμεσα για freshly drawn columns.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'column') return;
      const entity = payload.entity as ColumnEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'column') return;
      if (!serviceRef.current) return;
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Delete-requested listener (bridge emits μετά από confirm).
  useEffect(() => {
    const cleanup = EventBus.on('bim:column-delete-requested', ({ columnId }) => {
      void deleteColumn(columnId);
    });
    return cleanup;
  }, [deleteColumn]);

  useBimEntityMovedPersistEffect(isColumn, serviceRef, dirtyIdsRef, persist);
  useBimEntityRestoredPersistEffect(
    'column',
    isColumn,
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
    () => ({ saveState, lastSavedAt, error, saveNow, deleteColumn }),
    [saveState, lastSavedAt, error, saveNow, deleteColumn],
  );
}
