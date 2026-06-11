/**
 * ADR-441 Slice 3-perf — Live follow-ghost footprints (pure).
 *
 * Κατά το guide-drag, οι hosted πεδιλοδοκοί πρέπει να ακολουθούν τον οδηγό
 * **frame-for-frame** σε αποκλειστικό overlay canvas (zero-lag), ΟΧΙ μέσω του
 * laggy React `setLevelScene` path. Αυτό το pure βήμα δίνει, για τα τρέχοντα guide
 * offsets, τα **footprints** προς ζωγράφισμα — re-deriving μέσω του ΥΠΑΡΧΟΝΤΟΣ SSoT
 * `reconcileHostedFoundations` (params+geometry από offsets), χωρίς scene mutation.
 *
 * Επιστρέφει ΜΟΝΟ όσους strips όντως μετακινήθηκαν (ο reconciler κάνει only-changed
 * diff) → ο dragged οδηγός επηρεάζει μόνο τους bound σε αυτόν, μηδέν περιττό draw.
 *
 * @see ./guide-hosting-reconciler.ts — reconcileHostedFoundations (SSoT)
 * @see ../../components/dxf-layout/GuideFollowGhostOverlay.tsx — overlay consumer
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { FoundationEntity } from '../types/foundation-types';
import { reconcileHostedFoundations } from './guide-hosting-reconciler';
import type { GuideOffsetLookup } from './derive-params-from-guides';

/** Ένα footprint (world coords) προς ζωγράφισμα ως live ghost. */
export interface FollowGhostFootprint {
  readonly id: string;
  readonly vertices: ReadonlyArray<{ readonly x: number; readonly y: number }>;
}

/**
 * Live-derived footprints των hosted strips για τα τρέχοντα guide offsets. Pure —
 * διαβάζει τα committed params (που μένουν frozen όσο σύρεται ο οδηγός) και τα
 * re-derives ως προς τα live offsets. Μόνο τα changed επιστρέφονται.
 */
export function deriveFollowGhostFootprints(
  hosted: readonly FoundationEntity[],
  getOffset: GuideOffsetLookup,
): FollowGhostFootprint[] {
  const updates = reconcileHostedFoundations(hosted, getOffset);
  return updates.map((u) => ({
    id: u.id,
    vertices: u.nextGeometry.footprint.vertices.map((v) => ({ x: v.x, y: v.y })),
  }));
}
