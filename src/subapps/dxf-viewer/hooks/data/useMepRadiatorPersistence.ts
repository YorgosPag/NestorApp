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
import {
  createMepRadiatorFirestoreService,
  entityToSaveInput,
  MepRadiatorFirestoreService,
  type MepRadiatorDoc,
} from '../../bim/mep-radiators/mep-radiator-firestore-service';
import { recordMepRadiatorChange } from '../../bim/mep-radiators/mep-radiator-audit-client';
import { mepRadiatorDocToEntity as docToEntity } from './mep-radiator-persistence-helpers';
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

export type MepRadiatorSaveState = BimEntitySaveState;

export interface UseMepRadiatorPersistenceParams extends BimEntityPersistencePublicScope {
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
  // ADR-628 — audit + Η-Μ BOQ auto-feed lifecycle (heating radiator = 1 piece, ΗΛΜ-7.01).
  ...createBimBoqAuditLifecycle<MepRadiatorEntity>({
    boqType: 'mep-radiator',
    recordChange: recordMepRadiatorChange,
    deletedFallbackKind: 'panel-radiator',
  }),
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
