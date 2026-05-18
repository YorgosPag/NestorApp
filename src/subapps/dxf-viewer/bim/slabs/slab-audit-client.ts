'use client';

/**
 * ADR-363 Phase 3 — Fire-and-forget audit client για slab create/update/delete.
 *
 * POSTs σε /api/audit-trail/record (ADR-195 centralized endpoint).
 * EntityAuditService έχει `import 'server-only'` άρα δεν μπορεί να κληθεί
 * απευθείας από client code — αυτό το thin client το γεφυρώνει.
 *
 * Caller MUST treat the return value as void και ΟΧΙ to await it.
 * Audit failures swallowed silently — δεν διακόπτουν slab operations.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.17
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import type { SlabEntity } from '../types/slab-types';

// ============================================================================
// TYPES
// ============================================================================

export type SlabAuditAction = 'created' | 'updated' | 'deleted';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Fire-and-forget audit entry για slab mutation.
 *
 * @param action       created | updated | deleted
 * @param entity       must contain at minimum `id` + `kind`
 * @param entityName   optional display name για audit log
 */
export function recordSlabChange(
  action: SlabAuditAction,
  entity: Pick<SlabEntity, 'id' | 'kind'>,
  entityName?: string | null,
): void {
  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'slab',
      entityId: entity.id,
      entityName: entityName ?? null,
      action: action as AuditAction,
      changes: buildSlabChanges(action, entity),
    })
    .catch(() => { /* fire-and-forget — audit failures never surface to UX */ });
}

// ============================================================================
// HELPERS
// ============================================================================

function buildSlabChanges(
  action: SlabAuditAction,
  entity: Pick<SlabEntity, 'id' | 'kind'>,
): AuditFieldChange[] {
  if (action === 'created') {
    return [{ field: 'kind', oldValue: null, newValue: entity.kind }];
  }
  if (action === 'deleted') {
    return [{ field: 'kind', oldValue: entity.kind, newValue: null }];
  }
  return [{ field: 'params', oldValue: null, newValue: null }];
}
