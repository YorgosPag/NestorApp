'use client';

/**
 * ADR-408 DHW — Domestic hot water heater Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: MEP connector projection (`projectMepConnectorsOntoFresh`) on the
 * merged doc-entity, `differs` on the projected candidate (anti-ping-pong), audit
 * via `recordMepWaterHeaterChange`, and the Η-Μ BOQ auto-feed (1 piece).
 * First-save on `drawing:entity-created` (tool 'mep-water-heater').
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { MepWaterHeaterEntity } from '../../bim/types/mep-water-heater-types';
import {
  createMepWaterHeaterFirestoreService,
  entityToSaveInput,
  MepWaterHeaterFirestoreService,
  type MepWaterHeaterDoc,
} from '../../bim/mep-water-heaters/mep-water-heater-firestore-service';
import { recordMepWaterHeaterChange } from '../../bim/mep-water-heaters/mep-water-heater-audit-client';
import { mepWaterHeaterDocToEntity as docToEntity } from './mep-water-heater-persistence-helpers';
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

export type MepWaterHeaterSaveState = BimEntitySaveState;

export interface UseMepWaterHeaterPersistenceParams extends BimEntityPersistencePublicScope {
  readonly primarySelectedWaterHeater: MepWaterHeaterEntity | null;
}

export interface UseMepWaterHeaterPersistenceResult {
  readonly saveState: MepWaterHeaterSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteWaterHeater: (waterHeaterId: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useMepWaterHeaterPersistenceBase = createBimEntityPersistenceHook<
  MepWaterHeaterFirestoreService,
  MepWaterHeaterDoc,
  MepWaterHeaterEntity,
  MepWaterHeaterEntity['params']
>({
  entityType: 'mep-water-heater',
  restoreEntityType: 'mep-water-heater',
  saveErrorKey: 'MEP_WATER_HEATER_SAVE_ERROR',
  restoreErrorKey: 'MEP_WATER_HEATER_RESTORE_ERROR',
  entityComparable: (e) => e.params,
  createService: (scope) => createMepWaterHeaterFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveWaterHeater(entityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateWaterHeater(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteWaterHeater(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeWaterHeaters(onDocs as (docs: readonly MepWaterHeaterDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: mepConnectorMergeConfig(
      (e): e is MepWaterHeaterEntity => (e as { type?: string }).type === 'mep-water-heater',
      docToEntity,
    ),
  },
  deleteTrigger: {
    event: 'bim:mep-water-heater-delete-requested',
    getId: (p) => (p as { waterHeaterId?: string }).waterHeaterId,
  },
  // ADR-628 — audit + Η-Μ BOQ auto-feed lifecycle (domestic hot water heater = 1 piece).
  ...createBimBoqAuditLifecycle<MepWaterHeaterEntity>({
    boqType: 'mep-water-heater',
    recordChange: recordMepWaterHeaterChange,
    deletedFallbackKind: 'electric-water-heater',
  }),
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useMepWaterHeaterPersistence(
  params: UseMepWaterHeaterPersistenceParams,
): UseMepWaterHeaterPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useMepWaterHeaterPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    buildingId: params.buildingId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedWaterHeater,
  } as BimEntityPersistenceParams<MepWaterHeaterEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteWaterHeater: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
