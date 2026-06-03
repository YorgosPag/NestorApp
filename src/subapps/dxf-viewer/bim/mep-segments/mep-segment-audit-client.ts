'use client';

/**
 * ADR-408 Φ8 — Fire-and-forget audit client for MEP segment create /
 * update / delete / restore. Mirrors `electrical-panel-audit-client.ts` (ADR-195
 * entity audit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ8
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { MEP_SEGMENT_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { MepSegmentEntity } from '../types/mep-segment-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

// ============================================================================
// TYPES
// ============================================================================

export type MepSegmentAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type MepSegmentAuditSnapshot = Pick<MepSegmentEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<MepSegmentEntity['params']>;
};

export interface RecordMepSegmentChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<MepSegmentEntity['params']> | null;
}

// ============================================================================
// TRACKED FIELDS
// ============================================================================

/** MEP segment tracked fields (ADR-408 Φ8 SSoT in `config/audit-tracked-fields.ts`). */
const MEP_SEGMENT_TRACKED_FIELDS_FALLBACK = MEP_SEGMENT_TRACKED_FIELDS;

// ============================================================================
// PUBLIC API
// ============================================================================

export function recordMepSegmentChange(
  action: MepSegmentAuditAction,
  entity: MepSegmentAuditSnapshot,
  options?: RecordMepSegmentChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'mep-segment',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

function buildChanges(
  action: MepSegmentAuditAction,
  entity: MepSegmentAuditSnapshot,
  prevParams: Partial<MepSegmentEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, MEP_SEGMENT_TRACKED_FIELDS_FALLBACK),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, MEP_SEGMENT_TRACKED_FIELDS_FALLBACK),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, MEP_SEGMENT_TRACKED_FIELDS_FALLBACK);
  return changes.length > 0 ? changes : null;
}
