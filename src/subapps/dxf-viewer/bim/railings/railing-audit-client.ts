'use client';

/**
 * ADR-407 — Fire-and-forget audit client for railing create / update / delete /
 * restore. Mirrors `mep-fixture-audit-client.ts` (ADR-195 entity audit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { RAILING_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { RailingEntity } from '../types/railing-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type RailingAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type RailingAuditSnapshot = Pick<RailingEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<RailingEntity['params']>;
};

export interface RecordRailingChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<RailingEntity['params']> | null;
}

export function recordRailingChange(
  action: RailingAuditAction,
  entity: RailingAuditSnapshot,
  options?: RecordRailingChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'railing',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: RailingAuditAction,
  entity: RailingAuditSnapshot,
  prevParams: Partial<RailingEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, RAILING_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, RAILING_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, RAILING_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
