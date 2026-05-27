'use client';

/**
 * ADR-380 — Fire-and-forget audit client για slab-opening create/update/delete.
 * Refactored από placeholder `[{ field: 'kind', ... }]` σε diffTrackedFields
 * SSoT (mirror beam-audit-client / wall-audit-client pattern, ADR-379).
 *
 * POSTs σε /api/audit-trail/record (ADR-195 centralized endpoint).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-380-stair-slab-opening-audit-coverage.md
 * @see docs/centralized-systems/reference/adrs/ADR-379-bim-entity-audit-coverage.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { SLAB_OPENING_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { SlabOpeningEntity } from '../types/slab-opening-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type SlabOpeningAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type SlabOpeningAuditSnapshot = Pick<SlabOpeningEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<SlabOpeningEntity['params']>;
};

export interface RecordSlabOpeningChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<SlabOpeningEntity['params']> | null;
}

export function recordSlabOpeningChange(
  action: SlabOpeningAuditAction,
  entity: SlabOpeningAuditSnapshot,
  options?: RecordSlabOpeningChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'slab-opening',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget — audit failures never surface to UX */ });
}

function buildChanges(
  action: SlabOpeningAuditAction,
  entity: SlabOpeningAuditSnapshot,
  prevParams: Partial<SlabOpeningEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    // ADR-390 — 'restored' (undo→Firestore re-create) reuses creation builder.
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, SLAB_OPENING_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, SLAB_OPENING_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, SLAB_OPENING_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
