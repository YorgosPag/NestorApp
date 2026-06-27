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
import { createModuleLogger } from '@/lib/telemetry';

import type { AnySceneEntity, SceneModel } from '../../types/entities';
import { DXF_TIMING } from '../../config/dxf-timing';
import type { SceneWriteOrigin } from '../scene/scene-write-origin';
import type { ColumnEntity } from '../../bim/types/column-types';
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
import { isColumn, mergeColumnDocsIntoScene } from './column-persistence-helpers';
import { createPersistSerializer } from './persist-serializer';
import { resolveBimPersistenceScope } from '../../bim/persistence/bim-floor-scope';
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

const AUTO_SAVE_DEBOUNCE_MS = DXF_TIMING.persist.ENTITY_AUTOSAVE; // ADR-516

// ADR-363 — surface persistence failures. A swallowed Firestore reject (e.g.
// «Unsupported field value: undefined») previously left columns NEVER persisted
// and silently lost on reload — no console trace. Log the cause (server-side
// telemetry; not a hardcoded UI string, N.11-exempt).
const logger = createModuleLogger('useColumnPersistence');

// ============================================================================
// HELPERS
// ============================================================================

// isColumn / mergeColumnDocsIntoScene imported from './column-persistence-helpers'
// (file-size split, behavior-preserving; columnDocToEntity is used internally by
// mergeColumnDocsIntoScene, not directly here).

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
  // ADR-401 / N.7 — per-id write serializer: a beam-creation cascade re-persists a
  // column in the same tick it attaches; serializing prevents a duplicate `created`.
  const persistSerializerRef = useRef(createPersistSerializer());
  const selectedColumnRef = useRef<ColumnEntity | null>(null);
  selectedColumnRef.current = primarySelectedColumn;

  // ⚡ STABILITY (ca9 fix 2026-06-08): key the Firestore subscription off stable
  // scope primitives + `currentLevelId`, NOT the per-render `levelManager` object,
  // so onSnapshot does not unsubscribe/re-subscribe on every render (target removed
  // before ack → `INTERNAL ASSERTION FAILED ca9 {ve:-1}`). Mirror of the fitting hook.
  const levelManagerRef = useRef(levelManager);
  levelManagerRef.current = levelManager;
  const currentLevelId = levelManager.currentLevelId;

  // Instantiate service όταν auth + scope ready. ADR-420 SSoT gate — durable
  // `floorId` is sufficient scope even when the DXF save target (`floorplanId` =
  // volatile fileRecordId) was nulled by the cross-floor guard, so BIM keeps
  // persisting on a floor whose own DXF file is missing/cross-linked.
  useEffect(() => {
    const scope = resolveBimPersistenceScope({ companyId, projectId, userId, floorId, floorplanId });
    if (!scope) {
      serviceRef.current = null;
      return;
    }
    serviceRef.current = createColumnFirestoreService({
      companyId: scope.companyId,
      projectId: scope.projectId,
      floorplanId: scope.floorplanId,
      floorId: scope.floorId,
      userId: scope.userId,
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
      (docs) => mergeColumnDocsIntoScene(docs, levelId, levelManagerRef.current, {
        dirty: dirtyIdsRef.current,
        deleted: deletedIdsRef.current,
        pending: pendingFirstSaveIdsRef.current,
        lastSavedParams: lastSavedParamsRef.current,
        isWithinGrace,
      }),
      (err: Error) => {
        setError(err.message);
        setSaveState('error');
      },
    );

    return () => unsubscribe();
  }, [currentLevelId, companyId, projectId, floorplanId, floorId, userId]);

  // Immediate persist body — one save + one audit per call (used by both
  // auto-save flush and explicit button). Always invoked through the serialized
  // `persist` wrapper below so concurrent calls for the same id run in order.
  const persistOnce = useCallback(async (entity: ColumnEntity) => {
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
          // ADR-539 — carry the per-face appearance edit so painted faces persist on
          // re-edit (faced paint fires `bim:entities-attached` → persist → updateDoc).
          faceAppearance: entity.faceAppearance,
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
      logger.error('Column persist failed', { columnId: entity.id, isNew, error: err });
      setError(err instanceof Error ? err.message : 'COLUMN_SAVE_ERROR');
      setSaveState('error');
    }
  }, [companyId, projectId, buildingId, floorId, levelManager]);

  // Serialized persist (ADR-401 / N.7): chains concurrent saves for the same id so
  // a beam-cascade auto-attach re-persist sees the committed baseline → emits one
  // `created` then an `updated` diff, instead of a duplicate `created`.
  const persist = useCallback(
    (entity: ColumnEntity) =>
      persistSerializerRef.current.run(entity.id, () => persistOnce(entity)),
    [persistOnce],
  );

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

    // Google-level OPTIMISTIC UPDATE (N.7): αφαίρεσε την κολώνα από τη σκηνή ΣΥΓΧΡΟΝΑ,
    // ΠΡΙΝ το Firestore `await` — μέσα στο ίδιο synchronous `bim:column-delete-requested`
    // emit. Οι coalesced (queueMicrotask) structural αντιδράσεις στο ΙΔΙΟ event
    // (auto-foundation / loads / organism, useGroupedStructuralReaction) draining ΜΕΤΑ
    // το emit πρέπει να δουν ΦΡΕΣΚΙΑ σκηνή· αν η αφαίρεση έμενε πίσω από το network await,
    // ο planner διάβαζε stale column set → π.χ. combined πέδιλο «παγωμένο» μετά τη
    // διαγραφή της μίας κολώνας. Mirror του smart-delete (scene-sync ΠΡΙΝ τα delete events).
    if (scene) {
      const nextEntities = scene.entities.filter((e) => e.id !== columnId);
      levelManager.setLevelScene(levelId, { ...scene, entities: nextEntities });
    }

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
      logger.error('Column restore failed', { columnId: entity.id, error: err });
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
      if (!serviceRef.current) {
        // DIAGNOSTIC (ADR-363): a column was drawn but the Firestore service is
        // null — scope (companyId/projectId/floorplanId/userId) is missing → the
        // column is NEVER persisted and lost on reload. Surface it (was silent).
        logger.warn('Column created but persistence service NOT ready — column will NOT persist', {
          columnId: entity.id,
          hasCompanyId: !!companyId,
          projectId: projectId ?? null,
          floorplanId: floorplanId ?? null,
          hasUserId: !!userId,
        });
        return;
      }
      logger.warn('Column created → scheduling first save', { columnId: entity.id });
      pendingFirstSaveIdsRef.current.add(entity.id);
      dirtyIdsRef.current.add(entity.id);
      void persist(entity);
    });
    return cleanup;
  }, [persist]);

  // Param-edit persistence (ADR-390 Phase 4 — render==DB SSoT). A column grip /
  // ribbon param edit (commitColumnGripDrag etc.) emits `bim:column-params-updated`
  // but was persisted ONLY by the fragile 500ms selected-column debounce — if the
  // column was deselected before it fired, the edit landed in the scene + snapshot
  // but NEVER in the per-entity doc. Persist immediately off the event (entity read
  // from the live scene by id), so the edit reaches the SSoT regardless of
  // selection/debounce timing. Mirror beam; `persist` is serialized + idempotent.
  useEffect(() => {
    const cleanup = EventBus.on('bim:column-params-updated', ({ columnId }) => {
      if (!serviceRef.current) return;
      const lm = levelManagerRef.current;
      const levelId = lm.currentLevelId;
      if (!levelId) return;
      const entity = lm.getLevelScene(levelId)?.entities.find((e) => e.id === columnId);
      if (!entity || !isColumn(entity)) return;
      dirtyIdsRef.current.add(columnId);
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
