/**
 * =============================================================================
 * 🏢 FLOOR · UNITS COUNTER AGGREGATION
 * =============================================================================
 *
 * Maintains the denormalized `units` counter on every `floors/{floorId}` doc.
 * Revit / Yardi pattern: the floor owns an authoritative count of the units it
 * hosts, kept in sync by the data layer — never hand-maintained by the UI.
 *
 * Trigger: write on `properties/{docId}` (create / update / delete).
 * Strategy: full recompute of the affected building(s) — O(units in building).
 *   - Idempotent: floors are SET to the computed value (including 0), only when
 *     the value actually changed (no redundant writes, no trigger storms).
 *   - Self-healing: every write reconciles the whole building, so any past
 *     drift is corrected on the next mutation.
 *   - Belt-and-suspenders: covers ALL write paths (UI, API, import, backfill).
 *
 * Multi-level units (ADR-236): a unit is counted on EVERY floor it occupies
 * (`levels[].floorId`) — a maisonette adds +1 to each of its floors, exactly
 * as Revit reports an element present on each level.
 *
 * Soft-deleted units (ADR-281) are excluded from the count.
 *
 * @module functions/aggregation/floorUnitsAggregation
 * @see ADR-236 — Multi-Level Property Management
 * @see ADR-281 — SSoT Soft-Delete System
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

import { COLLECTIONS } from '../config/firestore-collections';

const TRIGGER_RUNTIME = {
  timeoutSeconds: 120,
  memory: '256MB' as const,
};

interface PropertyLevelLike {
  floorId?: unknown;
}

/** Floor IDs a unit occupies: all `levels[].floorId` (multi-level) + `floorId`. */
function getFloorIdsForProperty(
  data: FirebaseFirestore.DocumentData | undefined,
): string[] {
  if (!data) return [];
  const ids = new Set<string>();

  if (data.isMultiLevel === true && Array.isArray(data.levels)) {
    for (const level of data.levels as PropertyLevelLike[]) {
      if (level && typeof level.floorId === 'string' && level.floorId) {
        ids.add(level.floorId);
      }
    }
  }
  if (typeof data.floorId === 'string' && data.floorId) {
    ids.add(data.floorId);
  }
  return Array.from(ids);
}

/** Exclude soft-deleted units from the counter (ADR-281). */
function isCountableProperty(
  data: FirebaseFirestore.DocumentData | undefined,
): boolean {
  if (!data) return false;
  if (data.isDeleted === true || data.deletedAt || data.status === 'deleted') {
    return false;
  }
  return true;
}

/** Recompute and reconcile `units` for every floor of a single building. */
async function recomputeBuildingFloorUnits(
  db: FirebaseFirestore.Firestore,
  buildingId: string,
): Promise<void> {
  const propsSnap = await db
    .collection(COLLECTIONS.PROPERTIES)
    .where('buildingId', '==', buildingId)
    .get();

  const counts = new Map<string, number>();
  for (const doc of propsSnap.docs) {
    const data = doc.data();
    if (!isCountableProperty(data)) continue;
    for (const floorId of getFloorIdsForProperty(data)) {
      counts.set(floorId, (counts.get(floorId) ?? 0) + 1);
    }
  }

  const floorsSnap = await db
    .collection(COLLECTIONS.FLOORS)
    .where('buildingId', '==', buildingId)
    .get();

  const batch = db.batch();
  let writes = 0;
  for (const floorDoc of floorsSnap.docs) {
    const desired = counts.get(floorDoc.id) ?? 0;
    if (floorDoc.data().units !== desired) {
      batch.update(floorDoc.ref, { units: desired });
      writes++;
    }
  }
  if (writes > 0) {
    await batch.commit();
    functions.logger.info('[FloorUnits] Reconciled building floor counts', {
      buildingId,
      floorsUpdated: writes,
    });
  }
}

/**
 * Firestore trigger: keep `floors.units` in sync on every property write.
 * Reconciles both the previous and the new building (handles unit moves).
 */
export const onPropertyWriteFloorUnits = functions
  .runWith(TRIGGER_RUNTIME)
  .firestore.document(`${COLLECTIONS.PROPERTIES}/{docId}`)
  .onWrite(async (change) => {
    const db = admin.firestore();

    const before = change.before.exists ? change.before.data() : undefined;
    const after = change.after.exists ? change.after.data() : undefined;

    const buildingIds = new Set<string>();
    if (typeof before?.buildingId === 'string' && before.buildingId) {
      buildingIds.add(before.buildingId);
    }
    if (typeof after?.buildingId === 'string' && after.buildingId) {
      buildingIds.add(after.buildingId);
    }

    for (const buildingId of buildingIds) {
      try {
        await recomputeBuildingFloorUnits(db, buildingId);
      } catch (error) {
        functions.logger.error('[FloorUnits] Recompute failed', {
          buildingId,
          error,
        });
      }
    }
  });
