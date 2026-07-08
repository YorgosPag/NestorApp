'use client';

/**
 * ADR-408 Εύρος Β #1 — Heating radiator Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: MEP connector projection (`projectMepConnectorsOntoFresh`) on the
 * merged doc-entity, `differs` on the projected candidate (anti-ping-pong), audit
 * via `recordMepRadiatorChange`, and the Η-Μ BOQ auto-feed (1 piece, ΗΛΜ-7.01).
 * First-save on `drawing:entity-created` (tool 'mep-radiator').
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { MepRadiatorEntity } from '../../bim/types/mep-radiator-types';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import {
  createMepRadiatorFirestoreService,
  entityToSaveInput,
  MepRadiatorFirestoreService,
  type MepRadiatorDoc,
} from '../../bim/mep-radiators/mep-radiator-firestore-service';
import { recordMepRadiatorChange } from '../../bim/mep-radiators/mep-radiator-audit-client';
import { mepRadiatorDocToEntity as docToEntity } from './mep-radiator-persistence-helpers';
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

export type MepRadiatorSaveState = BimEntitySaveState;

export interface UseMepRadiatorPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey id. Forwarded to service config. */
  readonly floorId?: string | null;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed (BimToBoqBridge). */
  readonly buildingId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedRadiator: MepRadiatorEntity | null;
}

export interface UseMepRadiatorPersistenceResult {
  readonly saveState: MepRadiatorSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteRadiator: (radiatorId: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useMepRadiatorPersistenceBase = createBimEntityPersistenceHook<
  MepRadiatorFirestoreService,
  MepRadiatorDoc,
  MepRadiatorEntity,
  MepRadiatorEntity['params']
>({
  entityType: 'mep-radiator',
  restoreEntityType: 'mep-radiator',
  saveErrorKey: 'MEP_RADIATOR_SAVE_ERROR',
  restoreErrorKey: 'MEP_RADIATOR_RESTORE_ERROR',
  entityComparable: (e) => e.params,
  createService: (scope) => createMepRadiatorFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveRadiator(entityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateRadiator(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteRadiator(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeRadiators(onDocs as (docs: readonly MepRadiatorDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: mepConnectorMergeConfig(
      (e): e is MepRadiatorEntity => (e as { type?: string }).type === 'mep-radiator',
      docToEntity,
    ),
  },
  deleteTrigger: {
    event: 'bim:mep-radiator-delete-requested',
    getId: (p) => (p as { radiatorId?: string }).radiatorId,
  },
  onPersisted: (entity, { isNew, prevComparable, scope }) => {
    void recordMepRadiatorChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
    // ADR-408 — Η-Μ BOQ auto-feed: heating radiator = 1 piece (ΗΛΜ-7.01).
    if (scope.companyId && scope.projectId && scope.buildingId) {
      void bimToBoqBridge.upsertBoqItemForBim(
        'mep-radiator',
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
    void recordMepRadiatorChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'panel-radiator' },
    );
    // ADR-408 — remove the auto-fed Η-Μ BOQ row (skips user-detached rows).
    if (scope.companyId) void bimToBoqBridge.deleteBoqItemForBim(id, scope.companyId);
  },
  onRestored: (entity) => {
    void recordMepRadiatorChange('restored', entity);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useMepRadiatorPersistence(
  params: UseMepRadiatorPersistenceParams,
): UseMepRadiatorPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useMepRadiatorPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    buildingId: params.buildingId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedRadiator,
  } as BimEntityPersistenceParams<MepRadiatorEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteRadiator: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
