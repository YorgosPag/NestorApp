'use client';

/**
 * ADR-408 Εύρος Β #3 — Underfloor heating loop Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: MEP connector projection (`projectMepConnectorsOntoFresh`) on the
 * merged doc-entity, `differs` on the projected candidate (anti-ping-pong), audit
 * via `recordMepUnderfloorChange`, and the Η-Μ BOQ auto-feed (developed serpentine
 * pipe length in metres, ΗΛΜ-7.04). First-save on `drawing:entity-created` (tool
 * 'mep-underfloor'). No moved-persist effect (`enableMovedEffect: false`) — the
 * original hook never wired `useBimEntityMovedPersistEffect`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { MepUnderfloorEntity } from '../../bim/types/mep-underfloor-types';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import {
  createMepUnderfloorFirestoreService,
  entityToSaveInput,
  MepUnderfloorFirestoreService,
  type MepUnderfloorDoc,
} from '../../bim/mep-underfloor/mep-underfloor-firestore-service';
import { recordMepUnderfloorChange } from '../../bim/mep-underfloor/mep-underfloor-audit-client';
import { mepUnderfloorDocToEntity as docToEntity } from './mep-underfloor-persistence-helpers';
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

export type MepUnderfloorSaveState = BimEntitySaveState;

export interface UseMepUnderfloorPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey id. Forwarded to service config. */
  readonly floorId?: string | null;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed (BimToBoqBridge). */
  readonly buildingId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedUnderfloor: MepUnderfloorEntity | null;
}

export interface UseMepUnderfloorPersistenceResult {
  readonly saveState: MepUnderfloorSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteUnderfloor: (underfloorId: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useMepUnderfloorPersistenceBase = createBimEntityPersistenceHook<
  MepUnderfloorFirestoreService,
  MepUnderfloorDoc,
  MepUnderfloorEntity,
  MepUnderfloorEntity['params']
>({
  entityType: 'mep-underfloor',
  restoreEntityType: 'mep-underfloor',
  saveErrorKey: 'MEP_UNDERFLOOR_SAVE_ERROR',
  restoreErrorKey: 'MEP_UNDERFLOOR_RESTORE_ERROR',
  entityComparable: (e) => e.params,
  // ADR-594 Note 2 — the original hook never called `useBimEntityMovedPersistEffect`;
  // opting out here preserves that (no persist-on-move) with a no-op listener.
  enableMovedEffect: false,
  createService: (scope) => createMepUnderfloorFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveUnderfloor(entityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateUnderfloor(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteUnderfloor(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeUnderfloors(onDocs as (docs: readonly MepUnderfloorDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: mepConnectorMergeConfig(
      (e): e is MepUnderfloorEntity => (e as { type?: string }).type === 'mep-underfloor',
      docToEntity,
    ),
  },
  deleteTrigger: {
    event: 'bim:mep-underfloor-delete-requested',
    getId: (p) => (p as { underfloorId?: string }).underfloorId,
  },
  onPersisted: (entity, { isNew, prevComparable, scope }) => {
    void recordMepUnderfloorChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
    // ADR-408 — Η-Μ BOQ auto-feed: underfloor loop = developed serpentine pipe
    // length (m, ΗΛΜ-7.04). totalLengthM → BimEntityForBoq.geometry.lengthM.
    if (scope.companyId && scope.projectId && scope.buildingId) {
      void bimToBoqBridge.upsertBoqItemForBim(
        'mep-underfloor',
        { id: entity.id, kind: entity.kind, geometry: { lengthM: entity.geometry.totalLengthM } },
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
    void recordMepUnderfloorChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'hydronic-loop' },
    );
    // ADR-408 — remove the auto-fed Η-Μ BOQ row (skips user-detached rows).
    if (scope.companyId) void bimToBoqBridge.deleteBoqItemForBim(id, scope.companyId);
  },
  onRestored: (entity) => {
    void recordMepUnderfloorChange('restored', entity);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useMepUnderfloorPersistence(
  params: UseMepUnderfloorPersistenceParams,
): UseMepUnderfloorPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useMepUnderfloorPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    buildingId: params.buildingId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedUnderfloor,
  } as BimEntityPersistenceParams<MepUnderfloorEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteUnderfloor: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
