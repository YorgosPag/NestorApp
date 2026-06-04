'use client';

/**
 * ADR-408 Φ11 — Fire-and-forget audit client for MEP fitting create /
 * update / delete / restore. Mirrors `mep-segment-audit-client.ts` (ADR-195
 * entity audit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { MEP_FITTING_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { MepFittingEntity } from '../types/mep-fitting-types';
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

export type MepFittingAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type MepFittingAuditSnapshot = Pick<MepFittingEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<MepFittingEntity['params']>;
};

export interface RecordMepFittingChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<MepFittingEntity['params']> | null;
}

// ============================================================================
// TRACKED FIELDS
// ============================================================================

/** MEP fitting tracked fields (ADR-408 Φ11 SSoT in `config/audit-tracked-fields.ts`). */
const MEP_FITTING_TRACKED_FIELDS_FALLBACK = MEP_FITTING_TRACKED_FIELDS;

// ============================================================================
// PUBLIC API
// ============================================================================

export function recordMepFittingChange(
  action: MepFittingAuditAction,
  entity: MepFittingAuditSnapshot,
  options?: RecordMepFittingChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'mep-fitting',
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
  action: MepFittingAuditAction,
  entity: MepFittingAuditSnapshot,
  prevParams: Partial<MepFittingEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, MEP_FITTING_TRACKED_FIELDS_FALLBACK),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, MEP_FITTING_TRACKED_FIELDS_FALLBACK),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, MEP_FITTING_TRACKED_FIELDS_FALLBACK);
  return changes.length > 0 ? changes : null;
}
