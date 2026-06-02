'use client';

/**
 * ADR-408 Φ3 — Fire-and-forget audit client for electrical panel create /
 * update / delete / restore. Mirrors `mep-fixture-audit-client.ts` (ADR-195
 * entity audit).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { ELECTRICAL_PANEL_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { ElectricalPanelEntity } from '../types/electrical-panel-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../utils/bim-audit-helpers';

export type ElectricalPanelAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type ElectricalPanelAuditSnapshot = Pick<ElectricalPanelEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<ElectricalPanelEntity['params']>;
};

export interface RecordElectricalPanelChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<ElectricalPanelEntity['params']> | null;
}

export function recordElectricalPanelChange(
  action: ElectricalPanelAuditAction,
  entity: ElectricalPanelAuditSnapshot,
  options?: RecordElectricalPanelChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'electrical-panel',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: ElectricalPanelAuditAction,
  entity: ElectricalPanelAuditSnapshot,
  prevParams: Partial<ElectricalPanelEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, ELECTRICAL_PANEL_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, ELECTRICAL_PANEL_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, ELECTRICAL_PANEL_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
