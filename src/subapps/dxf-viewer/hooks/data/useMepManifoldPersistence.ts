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
import {
  createMepManifoldFirestoreService,
  entityToSaveInput,
  MepManifoldFirestoreService,
  type MepManifoldDoc,
} from '../../bim/mep-manifolds/mep-manifold-firestore-service';
import { recordMepManifoldChange } from '../../bim/mep-manifolds/mep-manifold-audit-client';
import { mepManifoldDocToEntity as docToEntity } from './mep-manifold-persistence-helpers';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import { createBimBoqAuditLifecycle } from './create-bim-boq-audit-lifecycle';
import { mepConnectorMergeConfig } from './mep-connector-merge-config';
import type {
  BimEntityPersistenceParams,
  BimEntityPersistencePublicScope,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type MepManifoldSaveState = BimEntitySaveState;

export interface UseMepManifoldPersistenceParams extends BimEntityPersistencePublicScope {
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
  // ADR-628 — audit + Η-Μ BOQ auto-feed lifecycle (manifold body = 1 piece,
  // ΗΛΜ-7.03 συλλέκτης θέρμανσης / ΗΛΜ-6.02 φρεάτιο αποχέτευσης, keyed by kind).
  ...createBimBoqAuditLifecycle<MepManifoldEntity>({
    boqType: 'mep-manifold',
    recordChange: recordMepManifoldChange,
    deletedFallbackKind: 'floor-manifold',
  }),
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
