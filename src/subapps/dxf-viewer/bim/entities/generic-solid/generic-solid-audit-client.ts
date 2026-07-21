'use client';

/**
 * ADR-684 Φ4-C — fire-and-forget audit client για παραμετρικά στερεά (create / update / delete /
 * restore). Καθρέφτης του `furniture-audit-client.ts` (ADR-410) — ο furniture είναι ο πλησιέστερος
 * αδελφός (point entity χωρίς human `nodeName`, ίδιο tracked-fields μοτίβο).
 *
 * **Γιατί έχει αξία εδώ:** το `structuralRole` (δομικό↔διακοσμητικό) αλλάζει ΑΝ το στερεό παράγει
 * γραμμή προμέτρησης· ένα «ποιος και πότε το γύρισε σε διακοσμητικό» πρέπει να φαίνεται στο ιστορικό.
 * Το `shape` (nested union) track-άρεται ολόκληρο ώστε κάθε αλλαγή διάστασης να καταγράφεται.
 *
 * @see ../../furniture/furniture-audit-client — ο αδελφός που καθρεφτίζεται
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { GENERIC_SOLID_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { GenericSolidEntity } from './generic-solid-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../../utils/bim-audit-helpers';

export type GenericSolidAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type GenericSolidAuditSnapshot = Pick<GenericSolidEntity, 'id' | 'kind'> & {
  readonly layerId?: string;
  readonly params?: Partial<GenericSolidEntity['params']>;
};

export interface RecordGenericSolidChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<GenericSolidEntity['params']> | null;
}

export function recordGenericSolidChange(
  action: GenericSolidAuditAction,
  entity: GenericSolidAuditSnapshot,
  options?: RecordGenericSolidChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'generic-solid',
      entityId: entity.id,
      entityName: options?.entityName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: GenericSolidAuditAction,
  entity: GenericSolidAuditSnapshot,
  prevParams: Partial<GenericSolidEntity['params']> | null,
): AuditFieldChange[] | null {
  const snapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, GENERIC_SOLID_TRACKED_FIELDS),
      { field: 'kind', oldValue: null, newValue: entity.kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, GENERIC_SOLID_TRACKED_FIELDS),
      { field: 'kind', oldValue: entity.kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind: entity.kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, GENERIC_SOLID_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
