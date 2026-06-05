'use client';

/**
 * ADR-417 — Fire-and-forget audit client για roof create / update / delete /
 * restore. Mirrors `railing-audit-client.ts` (ADR-407, ADR-195 entity audit).
 *
 * Τα `ROOF_TRACKED_FIELDS` ζουν πλέον στο shared SSoT `audit-tracked-fields.ts`
 * (ADR-417 §10 #5 — μεταφορά από local). Συνεπές με τα υπόλοιπα 7 BIM entities.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { ROOF_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { RoofEntity } from '../types/roof-types';
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

export type RoofAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type RoofAuditSnapshot = Pick<RoofEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<RoofEntity['params']>;
};

export interface RecordRoofChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<RoofEntity['params']> | null;
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function recordRoofChange(
  action: RoofAuditAction,
  entity: RoofAuditSnapshot,
  options?: RecordRoofChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'roof',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

// ============================================================================
// PRIVATE
// ============================================================================

function buildChanges(
  action: RoofAuditAction,
  entity: RoofAuditSnapshot,
  prevParams: Partial<RoofEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, ROOF_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, ROOF_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, ROOF_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
