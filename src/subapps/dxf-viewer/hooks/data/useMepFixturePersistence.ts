'use client';

/**
 * ADR-406 — MEP fixture Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: MEP connector projection (`projectMepConnectorsOntoFresh`) on the
 * merged doc-entity, `differs` on the projected candidate (anti-ping-pong), audit
 * via `recordMepFixtureChange`. No BOQ feed (a point fixture carries no quantity
 * volume in this slice). First-save on `drawing:entity-created` (tool
 * 'mep-fixture').
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { MepFixtureEntity } from '../../bim/types/mep-fixture-types';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import {
  createMepFixtureFirestoreService,
  entityToSaveInput,
  MepFixtureFirestoreService,
  type MepFixtureDoc,
} from '../../bim/mep-fixtures/mep-fixture-firestore-service';
import { recordMepFixtureChange } from '../../bim/mep-fixtures/mep-fixture-audit-client';
import { mepFixtureDocToEntity as docToEntity } from './mep-fixture-persistence-helpers';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import { mepConnectorMergeConfig } from './mep-connector-merge-config';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type MepFixtureSaveState = BimEntitySaveState;

export interface UseMepFixturePersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-420 — stable building-storey scope key (IfcBuildingStorey). */
  readonly floorId?: string | null;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedFixture: MepFixtureEntity | null;
}

export interface UseMepFixturePersistenceResult {
  readonly saveState: MepFixtureSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteFixture: (fixtureId: string) => Promise<void>;
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useMepFixturePersistenceBase = createBimEntityPersistenceHook<
  MepFixtureFirestoreService,
  MepFixtureDoc,
  MepFixtureEntity,
  MepFixtureEntity['params']
>({
  entityType: 'mep-fixture',
  restoreEntityType: 'mep-fixture',
  saveErrorKey: 'MEP_FIXTURE_SAVE_ERROR',
  restoreErrorKey: 'MEP_FIXTURE_RESTORE_ERROR',
  entityComparable: (e) => e.params,
  createService: (scope) => createMepFixtureFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveFixture(entityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateFixture(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteFixture(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeFixtures(onDocs as (docs: readonly MepFixtureDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: mepConnectorMergeConfig(
      (e): e is MepFixtureEntity => (e as { type?: string }).type === 'mep-fixture',
      docToEntity,
    ),
  },
  deleteTrigger: {
    event: 'bim:mep-fixture-delete-requested',
    getId: (p) => (p as { fixtureId?: string }).fixtureId,
  },
  onPersisted: (entity, { isNew, prevComparable }) => {
    void recordMepFixtureChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
  },
  onDeleted: (id, deleted) => {
    void recordMepFixtureChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'light-fixture' },
    );
  },
  onRestored: (entity) => {
    void recordMepFixtureChange('restored', entity);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useMepFixturePersistence(
  params: UseMepFixturePersistenceParams,
): UseMepFixturePersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useMepFixturePersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    floorId: params.floorId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedFixture,
  } as BimEntityPersistenceParams<MepFixtureEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteFixture: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
