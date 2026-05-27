'use client';

/**
 * ADR-380 — Fire-and-forget audit client για stair create / update / delete.
 * Mirrors beam-audit-client.ts (ADR-379 pattern). Uses the BIM audit-helpers
 * SSoT so diff semantics match the other 5 BIM entity types.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-380-stair-slab-opening-audit-coverage.md
 * @see docs/centralized-systems/reference/adrs/ADR-379-bim-entity-audit-coverage.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { STAIR_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { StairEntity } from '../types/stair-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type StairAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type StairAuditSnapshot = Pick<StairEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<StairEntity['params']>;
};

export interface RecordStairChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<StairEntity['params']> | null;
}

export function recordStairChange(
  action: StairAuditAction,
  entity: StairAuditSnapshot,
  options?: RecordStairChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'stair',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: StairAuditAction,
  entity: StairAuditSnapshot,
  prevParams: Partial<StairEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    // ADR-390 — 'restored' (undo→Firestore re-create) reuses creation builder.
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, STAIR_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, STAIR_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, STAIR_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
