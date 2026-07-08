'use client';

/**
 * ADR-407 — Railing Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT (ADR-594). Behaviour
 * unchanged: subscribe + diff-merge, first-save on `drawing:entity-created` (tool
 * 'railing'), 500ms auto-save debounce, delete on `bim:railing-delete-requested`,
 * audit via `recordRailingChange`, and the ΑΤΟΕ BOQ auto-feed on create/update ONLY
 * (running length via `geometry.lengthM`, OIK-12.01 «Κιγκλίδωμα μεταλλικό» — mirror
 * of beam). No write-grace. Geometry is re-derived from params on hydrate (PATH ⊥
 * TYPE → derived geometry, never persisted as truth).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { AnySceneEntity } from '../../types/entities';
import type { RailingEntity } from '../../bim/types/railing-types';
import {
  createRailingFirestoreService,
  entityToSaveInput,
  RailingFirestoreService,
  type RailingDoc,
} from '../../bim/railings/railing-firestore-service';
import { recordRailingChange } from '../../bim/railings/railing-audit-client';
import { railingDocToEntity as docToEntity } from './railing-persistence-helpers';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import type { LevelSceneWriter } from '../../systems/levels/level-scene-accessor';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type RailingSaveState = BimEntitySaveState;

export interface UseRailingPersistenceParams {
  readonly companyId: string | null;
  readonly projectId: string | null | undefined;
  readonly floorplanId: string | null | undefined;
  /** ADR-407 — tenant scope for the ΑΤΟΕ BOQ auto-feed (running length, m). */
  readonly buildingId?: string;
  readonly floorId?: string;
  readonly userId: string | null;
  readonly levelManager: LevelSceneWriter;
  readonly primarySelectedRailing: RailingEntity | null;
}

export interface UseRailingPersistenceResult {
  readonly saveState: RailingSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteRailing: (railingId: string) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

function isRailing(entity: AnySceneEntity): entity is RailingEntity {
  return (entity as { type?: string }).type === 'railing';
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useRailingPersistenceBase = createBimEntityPersistenceHook<
  RailingFirestoreService,
  RailingDoc,
  RailingEntity,
  RailingEntity['params']
>({
  entityType: 'railing',
  restoreEntityType: 'railing',
  saveErrorKey: 'RAILING_SAVE_ERROR',
  restoreErrorKey: 'RAILING_RESTORE_ERROR',
  typeGuard: isRailing,
  entityComparable: (e) => e.params,
  createService: (scope) => createRailingFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveRailing(entityToSaveInput(e)),
    update: (svc, e) =>
      svc.updateRailing(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteRailing(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeRailings(onDocs as (docs: readonly RailingDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isRailing,
      docToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
    },
  },
  deleteTrigger: {
    event: 'bim:railing-delete-requested',
    getId: (p) => (p as { railingId?: string }).railingId,
  },
  onPersisted: (entity, { isNew, prevComparable, scope }) => {
    void recordRailingChange(isNew ? 'created' : 'updated', entity, {
      prevParams: prevComparable ?? undefined,
    });
    // ADR-407 — ΑΤΟΕ BOQ auto-feed: railing = running length (m) via
    // geometry.lengthM (OIK-12.01 «Κιγκλίδωμα μεταλλικό»). Mirror of beam.
    if (scope.companyId && scope.projectId && scope.buildingId) {
      void bimToBoqBridge.upsertBoqItemForBim(
        'railing',
        { id: entity.id, kind: entity.kind, geometry: entity.geometry },
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
  onDeleted: (id, deleted) => {
    void recordRailingChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'railing' },
    );
  },
  onRestored: (entity) => {
    void recordRailingChange('restored', entity);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useRailingPersistence(
  params: UseRailingPersistenceParams,
): UseRailingPersistenceResult {
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } = useRailingPersistenceBase({
    companyId: params.companyId,
    projectId: params.projectId,
    floorplanId: params.floorplanId,
    buildingId: params.buildingId,
    floorId: params.floorId,
    userId: params.userId,
    levelManager: params.levelManager,
    primarySelected: params.primarySelectedRailing,
  } as BimEntityPersistenceParams<RailingEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteRailing: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
