'use client';

/**
 * ADR-408 Εύρος Β #2 — Heating boiler Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: MEP connector projection (`projectMepConnectorsOntoFresh`) on the
 * merged doc-entity, `differs` on the projected candidate (anti-ping-pong), audit
 * via `recordMepBoilerChange`, and the Η-Μ BOQ auto-feed (1 piece, ΗΛΜ-7.02).
 * First-save on `drawing:entity-created` (tool 'mep-boiler').
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { MepBoilerEntity } from '../../bim/types/mep-boiler-types';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import {
  createMepBoilerFirestoreService,
  entityToSaveInput,
  MepBoilerFirestoreService,
  type MepBoilerDoc,
} from '../../bim/mep-boilers/mep-boiler-firestore-service';
import { recordMepBoilerChange } from '../../bim/mep-boilers/mep-boiler-audit-client';
import { mepBoilerDocToEntity as docToEntity } from './mep-boiler-persistence-helpers';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import { mepConnectorMergeConfig } from './mep-connector-merge-config';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type MepBoilerSaveState = BimEntitySaveState;

export interface UseMepBoilerPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  readonly floorId?: string | null;
  readonly buildingId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
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
// FACTORY CONFIG
// ============================================================================

const useMepBoilerPersistenceBase = createBimEntityPersistenceHook<
  MepBoilerFirestoreService,
  MepBoilerDoc,
  MepBoilerEntity,
  MepBoilerEntity['params']
>({
  entityType: 'mep-boiler',
  restoreEntityType: 'mep-boiler',
  saveErrorKey: 'MEP_BOILER_SAVE_ERROR',
  restoreErrorKey: 'MEP_BOILER_RESTORE_ERROR',
  entityComparable: (e) => e.params,
  createService: (scope) => createMepBoilerFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveBoiler(entityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateBoiler(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteBoiler(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeBoilers(onDocs as (docs: readonly MepBoilerDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: mepConnectorMergeConfig(
      (e): e is MepBoilerEntity => (e as { type?: string }).type === 'mep-boiler',
      docToEntity,
    ),
  },
  deleteTrigger: {
    event: 'bim:mep-boiler-delete-requested',
    getId: (p) => (p as { boilerId?: string }).boilerId,
  },
  onPersisted: (entity, { isNew, prevComparable, scope }) => {
    void recordMepBoilerChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
    // ADR-408 — Η-Μ BOQ auto-feed: heating boiler = 1 piece (ΗΛΜ-7.02).
    if (scope.companyId && scope.projectId && scope.buildingId) {
      void bimToBoqBridge.upsertBoqItemForBim(
        'mep-boiler',
        { id: entity.id, kind: entity.kind },
        {
          companyId: scope.companyId,
          projectId: scope.projectId,
          buildingId: scope.buildingId,
          floorId: scope.floorId ?? undefined,
        },
        isNew ? 'created' : 'updated',
      );
    }
  },
  onDeleted: (id, deleted, { scope }) => {
    void recordMepBoilerChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'wall-boiler' },
    );
    // ADR-408 — remove the auto-fed Η-Μ BOQ row (skips user-detached rows).
    if (scope.companyId) void bimToBoqBridge.deleteBoqItemForBim(id, scope.companyId);
  },
  onRestored: (entity) => {
    void recordMepBoilerChange('restored', entity);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useMepBoilerPersistence(
  params: UseMepBoilerPersistenceParams,
): UseMepBoilerPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useMepBoilerPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    buildingId: params.buildingId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedBoiler,
  } as BimEntityPersistenceParams<MepBoilerEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteBoiler: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
