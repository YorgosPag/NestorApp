'use client';

/**
 * ADR-408 Εύρος Β #3 — Fire-and-forget audit client for underfloor heating loop
 * create / update / delete / restore. Mirrors `mep-boiler-audit-client.ts`
 * (ADR-195 entity audit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { MEP_UNDERFLOOR_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { MepUnderfloorEntity } from '../types/mep-underfloor-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type MepUnderfloorAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type MepUnderfloorAuditSnapshot = Pick<MepUnderfloorEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<MepUnderfloorEntity['params']>;
};

export interface RecordMepUnderfloorChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<MepUnderfloorEntity['params']> | null;
}

export function recordMepUnderfloorChange(
  action: MepUnderfloorAuditAction,
  entity: MepUnderfloorAuditSnapshot,
  options?: RecordMepUnderfloorChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'mep-underfloor',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: MepUnderfloorAuditAction,
  entity: MepUnderfloorAuditSnapshot,
  prevParams: Partial<MepUnderfloorEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, MEP_UNDERFLOOR_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, MEP_UNDERFLOOR_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, MEP_UNDERFLOOR_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
