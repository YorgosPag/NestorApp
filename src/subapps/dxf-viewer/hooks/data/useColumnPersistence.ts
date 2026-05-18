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

// ============================================================================
// TYPES
// ============================================================================

export type ColumnSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface LevelManagerLike {
  readonly currentLevelId: string | null;
  getLevelScene(levelId: string): SceneModel | null;
  setLevelScene(levelId: string, scene: SceneModel): void;
}

export interface UseColumnPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
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
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedColumnRef = useRef<ColumnEntity | null>(null);
  selectedColumnRef.current = primarySelectedColumn;

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
      userId,
    });
  }, [companyId, projectId, floorplanId, userId]);

  // Subscribe + diff-merge + selective skip locally-dirty columns.
  useEffect(() => {
    const svc = serviceRef.current;
    const levelId = levelManager.currentLevelId;
    if (!svc || !levelId) return;

    const unsubscribe = svc.subscribeColumns(
      (docs) => {
        const scene = levelManager.getLevelScene(levelId);
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

        for (const doc of docs) {
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
          if (!dequal(existing.params, doc.params)) {
            nextColumns.push(docToEntity(doc));
            mutated = true;
          } else {
            nextColumns.push(existing);
          }
        }

        for (const [id, entity] of sceneColumns) {
          if (docsById.has(id)) continue;
          const neverSaved = !lastSavedParamsRef.current.has(id);
          if (dirty.has(id) || neverSaved) {
            nextColumns.push(entity);
          } else {
            mutated = true;
          }
        }

        if (mutated) {
          levelManager.setLevelScene(levelId, {
            ...scene,
            entities: [...nonColumns, ...nextColumns],
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
  const persist = useCallback(async (entity: ColumnEntity) => {
    const svc = serviceRef.current;
    if (!svc) return;
    const isNew = !lastSavedParamsRef.current.has(entity.id);
    setSaveState('saving');
    setError(null);
    try {
      await svc.saveColumn(entityToSaveInput(entity));
      lastSavedParamsRef.current.set(entity.id, entity.params);
      dirtyIdsRef.current.delete(entity.id);
      setSaveState('saved');
      setLastSavedAt(Date.now());
      void recordColumnChange(isNew ? 'created' : 'updated', entity);
      if (companyId && projectId && buildingId) {
        void bimToBoqBridge.upsertBoqItemForBim(
          'column',
          { id: entity.id, kind: entity.kind, geometry: entity.geometry },
          { companyId, projectId, buildingId },
          isNew ? 'created' : 'updated',
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'COLUMN_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId]);

  // Auto-save debounce σε selected column params change.
  useEffect(() => {
    const column = primarySelectedColumn;
    if (!column || !serviceRef.current) return;
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

    try {
      await svc.deleteColumn(columnId);
      void recordColumnChange(
        'deleted',
        { id: columnId, kind: (deletedEntity as Partial<ColumnEntity>)?.kind ?? 'rectangular' },
      );
      void bimToBoqBridge.deleteBoqItemForBim(columnId);
    } catch {
      // Non-fatal: deletion failure silent — user retries.
    }

    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== columnId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

    dirtyIdsRef.current.delete(columnId);
    lastSavedParamsRef.current.delete(columnId);
  }, [levelManager]);

  // First-save listener — fires άμεσα για freshly drawn columns.
  useEffect(() => {
    const cleanup = EventBus.on('drawing:entity-created', (payload) => {
      if (payload.tool !== 'column') return;
      const entity = payload.entity as ColumnEntity | undefined;
      if (!entity || (entity as { type?: string }).type !== 'column') return;
      if (!serviceRef.current) return;
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
