'use client';

/**
 * ADR-363 Phase 1D-C — Fire-and-forget audit client for wall create/update/delete.
 *
 * POSTs to /api/audit-trail/record (ADR-195 centralized endpoint).
 * EntityAuditService has `import 'server-only'` so it cannot be called directly
 * from client code — this thin client bridges via the API route.
 *
 * Caller MUST treat the return value as void and never await it.
 * Audit failures are silently swallowed — they must never break wall operations.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.17
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import type { WallEntity } from '../types/wall-types';

// ============================================================================
// TYPES
// ============================================================================

export type WallAuditAction = 'created' | 'updated' | 'deleted';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Fire-and-forget audit entry for a wall mutation.
 *
 * @param action   created | updated | deleted
 * @param entity   must contain at minimum `id` + `kind`
 * @param entityName  optional display name for the audit log
 */
export function recordWallChange(
  action: WallAuditAction,
  entity: Pick<WallEntity, 'id' | 'kind'>,
  entityName?: string | null,
): void {
  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'wall',
      entityId: entity.id,
      entityName: entityName ?? null,
      action: action as AuditAction,
      changes: buildWallChanges(action, entity),
    })
    .catch(() => { /* fire-and-forget — audit failures never surface to UX */ });
}

// ============================================================================
// HELPERS
// ============================================================================

function buildWallChanges(
  action: WallAuditAction,
  entity: Pick<WallEntity, 'id' | 'kind'>,
): AuditFieldChange[] {
  if (action === 'created') {
    return [{ field: 'kind', oldValue: null, newValue: entity.kind }];
  }
  if (action === 'deleted') {
    return [{ field: 'kind', oldValue: entity.kind, newValue: null }];
  }
  return [{ field: 'params', oldValue: null, newValue: null }];
}
