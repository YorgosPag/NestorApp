'use client';

/**
 * ADR-412 Φ5 — Fire-and-forget audit client for BIM family-type
 * create / update / delete (Revit «Type» edits).
 *
 * Mirror of `bim/walls/wall-audit-client.ts`. POSTs to /api/audit-trail/record
 * (ADR-195 centralized endpoint); `EntityAuditService` is `server-only` so the
 * thin client bridges via the API route. `entityType: 'bim_family_type'` is a
 * subcollection entity — the route verifies ownership against the caller's own
 * `companies/{companyId}/bim_family_types` subcollection.
 *
 * Caller MUST treat the return value as void and never await it. Audit failures
 * are silently swallowed — they must never break a type edit.
 *
 * The audit snapshot flattens `{ name, ...typeParams }`, so `name` + the
 * type-level wall params (`category`/`thickness`/`material`/`dna`) diff via the
 * `BIM_FAMILY_TYPE_TRACKED_FIELDS` registry — same helper SSoT every BIM
 * audit-client uses (`bim-audit-helpers.ts`).
 *
 * @see bim/walls/wall-audit-client.ts — sibling pattern
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md §3.5
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { BIM_FAMILY_TYPE_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { BimFamilyType, SlabTypeParams, WallTypeParams } from '../types/bim-family-type';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type FamilyTypeAuditAction = 'created' | 'updated' | 'deleted';

/**
 * Type-level params of any auditable family-type category. Wall is keyed by
 * `category`, slab by `kind` — `toSnapshot` reads whichever discriminator is
 * present (both feed the same `BimAuditSnapshot.kind`).
 */
export type AnyFamilyTypeParams = WallTypeParams | SlabTypeParams;

/**
 * Minimum shape needed to audit a family type. `BimFamilyType<'wall'>` and
 * `BimFamilyType<'slab'>` both satisfy it.
 */
export type FamilyTypeAuditSnapshot = Pick<BimFamilyType, 'id' | 'name' | 'category'> & {
  readonly typeParams: AnyFamilyTypeParams;
};

export interface RecordFamilyTypeChangeOptions {
  /** Required for `updated` to compute a meaningful diff; ignored otherwise. */
  readonly prevTypeParams?: AnyFamilyTypeParams | null;
}

/**
 * Fire-and-forget audit entry for a family-type mutation.
 *
 * For `updated`, the caller MUST pass `prevTypeParams` — otherwise the function
 * returns silently (no payload to diff against would produce noise).
 */
export function recordFamilyTypeChange(
  action: FamilyTypeAuditAction,
  type: FamilyTypeAuditSnapshot,
  options?: RecordFamilyTypeChangeOptions,
): void {
  const changes = buildChanges(action, type, options?.prevTypeParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'bim_family_type',
      entityId: type.id,
      entityName: type.name,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget — audit failures never surface to UX */ });
}

/** Flatten a family type to the audit snapshot shape (`name` + type params). */
function toSnapshot(name: string, params: AnyFamilyTypeParams): BimAuditSnapshot {
  // Wall types discriminate on `category`, slab types on `kind`.
  const kind = 'category' in params ? params.category : params.kind;
  return {
    kind,
    params: { name, ...params } as Record<string, unknown>,
  };
}

function buildChanges(
  action: FamilyTypeAuditAction,
  type: FamilyTypeAuditSnapshot,
  prevTypeParams: AnyFamilyTypeParams | null,
): AuditFieldChange[] | null {
  const snapshot = toSnapshot(type.name, type.typeParams);

  if (action === 'created') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, BIM_FAMILY_TYPE_TRACKED_FIELDS),
      { field: 'name', oldValue: null, newValue: type.name },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, BIM_FAMILY_TYPE_TRACKED_FIELDS),
      { field: 'name', oldValue: type.name, newValue: null },
    );
  }

  if (!prevTypeParams) return null;
  const prevSnapshot = toSnapshot(type.name, prevTypeParams);
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, BIM_FAMILY_TYPE_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
