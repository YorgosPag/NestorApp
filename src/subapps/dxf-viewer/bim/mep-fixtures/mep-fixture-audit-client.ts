'use client';

/**
 * ADR-406 — Fire-and-forget audit client for MEP fixture create / update /
 * delete / restore. Mirrors `column-audit-client.ts` (ADR-195 entity audit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-406-point-based-mep-fixture.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { MEP_FIXTURE_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { MepFixtureEntity } from '../types/mep-fixture-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type MepFixtureAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type MepFixtureAuditSnapshot = Pick<MepFixtureEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<MepFixtureEntity['params']>;
};

export interface RecordMepFixtureChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<MepFixtureEntity['params']> | null;
}

export function recordMepFixtureChange(
  action: MepFixtureAuditAction,
  entity: MepFixtureAuditSnapshot,
  options?: RecordMepFixtureChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'mep-fixture',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: MepFixtureAuditAction,
  entity: MepFixtureAuditSnapshot,
  prevParams: Partial<MepFixtureEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, MEP_FIXTURE_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, MEP_FIXTURE_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, MEP_FIXTURE_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
