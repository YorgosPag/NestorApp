'use client';

/**
 * ADR-408 DHW — Fire-and-forget audit client for domestic hot water heater
 * (θερμοσίφωνας) create / update / delete / restore. Mirrors
 * `mep-boiler-audit-client.ts` (ADR-195 entity audit).
 *
 * NOTE: `MEP_WATER_HEATER_TRACKED_FIELDS` will be added to
 * `src/config/audit-tracked-fields.ts` in the next integration step. Until then
 * this client reuses `MEP_BOILER_TRACKED_FIELDS`, which tracks the same scalar
 * fields (kind / shape / width / length / bodyHeightMm / mountingElevationMm /
 * connectorDiameterMm / systemClassification / thermalOutputW / rotation /
 * material / storeyId / hostId) — structurally identical for the DHW heater.
 * Replace the import alias once the dedicated constant is available.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
// TODO(ADR-408 DHW integration): replace with MEP_WATER_HEATER_TRACKED_FIELDS once
// added to audit-tracked-fields.ts (same shape as MEP_BOILER_TRACKED_FIELDS).
import { MEP_BOILER_TRACKED_FIELDS as MEP_WATER_HEATER_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { MepWaterHeaterEntity } from '../types/mep-water-heater-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type MepWaterHeaterAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type MepWaterHeaterAuditSnapshot = Pick<MepWaterHeaterEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<MepWaterHeaterEntity['params']>;
};

export interface RecordMepWaterHeaterChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<MepWaterHeaterEntity['params']> | null;
}

export function recordMepWaterHeaterChange(
  action: MepWaterHeaterAuditAction,
  entity: MepWaterHeaterAuditSnapshot,
  options?: RecordMepWaterHeaterChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'mep-water-heater',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: MepWaterHeaterAuditAction,
  entity: MepWaterHeaterAuditSnapshot,
  prevParams: Partial<MepWaterHeaterEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, MEP_WATER_HEATER_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, MEP_WATER_HEATER_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, MEP_WATER_HEATER_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
