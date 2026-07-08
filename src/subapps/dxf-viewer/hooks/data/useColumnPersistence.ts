'use client';

/**
 * ADR-363 Phase 4 — Column Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-593). Behaviour
 * unchanged: hybrid auto-save + `saveNow`, selective-skip diff-merge via the
 * column-specific `mergeColumnDocsIntoScene` helper, serialized persist (ADR-401 —
 * beam-cascade re-persist race), write-grace, profile-aware BOQ feed
 * (create/update/delete/restore), optimistic (scene-first) delete, and immediate
 * persist off `bim:column-params-updated` (ADR-390 Φ4 grip/ribbon edits bypass the
 * selection debounce). First-save on `drawing:entity-created` (tool 'column').
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.10
 * @see docs/centralized-systems/reference/adrs/ADR-593-bim-entity-persistence-hook-ssot.md
 */

import { useEffect, useMemo } from 'react';

import type { ColumnEntity } from '../../bim/types/column-types';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
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
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
  BimPersistenceScope,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type ColumnSaveState = BimEntitySaveState;

export interface UseColumnPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly buildingId: string | null | undefined;
  /** ADR-395 Phase 1 (G7) — floor link for per-floor BOQ grouping. */
  readonly floorId: string | null | undefined;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
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
// HELPERS
// ============================================================================

/** ADR-401 F.2 — profile-aware BOQ (attached κολώνα → ύψος/όγκος από top−base). */
function feedColumnBoq(
  entity: ColumnEntity,
  scope: BimPersistenceScope,
  action: 'created' | 'updated',
): void {
  if (!(scope.companyId && scope.projectId && scope.buildingId)) return;
  const levelId = scope.levelManager.currentLevelId;
  const scene = levelId ? scope.levelManager.getLevelScene(levelId) ?? null : null;
  void bimToBoqBridge.upsertBoqItemForBim(
    'column',
    columnBoqEntity(entity, scene),
    {
      companyId: scope.companyId,
      projectId: scope.projectId,
      buildingId: scope.buildingId,
      floorId: scope.floorId ?? undefined,
    },
    action,
  );
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useColumnPersistenceBase = createBimEntityPersistenceHook<
  ColumnFirestoreService,
  ColumnDoc,
  ColumnEntity,
  ColumnEntity['params']
>({
  entityType: 'column',
  restoreEntityType: 'column',
  saveErrorKey: 'COLUMN_SAVE_ERROR',
  restoreErrorKey: 'COLUMN_RESTORE_ERROR',
  writeGrace: true,
  serialize: true,
  sceneRemovalTiming: 'before',
  typeGuard: isColumn,
  entityComparable: (e) => e.params,
  createService: (scope) => createColumnFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveColumn(entityToSaveInput(e)),
    // ADR-539 — carry the per-face appearance edit so painted faces persist on re-edit.
    update: (svc, e) =>
      svc.updateColumn(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
        faceAppearance: e.faceAppearance,
      }),
    remove: (svc, id) => svc.deleteColumn(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeColumns(onDocs as (docs: readonly ColumnDoc[]) => void, onErr),
  },
  merge: {
    mode: 'custom',
    run: (docs, levelId, lm, refs) =>
      mergeColumnDocsIntoScene(docs, levelId, lm, {
        dirty: refs.dirty,
        deleted: refs.deleted,
        pending: refs.pending,
        lastSavedParams: refs.lastSavedParams,
        isWithinGrace: refs.isWithinGrace,
      }),
  },
  deleteTrigger: {
    event: 'bim:column-delete-requested',
    getId: (p) => (p as { columnId?: string }).columnId,
  },
  onPersisted: (entity, { isNew, prevComparable, scope }) => {
    void recordColumnChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
    feedColumnBoq(entity, scope, isNew ? 'created' : 'updated');
  },
  onDeleted: (id, deleted, { scope }) => {
    void recordColumnChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'rectangular' },
    );
    void bimToBoqBridge.deleteBoqItemForBim(id, scope.companyId ?? '');
  },
  onRestored: (entity, { scope }) => {
    void recordColumnChange('restored', entity);
    feedColumnBoq(entity, scope, 'created');
  },
  // ADR-390 Φ4 — a column grip / ribbon param edit emits `bim:column-params-updated`.
  // Persist immediately off the event (entity read live from the scene), so the edit
  // reaches the SSoT regardless of selection/debounce timing. `persist` is serialized.
  useExtra: (ctx) => {
    useEffect(() => {
      const cleanup = EventBus.on('bim:column-params-updated', ({ columnId }) => {
        if (!ctx.serviceRef.current) return;
        const lm = ctx.levelManagerRef.current;
        const levelId = lm.currentLevelId;
        if (!levelId) return;
        const entity = lm.getLevelScene(levelId)?.entities.find((e) => e.id === columnId);
        if (!entity || !isColumn(entity)) return;
        ctx.dirtyIdsRef.current.add(columnId);
        void ctx.persist(entity);
      });
      return cleanup;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ctx.persist]);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useColumnPersistence(
  params: UseColumnPersistenceParams,
): UseColumnPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useColumnPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    buildingId: params.buildingId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedColumn,
  } as BimEntityPersistenceParams<ColumnEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteColumn: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
