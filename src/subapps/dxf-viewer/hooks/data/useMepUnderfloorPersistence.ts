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
import {
  createMepUnderfloorFirestoreService,
  entityToSaveInput,
  MepUnderfloorFirestoreService,
  type MepUnderfloorDoc,
} from '../../bim/mep-underfloor/mep-underfloor-firestore-service';
import { recordMepUnderfloorChange } from '../../bim/mep-underfloor/mep-underfloor-audit-client';
import { mepUnderfloorDocToEntity as docToEntity } from './mep-underfloor-persistence-helpers';
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

export type MepUnderfloorSaveState = BimEntitySaveState;

export interface UseMepUnderfloorPersistenceParams extends BimEntityPersistencePublicScope {
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
  // ADR-628 — audit + Η-Μ BOQ auto-feed lifecycle. Underfloor loop = developed
  // serpentine pipe length (m, ΗΛΜ-7.04): totalLengthM → BimEntityForBoq.geometry.lengthM.
  ...createBimBoqAuditLifecycle<MepUnderfloorEntity>({
    boqType: 'mep-underfloor',
    recordChange: recordMepUnderfloorChange,
    deletedFallbackKind: 'hydronic-loop',
    boqPayload: (entity) => ({
      id: entity.id,
      kind: entity.kind,
      geometry: { lengthM: entity.geometry.totalLengthM },
    }),
  }),
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
