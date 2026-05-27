'use client';

/**
 * ADR-363 Phase 2 + ADR-XXX — Fire-and-forget audit client για opening
 * create / update / delete. Mirrors wall-audit-client.ts.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.17
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { OPENING_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { OpeningEntity } from '../types/opening-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type OpeningAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type OpeningAuditSnapshot = Pick<OpeningEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<OpeningEntity['params']>;
};

export interface RecordOpeningChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<OpeningEntity['params']> | null;
}

export function recordOpeningChange(
  action: OpeningAuditAction,
  entity: OpeningAuditSnapshot,
  options?: RecordOpeningChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'opening',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: OpeningAuditAction,
  entity: OpeningAuditSnapshot,
  prevParams: Partial<OpeningEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    // ADR-390 — 'restored' (undo→Firestore re-create) reuses creation builder.
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, OPENING_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, OPENING_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, OPENING_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
