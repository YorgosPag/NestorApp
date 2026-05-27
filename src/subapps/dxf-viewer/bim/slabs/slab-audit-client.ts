'use client';

/**
 * ADR-363 Phase 3 + ADR-XXX — Fire-and-forget audit client για slab
 * create / update / delete. Mirrors wall-audit-client.ts.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.17
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { SLAB_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { SlabEntity } from '../types/slab-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type SlabAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type SlabAuditSnapshot = Pick<SlabEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<SlabEntity['params']>;
};

export interface RecordSlabChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<SlabEntity['params']> | null;
}

export function recordSlabChange(
  action: SlabAuditAction,
  entity: SlabAuditSnapshot,
  options?: RecordSlabChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'slab',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: SlabAuditAction,
  entity: SlabAuditSnapshot,
  prevParams: Partial<SlabEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    // ADR-390 — 'restored' (undo→Firestore re-create) carries full snapshot
    // identical to 'created'; only the audit action label differs.
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, SLAB_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, SLAB_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, SLAB_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
