/**
 * ADR-358 Phase 9B — Stair ↔ Floor height sync helpers.
 *
 * Cross-domain service (Buildings tab consumer, Stair domain owner).
 * Provides:
 *   - One-time read: count linked vs custom stairs for a given floor.
 *   - Batch write: propagate a floor height change to all linked stairs.
 *
 * Tenant isolation: `companyId` constraint on every Firestore query (CHECK 3.10).
 * Writes use `serverTimestamp()` for `updatedAt` audit field.
 *
 * @see ADR-358 §9B (Plan B — Buildings page warning)
 */

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { UpdateData } from 'firebase/firestore';

import { db } from '@/lib/firebase';
import { COLLECTIONS } from '@/config/firestore-collections';
import type { StairDoc } from '../../bim/types/stair-types';
import { reconcileLinkedStair } from './stair-floor-link';

// ============================================================================
// TYPES
// ============================================================================

export interface LinkedStairsInfo {
  /** Stairs with `params.multiStoryConfig.linkedToFloor === true`. */
  readonly linked: readonly StairDoc[];
  /** Stairs that have multiStoryConfig but are NOT linked (manual override). */
  readonly custom: readonly StairDoc[];
  /** All stairs assigned to this floor (for display in Buildings floors tab). */
  readonly all: readonly StairDoc[];
}

// ============================================================================
// READ
// ============================================================================

/**
 * One-time Firestore read: fetch all stairs assigned to `floorId` and
 * partition them into linked / custom buckets.
 *
 * Requires `companyId` for tenant isolation (CHECK 3.10).
 */
export async function queryStairsByFloorId(
  floorId: string,
  companyId: string,
): Promise<LinkedStairsInfo> {
  const q = query(
    collection(db, COLLECTIONS.FLOORPLAN_STAIRS),
    where('companyId', '==', companyId),
    where('floorId', '==', floorId),
  );
  const snap = await getDocs(q);
  const docs = snap.docs.map((d) => d.data() as StairDoc);
  return {
    linked: docs.filter((s) => s.params.multiStoryConfig?.linkedToFloor === true),
    custom: docs.filter(
      (s) =>
        s.params.multiStoryConfig !== undefined &&
        s.params.multiStoryConfig.linkedToFloor !== true,
    ),
    all: docs,
  };
}

// ============================================================================
// WRITE
// ============================================================================

/**
 * Batch-update `storyHeight` on all linked stairs. Preserves every other
 * field in `params` and `multiStoryConfig` via spread (no partial-path writes
 * to avoid readonly-type conflicts). Stamps `updatedBy` + `updatedAt`.
 *
 * No-op when `stairs` is empty.
 */
export async function batchUpdateLinkedStairsHeight(
  stairs: readonly StairDoc[],
  newHeightMm: number,
  updatedBy: string,
): Promise<void> {
  if (stairs.length === 0) return;
  const batch = writeBatch(db);
  for (const stair of stairs) {
    const ref = doc(db, COLLECTIONS.FLOORPLAN_STAIRS, stair.id);
    const withNewHeight = {
      ...stair.params,
      multiStoryConfig: {
        ...stair.params.multiStoryConfig!,
        storyHeight: newHeightMm,
      },
    };
    // Recompute stepCount/totalRise/totalRun/pitch from the new storyHeight.
    const reconciledParams = reconcileLinkedStair(withNewHeight);
    batch.update(ref, {
      params: reconciledParams,
      updatedBy,
      updatedAt: serverTimestamp(),
    } as UpdateData<StairDoc>);
  }
  await batch.commit();
}
