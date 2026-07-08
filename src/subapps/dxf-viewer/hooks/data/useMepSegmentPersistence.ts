'use client';

/**
 * ADR-408 Φ8 / ADR-594 Phase 2 — MEP segment Firestore persistence React adapter.
 *
 * Thin config over the `createBimEntityPersistenceHook` SSoT. MEP segment is a
 * delete-wins entity: it drops the selected-entity debounce for an event-driven
 * auto-save (`bim:mep-segment-params-updated`) and guards persist against a racing
 * delete (`raceGuardDelete`) so a first-save that loses the race to a delete
 * compensates instead of leaving a Firestore zombie. No write-grace, no serializer.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 * @see docs/centralized-systems/reference/adrs/ADR-594-bim-entity-persistence-hook-ssot.md
 */

import { useMemo } from 'react';

import type { AnySceneEntity } from '../../types/entities';
import type { MepSegmentEntity } from '../../bim/types/mep-segment-types';
import {
  createMepSegmentFirestoreService,
  entityToSaveInput,
  MepSegmentFirestoreService,
  type MepSegmentDoc,
} from '../../bim/mep-segments/mep-segment-firestore-service';
import { recordMepSegmentChange } from '../../bim/mep-segments/mep-segment-audit-client';
import { mepSegmentDocToEntity as docToEntity } from './mep-segment-persistence-helpers';
import { bimToBoqBridge } from '../../bim/services/BimToBoqBridge';
import { createBimEntityPersistenceHook } from './create-bim-entity-persistence-hook';
import type {
  BimEntityPersistenceParams,
  BimEntitySaveState,
} from './bim-entity-persistence-hook-types';

// ============================================================================
// PUBLIC API (unchanged)
// ============================================================================

export type MepSegmentSaveState = BimEntitySaveState;

export interface UseMepSegmentPersistenceParams
  extends Omit<BimEntityPersistenceParams<MepSegmentEntity>, 'primarySelected'> {
  readonly primarySelectedSegment: MepSegmentEntity | null;
}

export interface UseMepSegmentPersistenceResult {
  readonly saveState: MepSegmentSaveState;
  readonly lastSavedAt: number | null;
  readonly error: string | null;
  readonly saveNow: () => Promise<void>;
  readonly deleteSegment: (segmentId: string) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

function isSegment(entity: AnySceneEntity): entity is MepSegmentEntity {
  return (entity as { type?: string }).type === 'mep-segment';
}

// ============================================================================
// FACTORY CONFIG
// ============================================================================

const useMepSegmentPersistenceBase = createBimEntityPersistenceHook<
  MepSegmentFirestoreService,
  MepSegmentDoc,
  MepSegmentEntity,
  MepSegmentEntity['params']
>({
  entityType: 'mep-segment',
  restoreEntityType: 'mep-segment',
  saveErrorKey: 'MEP_SEGMENT_SAVE_ERROR',
  restoreErrorKey: 'MEP_SEGMENT_RESTORE_ERROR',
  typeGuard: isSegment,
  entityComparable: (e) => e.params,
  // Delete-wins race semantics + event-driven autosave (no write-grace / serializer).
  raceGuardDelete: true,
  markDeletedOnRequest: true,
  autoSaveTrigger: {
    event: 'bim:mep-segment-params-updated',
    getId: (p) => (p as { segmentId?: string }).segmentId,
  },
  createService: (scope) => createMepSegmentFirestoreService(scope),
  service: {
    save: (svc, e) => svc.saveSegment(entityToSaveInput(e)).then(() => undefined),
    update: (svc, e) =>
      svc.updateSegment(e.id, {
        params: e.params,
        validation: e.validation,
        geometry: e.geometry,
        layerId: e.layerId,
      }),
    remove: (svc, id) => svc.deleteSegment(id),
    subscribe: (svc, onDocs, onErr) =>
      svc.subscribeSegments(onDocs as (docs: readonly MepSegmentDoc[]) => void, onErr),
  },
  merge: {
    mode: 'generic',
    config: {
      isEntity: isSegment,
      docToEntity,
      entityComparable: (e) => e.params,
      docComparable: (d) => d.params,
      // EDGE (Tier 4): keep un-persisted DXF segments (never in the baseline); drop
      // only genuine remote deletes (was persisted AND the doc disappeared).
      shouldDropOrphan: (id, r) =>
        !r.dirty.has(id) && !r.pending.has(id) && r.lastSavedBaseline.has(id),
    },
  },
  deleteTrigger: {
    event: 'bim:mep-segment-delete-requested',
    getId: (p) => (p as { segmentId?: string }).segmentId,
  },
  onPersisted: (entity, { isNew, prevComparable, scope }) => {
    void recordMepSegmentChange(
      isNew ? 'created' : 'updated',
      entity,
      { prevParams: prevComparable ?? undefined },
    );
    // ADR-408 — Η-Μ BOQ auto-feed: pipe/duct = running length (m), billed per
    // plumbing classification (Revit System takeoff). length → geometry.lengthM.
    const { companyId, projectId, buildingId, floorId } = scope;
    if (companyId && projectId && buildingId) {
      void bimToBoqBridge.upsertBoqItemForBim(
        'mep-segment',
        {
          id: entity.id,
          kind: entity.kind,
          params: { classification: entity.params.classification },
          geometry: { lengthM: entity.geometry.length },
        },
        { companyId, projectId, buildingId, floorId: floorId ?? undefined },
        isNew ? 'created' : 'updated',
      );
    }
  },
  onDeleted: (id, deleted, { scope }) => {
    void recordMepSegmentChange(
      'deleted',
      deleted
        ? { id: deleted.id, kind: deleted.kind, layerId: deleted.layerId, params: deleted.params }
        : { id, kind: 'duct' },
    );
    // ADR-408 — remove the auto-fed Η-Μ BOQ row (skips user-detached rows).
    if (scope.companyId) void bimToBoqBridge.deleteBoqItemForBim(id, scope.companyId);
  },
  onRestored: (entity) => {
    void recordMepSegmentChange('restored', entity);
  },
});

// ============================================================================
// HOOK (thin wrapper — preserves the public param/result names)
// ============================================================================

export function useMepSegmentPersistence(
  params: UseMepSegmentPersistenceParams,
): UseMepSegmentPersistenceResult {
  const { primarySelectedSegment, ...rest } = params;
  const { saveState, lastSavedAt, error, saveNow, deleteEntity } =
    useMepSegmentPersistenceBase({
      ...rest,
      primarySelected: primarySelectedSegment,
    } as BimEntityPersistenceParams<MepSegmentEntity>);
  return useMemo(
    () => ({ saveState, lastSavedAt, error, saveNow, deleteSegment: deleteEntity }),
    [saveState, lastSavedAt, error, saveNow, deleteEntity],
  );
}
