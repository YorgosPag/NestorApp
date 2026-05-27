'use client';

/**
 * ADR-363 Phase 1D-C + ADR-XXX — Fire-and-forget audit client for wall
 * create / update / delete.
 *
 * POSTs to /api/audit-trail/record (ADR-195 centralized endpoint).
 * EntityAuditService has `import 'server-only'` so it cannot be called
 * directly from client code — this thin client bridges via the API route.
 *
 * Caller MUST treat the return value as void and never await it. Audit
 * failures are silently swallowed — they must never break wall operations.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.17
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { WALL_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { WallEntity } from '../types/wall-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type WallAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

/** Minimum shape needed. Full `WallEntity` satisfies it; delete-fallback can pass a stub. */
export type WallAuditSnapshot = Pick<WallEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<WallEntity['params']>;
};

export interface RecordWallChangeOptions {
  readonly entityName?: string | null;
  /** Required for `updated` to compute a meaningful diff; ignored otherwise. */
  readonly prevParams?: Partial<WallEntity['params']> | null;
}

/**
 * Fire-and-forget audit entry for a wall mutation.
 *
 * For `updated`, the caller MUST pass `prevParams` — otherwise the function
 * returns silently (no payload to diff against would produce noise).
 */
export function recordWallChange(
  action: WallAuditAction,
  entity: WallAuditSnapshot,
  options?: RecordWallChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'wall',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget — audit failures never surface to UX */ });
}

function buildChanges(
  action: WallAuditAction,
  entity: WallAuditSnapshot,
  prevParams: Partial<WallEntity['params']> | null,
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
      buildBimCreationChanges(snapshot, WALL_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, WALL_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, WALL_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
