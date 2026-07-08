'use client';

/**
 * ADR-415 Φ1 — Floorplan symbol Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: hybrid auto-save, selective-skip diff-merge, first-save listener
 * wired to `drawing:entity-created` with `tool === 'floorplan-symbol'`, undo
 * restore, audit trail (created/updated/deleted/restored). No BOQ feed, no
 * connector reconciliation (floorplan symbols carry no MEP connectors).
 *
 * Φ1 has no in-app delete UI yet, so there is no delete-requested EventBus bridge
 * (no `deleteTrigger` in the config); `deleteFloorplanSymbol` is still exposed on
 * the result for a later sub-step (the factory's `deleteEntity` is unconditional).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { AnySceneEntity } from '../../types/entities';
import type { FloorplanSymbolEntity } from '../../bim/types/floorplan-symbol-types';
import {
  createFloorplanSymbolFirestoreService,
  entityToSaveInput,
  FloorplanSymbolFirestoreService,
  type FloorplanSymbolDoc,
} from '../../bim/floorplan-symbols/floorplan-symbol-firestore-service';
import { recordFloorplanSymbolChange } from '../../bim/floorplan-symbols/floorplan-symbol-audit-client';
import { floorplanSymbolDocToEntity as docToEntity } from './floorplan-symbol-persistence-helpers';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type FloorplanSymbolSaveState = BimEntitySaveState;

export interface UseFloorplanSymbolPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedSymbol: FloorplanSymbolEntity | null;
}

export interface UseFloorplanSymbolPersistenceResult {
  readonly saveState: FloorplanSymbolSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteFloorplanSymbol: (symbolId: string) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

function isFloorplanSymbol(entity: AnySceneEntity): entity is FloorplanSymbolEntity {
  return (entity as { type?: string }).type === 'floorplan-symbol';
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useFloorplanSymbolPersistenceBase = createBimEntityPersistenceHook<
  FloorplanSymbolFirestoreService,
  FloorplanSymbolDoc,
  FloorplanSymbolEntity,
  FloorplanSymbolEntity['params']
>({
  entityType: 'floorplan-symbol',
  restoreEntityType: 'floorplan-symbol',
  saveErrorKey: 'FLOORPLAN_SYMBOL_SAVE_ERROR',
  restoreErrorKey: 'FLOORPLAN_SYMBOL_RESTORE_ERROR',
  typeGuard: isFloorplanSymbol,
  entityComparable: (e) => e.params,
  createService: (scope) => createFloorplanSymbolFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveFloorplanSymbol(entityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateFloorplanSymbol(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteFloorplanSymbol(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeFloorplanSymbols(onDocs as (docs: readonly FloorplanSymbolDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isFloorplanSymbol,
      docToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  onPersisted: (entity, { isNew, prevComparable }) => {
    void recordFloorplanSymbolChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
  },
  onDeleted: (id, deleted) => {
    void recordFloorplanSymbolChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'wc' },
    );
  },
  onRestored: (entity) => {
    void recordFloorplanSymbolChange('restored', entity);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useFloorplanSymbolPersistence(
  params: UseFloorplanSymbolPersistenceParams,
): UseFloorplanSymbolPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } =
    useFloorplanSymbolPersistenceBase({
      companyId: params.companyId,
      projectId: params.projectId,
      floorplanId: params.floorplanId,
      floorId: params.floorId,
      userId: params.userId,
      levelManager: params.levelManager,
      primarySelected: params.primarySelectedSymbol,
    } as BimEntityPersistenceParams<FloorplanSymbolEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteFloorplanSymbol: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
