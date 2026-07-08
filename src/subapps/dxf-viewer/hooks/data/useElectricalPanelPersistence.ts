'use client';

/**
 * ADR-408 Φ3 — Electrical panel Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: MEP connector projection (`projectMepConnectorsOntoFresh`) on the
 * merged doc-entity, `differs` on the projected candidate (anti-ping-pong), and
 * audit via `recordElectricalPanelChange`. No BOQ feed. First-save on
 * `drawing:entity-created` (tool 'electrical-panel').
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { ElectricalPanelEntity } from '../../bim/types/electrical-panel-types';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import {
  createElectricalPanelFirestoreService,
  entityToSaveInput,
  ElectricalPanelFirestoreService,
  type ElectricalPanelDoc,
} from '../../bim/electrical-panels/electrical-panel-firestore-service';
import { recordElectricalPanelChange } from '../../bim/electrical-panels/electrical-panel-audit-client';
import { electricalPanelDocToEntity as docToEntity } from './electrical-panel-persistence-helpers';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import { mepConnectorMergeConfig } from './mep-connector-merge-config';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type ElectricalPanelSaveState = BimEntitySaveState;

export interface UseElectricalPanelPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey id. Forwarded to service config. */
  readonly floorId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedPanel: ElectricalPanelEntity | null;
}

export interface UseElectricalPanelPersistenceResult {
  readonly saveState: ElectricalPanelSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deletePanel: (panelId: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useElectricalPanelPersistenceBase = createBimEntityPersistenceHook<
  ElectricalPanelFirestoreService,
  ElectricalPanelDoc,
  ElectricalPanelEntity,
  ElectricalPanelEntity['params']
>({
  entityType: 'electrical-panel',
  restoreEntityType: 'electrical-panel',
  saveErrorKey: 'ELECTRICAL_PANEL_SAVE_ERROR',
  restoreErrorKey: 'ELECTRICAL_PANEL_RESTORE_ERROR',
  entityComparable: (e) => e.params,
  createService: (scope) => createElectricalPanelFirestoreService(scope),
  service: {
    save: (svc, e) => svc.savePanel(entityToSaveInput(e)),
    update: (svc, e) =>
      svc.updatePanel(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deletePanel(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribePanels(onDocs as (docs: readonly ElectricalPanelDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: mepConnectorMergeConfig(
      (e): e is ElectricalPanelEntity => (e as { type?: string }).type === 'electrical-panel',
      docToEntity,
    ),
  },
  deleteTrigger: {
    event: 'bim:electrical-panel-delete-requested',
    getId: (p) => (p as { panelId?: string }).panelId,
  },
  onPersisted: (entity, { isNew, prevComparable }) => {
    void recordElectricalPanelChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
  },
  onDeleted: (id, deleted) => {
    void recordElectricalPanelChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'distribution-board' },
    );
  },
  onRestored: (entity) => {
    void recordElectricalPanelChange('restored', entity);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useElectricalPanelPersistence(
  params: UseElectricalPanelPersistenceParams,
): UseElectricalPanelPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useElectricalPanelPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedPanel,
  } as BimEntityPersistenceParams<ElectricalPanelEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deletePanel: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
