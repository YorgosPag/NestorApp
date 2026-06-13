import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FIELDS } from '@/config/firestore-field-constants';
import { DEFAULT_FLOOR_HEIGHT_M } from '@/utils/floor-naming';
import { createModuleLogger } from '@/lib/telemetry';
import { EntityAuditService } from '@/services/entity-audit.service';
import { ENTITY_TYPES } from '@/config/domain-constants';
import type { AuditFieldChange } from '@/types/audit-trail';

const logger = createModuleLogger('FloorElevationCascade');

/** Metres — floor elevations are compared with this tolerance (sub-millimetre). */
const ELEVATION_EPSILON_M = 1e-4;

export interface ElevationCascadeResult {
  /** How many upper floors had their elevation shifted. */
  readonly floorsUpdated: number;
  /** Floors walked but already at the derived elevation (idempotent no-op). */
  readonly skipped: number;
}

/** Minimal floor shape the cascade reasons over. */
interface FloorRow {
  readonly id: string;
  readonly number: number;
  elevation: number | null;
  readonly height: number;
}

interface ShiftEntry {
  readonly id: string;
  readonly name: string;
  readonly oldValue: number | null;
  readonly newValue: number;
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * ADR-450 §1 — Revit level-driven floor-elevation cascade (service layer).
 *
 * Triggered when `floor.height` changes. Restores the storey invariant
 * `elevation[i+1] = elevation[i] + height[i]` for every floor **above** the
 * changed one (chain upward) — so an upper floor's FFL follows when the storey
 * below it grows or shrinks (Revit «μετακινείς ένα Level → τα από πάνω
 * ακολουθούν»). This keeps `floor.elevation` consistent with `floor.height`, the
 * pre-condition that lets columns (read `floor.height`) and beams/slabs (read the
 * inter-floor ceiling) resolve to ONE storey ceiling (ADR-450 §2 SSoT-unify).
 *
 * - Self-healing (absolute, not delta): recomputes from the changed floor's
 *   stored elevation, correcting any stale upper elevations in one pass.
 * - Idempotent: a floor already at its derived elevation → no write, no audit.
 * - Lower floors (number ≤ changed) are never touched (datum stays put).
 * - ADR-195: each shifted floor gets an EntityAuditService.recordChange entry.
 *
 * All elevations/heights are in METRES (ADR-369 §1). Belt-and-suspenders with the
 * entity cascade ({@link cascadeFloorHeightToEntities}): that re-stretches the
 * changed floor's entities; this re-stacks the floors above.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-450-floor-elevation-cascade-ssot-unify.md §1
 */
export async function cascadeFloorElevations(
  db: Firestore,
  buildingId: string,
  changedFloorId: string,
  companyId: string,
  updatedBy: string,
): Promise<ElevationCascadeResult> {
  const snap = await db.collection(COLLECTIONS.FLOORS)
    .where('companyId', '==', companyId)
    .where(FIELDS.BUILDING_ID, '==', buildingId)
    .get();

  const refById = new Map(snap.docs.map((d) => [d.id, d.ref] as const));
  const nameById = new Map(
    snap.docs.map((d) => [d.id, (d.data().name as string) ?? d.id] as const),
  );
  const rows: FloorRow[] = snap.docs
    .map((d) => ({
      id: d.id,
      number: finite(d.data().number, 0),
      elevation: finiteOrNull(d.data().elevation),
      height: finite(d.data().height, DEFAULT_FLOOR_HEIGHT_M),
    }))
    .sort((a, b) => a.number - b.number);

  const changedIdx = rows.findIndex((r) => r.id === changedFloorId);
  if (changedIdx < 0 || changedIdx === rows.length - 1) {
    return { floorsUpdated: 0, skipped: 0 };
  }

  const shifts: ShiftEntry[] = [];
  let skipped = 0;
  // Walk strictly upward: each upper floor's FFL = floor-below FFL + floor-below height.
  for (let i = changedIdx; i < rows.length - 1; i++) {
    const below = rows[i];
    const upper = rows[i + 1];
    if (below.elevation === null) { skipped++; continue; }
    const derived = below.elevation + below.height;
    if (upper.elevation !== null && Math.abs(upper.elevation - derived) <= ELEVATION_EPSILON_M) {
      skipped++;
      upper.elevation = derived; // anchor the chain on the (already-correct) value
      continue;
    }
    shifts.push({ id: upper.id, name: nameById.get(upper.id) ?? upper.id, oldValue: upper.elevation, newValue: derived });
    upper.elevation = derived; // propagate to the next iteration
  }

  if (shifts.length > 0) {
    const batch = db.batch();
    const updatedAt = FieldValue.serverTimestamp();
    for (const s of shifts) {
      const ref = refById.get(s.id);
      if (ref) batch.update(ref, { elevation: s.newValue, updatedBy, updatedAt });
    }
    await batch.commit();
    await recordCascadeAudit(shifts, companyId, updatedBy);
  }

  const result: ElevationCascadeResult = { floorsUpdated: shifts.length, skipped };
  logger.info('[FloorElevationCascade] Complete', { buildingId, changedFloorId, ...result });
  return result;
}

async function recordCascadeAudit(
  shifts: readonly ShiftEntry[],
  companyId: string,
  performedBy: string,
): Promise<void> {
  await Promise.all(
    shifts.map((s) => {
      const change: AuditFieldChange = {
        field: 'elevation',
        oldValue: s.oldValue,
        newValue: s.newValue,
        label: 'elevation',
      };
      return EntityAuditService.recordChange({
        entityType: ENTITY_TYPES.FLOOR,
        entityId: s.id,
        entityName: s.name,
        action: 'updated',
        changes: [change],
        performedBy,
        performedByName: null,
        companyId,
      });
    }),
  );
}
