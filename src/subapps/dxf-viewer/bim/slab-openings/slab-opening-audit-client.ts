'use client';

/**
 * ADR-363 Phase 3.7 — Fire-and-forget audit client για slab-opening
 * create/update/delete.
 *
 * POSTs σε /api/audit-trail/record (ADR-195 centralized endpoint).
 * EntityAuditService έχει `import 'server-only'` → δεν μπορεί να κληθεί
 * απευθείας από client code. Αυτό το thin client γεφυρώνει.
 *
 * Caller MUST treat the return value as void — όχι await. Audit failures
 * swallowed silently (δεν διακόπτουν slab-opening operations).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.17 §11.Q3
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import type { SlabOpeningEntity } from '../types/slab-opening-types';

// ============================================================================
// TYPES
// ============================================================================

export type SlabOpeningAuditAction = 'created' | 'updated' | 'deleted';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Fire-and-forget audit entry για slab-opening mutation.
 *
 * @param action     created | updated | deleted
 * @param entity     must contain at minimum `id` + `kind`
 * @param entityName optional display name για audit log
 */
export function recordSlabOpeningChange(
  action: SlabOpeningAuditAction,
  entity: Pick<SlabOpeningEntity, 'id' | 'kind'>,
  entityName?: string | null,
): void {
  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'slab-opening',
      entityId: entity.id,
      entityName: entityName ?? null,
      action: action as AuditAction,
      changes: buildChanges(action, entity),
    })
    .catch(() => { /* fire-and-forget — audit failures never surface to UX */ });
}

// ============================================================================
// HELPERS
// ============================================================================

function buildChanges(
  action: SlabOpeningAuditAction,
  entity: Pick<SlabOpeningEntity, 'id' | 'kind'>,
): AuditFieldChange[] {
  if (action === 'created') {
    return [{ field: 'kind', oldValue: null, newValue: entity.kind }];
  }
  if (action === 'deleted') {
    return [{ field: 'kind', oldValue: entity.kind, newValue: null }];
  }
  return [{ field: 'params', oldValue: null, newValue: null }];
}
