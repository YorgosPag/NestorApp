'use client';

/**
 * ADR-436 Slice 1-persist — Fire-and-forget audit client για foundation
 * create / update / delete / restore. Mirror του column-audit-client.ts.
 *
 * Posts σε `/api/audit-trail/record` (entityType: 'foundation') — η εγγραφή στο
 * `entity_audit_trail` γίνεται server-side μέσω του `EntityAuditService` SSoT
 * (ADR-195). Μηδέν direct Firestore write από εδώ.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-436-bim-foundation-discipline.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { FOUNDATION_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { FoundationEntity } from '../types/foundation-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type FoundationAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type FoundationAuditSnapshot = Pick<FoundationEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<FoundationEntity['params']>;
};

export interface RecordFoundationChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<FoundationEntity['params']> | null;
}

export function recordFoundationChange(
  action: FoundationAuditAction,
  entity: FoundationAuditSnapshot,
  options?: RecordFoundationChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'foundation',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: FoundationAuditAction,
  entity: FoundationAuditSnapshot,
  prevParams: Partial<FoundationEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    // 'restored' (undo→Firestore re-create) reuses the creation builder.
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, FOUNDATION_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, FOUNDATION_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, FOUNDATION_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
