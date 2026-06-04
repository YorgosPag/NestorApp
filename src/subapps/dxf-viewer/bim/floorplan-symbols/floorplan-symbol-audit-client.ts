'use client';

/**
 * ADR-415 Φ1 — Fire-and-forget audit client for floorplan-symbol create / update
 * / delete / restore. Mirrors `furniture-audit-client.ts` (ADR-195 entity audit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-415-2d-floorplan-symbol-library.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { FLOORPLAN_SYMBOL_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { FloorplanSymbolEntity } from '../types/floorplan-symbol-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type FloorplanSymbolAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type FloorplanSymbolAuditSnapshot = Pick<FloorplanSymbolEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<FloorplanSymbolEntity['params']>;
};

export interface RecordFloorplanSymbolChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<FloorplanSymbolEntity['params']> | null;
}

export function recordFloorplanSymbolChange(
  action: FloorplanSymbolAuditAction,
  entity: FloorplanSymbolAuditSnapshot,
  options?: RecordFloorplanSymbolChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'floorplan-symbol',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: FloorplanSymbolAuditAction,
  entity: FloorplanSymbolAuditSnapshot,
  prevParams: Partial<FloorplanSymbolEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, FLOORPLAN_SYMBOL_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, FLOORPLAN_SYMBOL_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, FLOORPLAN_SYMBOL_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
