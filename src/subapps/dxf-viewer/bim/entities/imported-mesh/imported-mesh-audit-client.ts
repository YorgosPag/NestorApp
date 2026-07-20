'use client';

/**
 * ADR-683 Φ3β — fire-and-forget audit client για εισαγόμενα πλέγματα
 * (create / update / delete / restore). Καθρέφτης του `furniture-audit-client.ts`.
 *
 * **Γιατί έχει ιδιαίτερη αξία εδώ:** το εισαγόμενο αντικείμενο είναι το μόνο που **δεν** το
 * σχεδίασε ο χρήστης. Όταν σε έξι μήνες κάποιος ρωτήσει «από πού ήρθε αυτό το κάγκελο και ποιος
 * το έβαλε;», το ιστορικό κρατά το `sourceFileName` και το `uploadId` — αλλιώς η απάντηση χάνεται
 * μαζί με το email του συνεργάτη.
 *
 * @see ../../furniture/furniture-audit-client — ο αδελφός που καθρεφτίζεται
 * @see docs/centralized-systems/reference/adrs/ADR-195-entity-audit-trail.md
 */

import { apiClient } from '@/lib/api/enterprise-api-client';
import type { AuditAction, AuditFieldChange } from '@/types/audit-trail';
import { IMPORTED_MESH_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
import type { ImportedMeshEntity } from './imported-mesh-types';
import {
  buildBimCreationChanges,
  buildBimDeletionChanges,
  buildBimUpdateChanges,
  ensureNonEmptyChanges,
  type BimAuditSnapshot,
} from '../../utils/bim-audit-helpers';

export type ImportedMeshAuditAction = 'created' | 'updated' | 'deleted' | 'restored';

export type ImportedMeshAuditSnapshot = Pick<ImportedMeshEntity, 'id'> & {
  readonly kind?: string;
  readonly layerId?: string;
  readonly params?: Partial<ImportedMeshEntity['params']>;
};

export interface RecordImportedMeshChangeOptions {
  readonly entityName?: string | null;
  readonly prevParams?: Partial<ImportedMeshEntity['params']> | null;
}

export function recordImportedMeshChange(
  action: ImportedMeshAuditAction,
  entity: ImportedMeshAuditSnapshot,
  options?: RecordImportedMeshChangeOptions,
): void {
  const changes = buildChanges(action, entity, options?.prevParams ?? null);
  if (changes === null) return;

  apiClient
    .post('/api/audit-trail/record', {
      entityType: 'imported-mesh',
      entityId: entity.id,
      // Το όνομα κόμβου ΕΙΝΑΙ το ανθρώπινο όνομα («Rail_01») — ό,τι είδε ο χρήστης στη λίστα.
      entityName: options?.entityName ?? entity.params?.nodeName ?? null,
      action: action as AuditAction,
      changes,
    })
    .catch(() => { /* fire-and-forget */ });
}

function buildChanges(
  action: ImportedMeshAuditAction,
  entity: ImportedMeshAuditSnapshot,
  prevParams: Partial<ImportedMeshEntity['params']> | null,
): AuditFieldChange[] | null {
  const kind = entity.kind ?? 'imported';
  const snapshot: BimAuditSnapshot = {
    kind,
    layerId: entity.layerId,
    params: entity.params as Record<string, unknown> | undefined,
  };

  if (action === 'created' || action === 'restored') {
    return ensureNonEmptyChanges(
      buildBimCreationChanges(snapshot, IMPORTED_MESH_TRACKED_FIELDS),
      { field: 'nodeName', oldValue: null, newValue: entity.params?.nodeName ?? kind },
    );
  }

  if (action === 'deleted') {
    return ensureNonEmptyChanges(
      buildBimDeletionChanges(snapshot, IMPORTED_MESH_TRACKED_FIELDS),
      { field: 'nodeName', oldValue: entity.params?.nodeName ?? kind, newValue: null },
    );
  }

  if (!prevParams) return null;
  const prevSnapshot: BimAuditSnapshot = {
    kind,
    layerId: entity.layerId,
    params: prevParams as Record<string, unknown>,
  };
  const changes = buildBimUpdateChanges(prevSnapshot, snapshot, IMPORTED_MESH_TRACKED_FIELDS);
  return changes.length > 0 ? changes : null;
}
