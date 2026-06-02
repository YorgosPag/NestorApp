'use client';

/**
 * ADR-408 Φ2 — Fire-and-forget audit client for MEP system create / update /
 * delete / restore. Mirrors `mep-fixture-audit-client.ts` (ADR-195).
 *
 * The system has no `kind`; the `systemType` discriminator plays that role in
 * the shared `BimAuditSnapshot` shape so every audit row carries a meaningful
 * label even when no other tracked field changed.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { MEP_SYSTEM_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { MepSystemEntity, MepSystemParams } from '../types/mep-system-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type MepSystemAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type MepSystemAuditSnapshot = Pick<MepSystemEntity, 'id'> & {
  readonly params: MepSystemParams;
};

export interface RecordMepSystemChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: MepSystemParams | null;
}

export function recordMepSystemChange(
  action: MepSystemAuditAction,
  entity: MepSystemAuditSnapshot,
  options?: RecordMepSystemChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'mep-system',
      entityId: entity.id,
      entityName: options?.entityName ?? entity.params.name ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function toSnapshot(params: MepSystemParams): BimAuditSnapshot {
  return {
    kind: params.systemType,
    params: params as unknown as Record<string, unknown>,
  };
}

function buildChanges(
  action: MepSystemAuditAction,
  entity: MepSystemAuditSnapshot,
  prevParams: MepSystemParams | null,
): AuditFieldChange[] | null {
  const snapshot = toSnapshot(entity.params);

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, MEP_SYSTEM_TRACKED_FIELDS),
      { field: 'systemType', oldValue: null, newValue: entity.params.systemType },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, MEP_SYSTEM_TRACKED_FIELDS),
      { field: 'systemType', oldValue: entity.params.systemType, newValue: null },
    );
  }

  if (!prevParams) return null;
  const changes = buildBimUpdateChanges(toSnapshot(prevParams), snapshot, MEP_SYSTEM_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
