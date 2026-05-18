'use client';

/**
 * ADR-363 Phase 2 — Fire-and-forget audit client για opening create/update/delete.
 *
 * POSTs σε /api/audit-trail/record (ADR-195 centralized endpoint).
 * EntityAuditService έχει `import 'server-only'` άρα δεν μπορεί να κληθεί
 * απευθείας από client code — this thin client bridges via the API route.
 *
 * Caller MUST treat the return value as void και ΟΧΙ to await it.
 * Audit failures swallowed silently — never break opening operations.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.17
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import type { OpeningEntity } from '../types/opening-types';

// ============================================================================
// TYPES
// ============================================================================

export type OpeningAuditAction = 'created' | 'updated' | 'deleted';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Fire-and-forget audit entry για an opening mutation.
 *
 * @param action       created | updated | deleted
 * @param entity       must contain at minimum `id` + `kind`
 * @param entityName   optional display name για το audit log
 */
export function recordOpeningChange(
  action: OpeningAuditAction,
  entity: Pick<OpeningEntity, 'id' | 'kind'>,
  entityName?: string | null,
): void {
  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'opening',
      entityId: entity.id,
      entityName: entityName ?? null,
      action: action as AuditAction,
      changes: buildOpeningChanges(action, entity),
    })
    .catch(() => { /* fire-and-forget — audit failures never surface to UX */ });
}

// ============================================================================
// HELPERS
// ============================================================================

function buildOpeningChanges(
  action: OpeningAuditAction,
  entity: Pick<OpeningEntity, 'id' | 'kind'>,
): AuditFieldChange[] {
  if (action === 'created') {
    return [{ field: 'kind', oldValue: null, newValue: entity.kind }];
  }
  if (action === 'deleted') {
    return [{ field: 'kind', oldValue: entity.kind, newValue: null }];
  }
  return [{ field: 'params', oldValue: null, newValue: null }];
}
