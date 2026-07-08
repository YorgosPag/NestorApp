'use client';

/**
 * ADR-408 Φ12 — Plumbing manifold Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: MEP connector projection (`projectMepConnectorsOntoFresh`) on the
 * merged doc-entity, `differs` on the projected candidate (anti-ping-pong), audit
 * via `recordMepManifoldChange`, and the Η-Μ BOQ auto-feed (manifold body = 1
 * piece, ΗΛΜ-7.03 / ΗΛΜ-6.02, keyed by kind). First-save on
 * `drawing:entity-created` (tool 'mep-manifold').
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { MepManifoldEntity } from '../../bim/types/mep-manifold-types';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import {
  createMepManifoldFirestoreService,
  entityToSaveInput,
  MepManifoldFirestoreService,
  type MepManifoldDoc,
} from '../../bim/mep-manifolds/mep-manifold-firestore-service';
import { recordMepManifoldChange } from '../../bim/mep-manifolds/mep-manifold-audit-client';
import { mepManifoldDocToEntity as docToEntity } from './mep-manifold-persistence-helpers';
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

export type MepManifoldSaveState = BimEntitySaveState;

export interface UseMepManifoldPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string | null;
  /** ADR-408 — building scope for the Η-Μ BOQ auto-feed (BimToBoqBridge). */
  readonly buildingId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedManifold: MepManifoldEntity | null;
}

export interface UseMepManifoldPersistenceResult {
  readonly saveState: MepManifoldSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteManifold: (manifoldId: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useMepManifoldPersistenceBase = createBimEntityPersistenceHook<
  MepManifoldFirestoreService,
  MepManifoldDoc,
  MepManifoldEntity,
  MepManifoldEntity['params']
>({
  entityType: 'mep-manifold',
  restoreEntityType: 'mep-manifold',
  saveErrorKey: 'MEP_MANIFOLD_SAVE_ERROR',
  restoreErrorKey: 'MEP_MANIFOLD_RESTORE_ERROR',
  entityComparable: (e) => e.params,
  createService: (scope) => createMepManifoldFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveManifold(entityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateManifold(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteManifold(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeManifolds(onDocs as (docs: readonly MepManifoldDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: mepConnectorMergeConfig(
      (e): e is MepManifoldEntity => (e as { type?: string }).type === 'mep-manifold',
      docToEntity,
    ),
  },
  deleteTrigger: {
    event: 'bim:mep-manifold-delete-requested',
    getId: (p) => (p as { manifoldId?: string }).manifoldId,
  },
  onPersisted: (entity, { isNew, prevComparable, scope }) => {
    void recordMepManifoldChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
    // ADR-408 — Η-Μ BOQ auto-feed: manifold body = 1 piece (ΗΛΜ-7.03 συλλέκτης
    // θέρμανσης / ΗΛΜ-6.02 φρεάτιο αποχέτευσης, keyed by kind).
    if (scope.companyId && scope.projectId && scope.buildingId) {
      void bimToBoqBridge.upsertBoqItemForBim(
        'mep-manifold',
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
    void recordMepManifoldChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'floor-manifold' },
    );
    // ADR-408 — remove the auto-fed Η-Μ BOQ row (skips user-detached rows).
    if (scope.companyId) void bimToBoqBridge.deleteBoqItemForBim(id, scope.companyId);
  },
  onRestored: (entity) => {
    void recordMepManifoldChange('restored', entity);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useMepManifoldPersistence(
  params: UseMepManifoldPersistenceParams,
): UseMepManifoldPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useMepManifoldPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    buildingId: params.buildingId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedManifold,
  } as BimEntityPersistenceParams<MepManifoldEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteManifold: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
