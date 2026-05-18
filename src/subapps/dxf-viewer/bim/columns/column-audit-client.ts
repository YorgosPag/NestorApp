'use client';

/**
 * ADR-363 Phase 4 — Fire-and-forget audit client για column
 * create/update/delete.
 *
 * POSTs σε /api/audit-trail/record (ADR-195 centralized endpoint).
 * EntityAuditService έχει `import 'server-only'` άρα δεν μπορεί να κληθεί
 * απευθείας από client code — αυτό το thin client το γεφυρώνει.
 *
 * Caller MUST treat the return value as void και ΟΧΙ to await it.
 * Audit failures swallowed silently — δεν διακόπτουν column operations.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.17
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import type { ColumnEntity } from '../types/column-types';

// ============================================================================
// TYPES
// ============================================================================

export type ColumnAuditAction = 'created' | 'updated' | 'deleted';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Fire-and-forget audit entry για column mutation.
 *
 * @param action       created | updated | deleted
 * @param entity       must contain at minimum `id` + `kind`
 * @param entityName   optional display name για audit log
 */
export function recordColumnChange(
  action: ColumnAuditAction,
  entity: Pick<ColumnEntity, 'id' | 'kind'>,
  entityName?: string | null,
): void {
  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'column',
      entityId: entity.id,
      entityName: entityName ?? null,
      action: action as AuditAction,
      changes: buildColumnChanges(action, entity),
    })
    .catch(() => { /* fire-and-forget — audit failures never surface to UX */ });
}

// ============================================================================
// HELPERS
// ============================================================================

function buildColumnChanges(
  action: ColumnAuditAction,
  entity: Pick<ColumnEntity, 'id' | 'kind'>,
): AuditFieldChange[] {
  if (action === 'created') {
    return [{ field: 'kind', oldValue: null, newValue: entity.kind }];
  }
  if (action === 'deleted') {
    return [{ field: 'kind', oldValue: entity.kind, newValue: null }];
  }
  return [{ field: 'params', oldValue: null, newValue: null }];
}
