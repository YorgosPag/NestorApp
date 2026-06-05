'use client';

/**
 * ADR-408 Εύρος Β #1 — Fire-and-forget audit client for heating radiator create /
 * update / delete / restore. Mirrors `mep-manifold-audit-client.ts` (ADR-195
 * entity audit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { MEP_RADIATOR_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { MepRadiatorEntity } from '../types/mep-radiator-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type MepRadiatorAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type MepRadiatorAuditSnapshot = Pick<MepRadiatorEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<MepRadiatorEntity['params']>;
};

export interface RecordMepRadiatorChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<MepRadiatorEntity['params']> | null;
}

export function recordMepRadiatorChange(
  action: MepRadiatorAuditAction,
  entity: MepRadiatorAuditSnapshot,
  options?: RecordMepRadiatorChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'mep-radiator',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: MepRadiatorAuditAction,
  entity: MepRadiatorAuditSnapshot,
  prevParams: Partial<MepRadiatorEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, MEP_RADIATOR_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, MEP_RADIATOR_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, MEP_RADIATOR_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
