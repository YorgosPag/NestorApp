/**
 * ADR-441 Slice 3-perf — Live follow-ghost footprints (pure, Slice GEN generic).
 *
 * Κατά το guide-drag, οι hosted entities πρέπει να ακολουθούν τον οδηγό **frame-for-frame**
 * σε αποκλειστικό overlay canvas (zero-lag), ΟΧΙ μέσω του laggy React `setLevelScene` path.
 * Αυτό το pure βήμα δίνει, για τα τρέχοντα guide offsets, τα **outlines** προς ζωγράφισμα —
 * re-deriving μέσω του ΥΠΑΡΧΟΝΤΟΣ SSoT `reconcileHostedEntities` (params+geometry από
 * offsets), χωρίς scene mutation. Slice GEN: kind-generic outline μέσω `HostingStrategy`
 * (foundation footprint / wall ring / column footprint) αντί hard-coded foundation footprint.
 *
 * Επιστρέφει ΜΟΝΟ όσες entities όντως μετακινήθηκαν (only-changed diff) → ο dragged οδηγός
 * επηρεάζει μόνο τους bound σε αυτόν, μηδέν περιττό draw.
 *
 * @see ./guide-hosting-reconciler.ts — reconcileHostedEntities (SSoT)
 * @see ./hosting-strategy.ts — per-kind outline
 * @see ../../components/dxf-layout/GuideFollowGhostOverlay.tsx — overlay consumer
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { AnySceneEntity } from '../../types/scene';
import { reconcileHostedEntities } from './guide-hosting-reconciler';
import { getHostingStrategy } from './hosting-strategy';
import type { GuideOffsetLookup } from './derive-slots';

/** Ένα outline (world coords) προς ζωγράφισμα ως live ghost. */
export interface FollowGhostFootprint {
  readonly id: string;
  readonly vertices: ReadonlyArray<{ readonly x: number; readonly y: number }>;
}

/**
 * Live-derived outlines των hosted entities για τα τρέχοντα guide offsets. Pure — διαβάζει
 * τα committed params (frozen όσο σύρεται ο οδηγός) και τα re-derives ως προς τα live
 * offsets. Μόνο τα changed επιστρέφονται.
 */
export function deriveFollowGhostFootprints(
  hosted: readonly AnySceneEntity[],
  getOffset: GuideOffsetLookup,
): FollowGhostFootprint[] {
  const out: FollowGhostFootprint[] = [];
  for (const u of reconcileHostedEntities(hosted, getOffset)) {
    const strategy = getHostingStrategy(u.type);
    if (!strategy) continue;
    out.push({ id: u.id, vertices: strategy.outline(u.nextGeometry) });
  }
  return out;
}
