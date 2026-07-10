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
import {
  createMepBoilerFirestoreService,
  entityToSaveInput,
  MepBoilerFirestoreService,
  type MepBoilerDoc,
} from '../../bim/mep-boilers/mep-boiler-firestore-service';
import { recordMepBoilerChange } from '../../bim/mep-boilers/mep-boiler-audit-client';
import { mepBoilerDocToEntity as docToEntity } from './mep-boiler-persistence-helpers';
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

export type MepBoilerSaveState = BimEntitySaveState;

export interface UseMepBoilerPersistenceParams extends BimEntityPersistencePublicScope {
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
  // ADR-628 — audit + Η-Μ BOQ auto-feed lifecycle (heating boiler = 1 piece, ΗΛΜ-7.02).
  ...createBimBoqAuditLifecycle<MepBoilerEntity>({
    boqType: 'mep-boiler',
    recordChange: recordMepBoilerChange,
    deletedFallbackKind: 'wall-boiler',
  }),
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
