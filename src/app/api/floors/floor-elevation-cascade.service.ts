import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { openDeclaredBatch } from '@/lib/admin-batch-utils';
import { ENTITY_TYPES, SYSTEM_IDENTITY } from '@/config/domain-constants';
import { derivedChange, recordDerivedWrites, type FloorCascadeActor } from './_shared/floor-cascade-audit';
import { isSpecialLevel, readFloorStack, type FloorStackRow } from './_shared/floor-stack-rows';

const logger = createModuleLogger('FloorElevationCascade');

/** Metres — floor elevations are compared with this tolerance (sub-millimetre). */
const ELEVATION_EPSILON_M = 1e-4;

export interface ElevationCascadeResult {
  /** How many upper floors had their elevation shifted. */
  readonly floorsUpdated: number;
  /** Floors walked but already at the derived elevation (idempotent no-op). */
  readonly skipped: number;
}

/** The stack row, with a WRITABLE elevation: the walk upward propagates each derived value. */
type FloorRow = Omit<FloorStackRow, 'elevation'> & { elevation: number | null };

interface ShiftEntry {
  readonly id: string;
  readonly name: string;
  readonly oldValue: number | null;
  readonly newValue: number;
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
 * - ADR-195: each shifted floor gets its own audit entry — performed by the machine
 *   (`system:floor-stack`), caused by the human edit (`actor.cause`).
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
  actor: FloorCascadeActor,
): Promise<ElevationCascadeResult> {
  const { updatedBy } = actor;
  const stack = await readFloorStack(db, buildingId, companyId);
  const { refById } = stack;
  const rows: FloorRow[] = stack.rows.map((row) => ({ ...row }));

  const changedIdx = rows.findIndex((r) => r.id === changedFloorId);
  if (changedIdx < 0) {
    return { floorsUpdated: 0, skipped: 0 };
  }

  // ADR-461 — a below-grade special level (foundation) is a SATELLITE that hangs
  // under the lowest counted storey: its elevation = lowestCounted.elevation −
  // depth (its height). Editing its depth must DEEPEN it, never lift the building.
  // Re-anchor it downward and stop — the counted backbone never moves.
  const changedRow = rows[changedIdx];
  const lowestCounted = rows.find((r) => !isSpecialLevel(r)) ?? null;
  if (isSpecialLevel(changedRow) && lowestCounted && changedRow.number < lowestCounted.number) {
    if (lowestCounted.elevation === null) return { floorsUpdated: 0, skipped: 1 };
    const derived = lowestCounted.elevation - changedRow.height;
    if (changedRow.elevation !== null && Math.abs(changedRow.elevation - derived) <= ELEVATION_EPSILON_M) {
      return { floorsUpdated: 0, skipped: 1 };
    }
    const ref = refById.get(changedRow.id);
    if (ref) {
      // Δηλωμένη παρτίδα: οι αναφορές έρχονται από το `readFloorStack` (άλλο αρχείο), άρα η συλλογή δηλώνεται ΕΔΩ —
      // από εδώ η CHECK 3.17 βλέπει αυτό το αρχείο ως γραφέα ορόφων, και η παρτίδα αρνείται ό,τι δεν είναι όροφος.
      const batch = openDeclaredBatch(db, [COLLECTIONS.FLOORS]);
      batch.update(ref, { elevation: derived, updatedBy, updatedAt: FieldValue.serverTimestamp() });
      await batch.commit();
      await recordCascadeAudit(
        [{ id: changedRow.id, name: changedRow.name, oldValue: changedRow.elevation, newValue: derived }],
        companyId,
        actor,
      );
    }
    logger.info('[FloorElevationCascade] Re-anchored below-grade special', { buildingId, changedFloorId });
    return { floorsUpdated: 1, skipped: 0 };
  }

  if (changedIdx === rows.length - 1) {
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
    shifts.push({ id: upper.id, name: upper.name, oldValue: upper.elevation, newValue: derived });
    upper.elevation = derived; // propagate to the next iteration
  }

  if (shifts.length > 0) {
    const batch = openDeclaredBatch(db, [COLLECTIONS.FLOORS]);
    const updatedAt = FieldValue.serverTimestamp();
    for (const s of shifts) {
      const ref = refById.get(s.id);
      if (ref) batch.update(ref, { elevation: s.newValue, updatedBy, updatedAt });
    }
    await batch.commit();
    await recordCascadeAudit(shifts, companyId, actor);
  }

  const result: ElevationCascadeResult = { floorsUpdated: shifts.length, skipped };
  logger.info('[FloorElevationCascade] Complete', { buildingId, changedFloorId, ...result });
  return result;
}

async function recordCascadeAudit(
  shifts: readonly ShiftEntry[],
  companyId: string,
  actor: FloorCascadeActor,
): Promise<void> {
  await recordDerivedWrites(
    SYSTEM_IDENTITY.FLOOR_STACK_ID,
    shifts.map((s) => ({
      entityType: ENTITY_TYPES.FLOOR,
      entityId: s.id,
      entityName: s.name,
      changes: [derivedChange('elevation', s.oldValue, s.newValue)],
    })),
    actor,
    companyId,
  );
}
