'use client';

/**
 * ADR-408 Εύρος Β #2 — Fire-and-forget audit client for heating boiler create /
 * update / delete / restore. Mirrors `mep-radiator-audit-client.ts` (ADR-195
 * entity audit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { MEP_BOILER_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { MepBoilerEntity } from '../types/mep-boiler-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type MepBoilerAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type MepBoilerAuditSnapshot = Pick<MepBoilerEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<MepBoilerEntity['params']>;
};

export interface RecordMepBoilerChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<MepBoilerEntity['params']> | null;
}

export function recordMepBoilerChange(
  action: MepBoilerAuditAction,
  entity: MepBoilerAuditSnapshot,
  options?: RecordMepBoilerChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'mep-boiler',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: MepBoilerAuditAction,
  entity: MepBoilerAuditSnapshot,
  prevParams: Partial<MepBoilerEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, MEP_BOILER_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, MEP_BOILER_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, MEP_BOILER_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
