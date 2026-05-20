import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import type { AuditFieldChange } from '@/types/audit-trail';

const logger = createModuleLogger('FloorHeightCascade');

export interface CascadeResult {
  readonly wallsUpdated: number;
  readonly columnsUpdated: number;
  readonly skipped: number;
}

interface StoreyBoundParams {
  readonly topBinding: string;
  readonly baseOffset: number;
  readonly topOffset: number;
  readonly height?: number;
}

interface StoreyBoundDoc {
  readonly params: StoreyBoundParams;
}

interface CascadedEntry {
  readonly docId: string;
  readonly oldHeight: number | null;
  readonly newHeight: number;
}

/**
 * ADR-369 §9 Q5 — Auto-stretch cascade (Phase B, service layer).
 *
 * Triggered when floor.height changes. Recomputes `params.height` for all
 * walls and columns bound to that storey via `topBinding='storey-ceiling'`.
 *
 * Formula (mm): derivedHeight = floor.height * 1000 + topOffset - baseOffset
 *
 * - Entities with topBinding='absolute' or 'unconnected' are skipped.
 * - Idempotent: same floor.height → same result, no duplicates.
 * - Belt-and-suspenders: no-op batch if zero storey-ceiling entities.
 * - ADR-195: each updated entity gets an EntityAuditService.recordChange entry.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-369-bim-elevation-convention-revit-alignment.md §9 Q5
 */
export async function cascadeFloorHeightToEntities(
  db: Firestore,
  floorId: string,
  companyId: string,
  newHeightMetres: number,
  updatedBy: string,
): Promise<CascadeResult> {
  const [wallsSnap, columnsSnap] = await Promise.all([
    db.collection(COLLECTIONS.FLOORPLAN_WALLS)
      .where('companyId', '==', companyId)
      .where('floorId', '==', floorId)
      .get(),
    db.collection(COLLECTIONS.FLOORPLAN_COLUMNS)
      .where('companyId', '==', companyId)
      .where('floorId', '==', floorId)
      .get(),
  ]);

  const batch = db.batch();
  const newHeightMm = newHeightMetres * 1000;
  const wallEntries: CascadedEntry[] = [];
  const columnEntries: CascadedEntry[] = [];
  let skipped = 0;

  const updatedAt = FieldValue.serverTimestamp();

  for (const wallDoc of wallsSnap.docs) {
    const data = wallDoc.data() as StoreyBoundDoc;
    if (data.params?.topBinding !== 'storey-ceiling') { skipped++; continue; }
    const derived = newHeightMm + (data.params.topOffset ?? 0) - (data.params.baseOffset ?? 0);
    batch.update(wallDoc.ref, { 'params.height': derived, updatedBy, updatedAt });
    wallEntries.push({ docId: wallDoc.id, oldHeight: data.params.height ?? null, newHeight: derived });
  }

  for (const colDoc of columnsSnap.docs) {
    const data = colDoc.data() as StoreyBoundDoc;
    if (data.params?.topBinding !== 'storey-ceiling') { skipped++; continue; }
    const derived = newHeightMm + (data.params.topOffset ?? 0) - (data.params.baseOffset ?? 0);
    batch.update(colDoc.ref, { 'params.height': derived, updatedBy, updatedAt });
    columnEntries.push({ docId: colDoc.id, oldHeight: data.params.height ?? null, newHeight: derived });
  }

  if (wallEntries.length + columnEntries.length > 0) {
    await batch.commit();
    await recordCascadeAudit(wallEntries, columnEntries, companyId, updatedBy);
  }

  logger.info('[FloorHeightCascade] Complete', {
    floorId,
    newHeightMetres,
    wallsUpdated: wallEntries.length,
    columnsUpdated: columnEntries.length,
    skipped,
  });

  return {
    wallsUpdated: wallEntries.length,
    columnsUpdated: columnEntries.length,
    skipped,
  };
}

async function recordCascadeAudit(
  wallEntries: readonly CascadedEntry[],
  columnEntries: readonly CascadedEntry[],
  companyId: string,
  performedBy: string,
): Promise<void> {
  const buildChanges = (entry: CascadedEntry): AuditFieldChange[] => [
    {
      field: 'params.height',
      oldValue: entry.oldHeight,
      newValue: entry.newHeight,
      label: 'params.height',
    },
  ];

  await Promise.all([
    ...wallEntries.map((entry) =>
      EntityAuditService.recordChange({
        entityType: 'wall',
        entityId: entry.docId,
        entityName: entry.docId,
        action: 'updated',
        changes: buildChanges(entry),
        performedBy,
        performedByName: null,
        companyId,
      }),
    ),
    ...columnEntries.map((entry) =>
      EntityAuditService.recordChange({
        entityType: 'column',
        entityId: entry.docId,
        entityName: entry.docId,
        action: 'updated',
        changes: buildChanges(entry),
        performedBy,
        performedByName: null,
        companyId,
      }),
    ),
  ]);
}
