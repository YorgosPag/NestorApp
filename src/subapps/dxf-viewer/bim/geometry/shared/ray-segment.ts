/**
 * Ακτίνα πάνω σε τμήμα και πάνω σε δακτυλίους — pure SSoT (N.0.2).
 *
 * Η `rayHitsSegment` ζούσε ιδιωτικά στο `walls/wall-region-autojoin.ts`. Απέκτησε δεύτερο
 * καταναλωτή (ADR-911 Φ4-1: οι λαμπάδες μιας πόρτας βρίσκονται με ακτίνα από τον μεντεσέ ως το
 * πρώτο σώμα), άρα μετακόμισε εδώ αντί να αντιγραφεί.
 */

import type { Point2D } from '../../../rendering/types/Types';

/** Ανοχή της παραμέτρου πάνω στο τμήμα (`s ∈ [0,1]` ± αυτό). */
const SEGMENT_PARAM_SLACK = 1e-6;
/** Κάτω από αυτή την ορίζουσα η ακτίνα και το τμήμα θεωρούνται παράλληλα. */
const PARALLEL_DET_EPS = 1e-9;

export interface RaySegmentHit {
  /** Απόσταση πάνω στη ΜΟΝΑΔΙΑΙΑ ακτίνα (αρνητική = πίσω από την αρχή). */
  readonly dist: number;
  /** Η τομή πέφτει μέσα στο τμήμα. */
  readonly within: boolean;
}

/**
 * Distance along the unit ray (o + t·û) at which it crosses segment [a,b], plus
 * whether the crossing lies within the segment. `null` when parallel.
 * Solves o + t·û = a + s·(b−a) for (t, s); `within` ⇔ s ∈ [0,1] (± slack).
 */
export function rayHitsSegment(
  ox: number, oy: number,
  ux: number, uy: number,
  ax: number, ay: number,
  bx: number, by: number,
): RaySegmentHit | null {
  const sx = bx - ax, sy = by - ay;
  const det = sx * uy - ux * sy;
  if (Math.abs(det) < PARALLEL_DET_EPS) return null;
  const wx = ax - ox, wy = ay - oy;
  const dist = (-wx * sy + sx * wy) / det; // t along the ray (û is unit → distance)
  const s = (ux * wy - uy * wx) / det;     // param along a→b
  return { dist, within: s >= -SEGMENT_PARAM_SLACK && s <= 1 + SEGMENT_PARAM_SLACK };
}

export interface RayRingHit {
  readonly dist: number;
  /** Θέση του δακτυλίου στον πίνακα που δόθηκε. */
  readonly ringIndex: number;
}

/**
 * Το ΠΡΩΤΟ σύνορο δακτυλίου που συναντά η μοναδιαία ακτίνα, ως `maxDist`. `null` = τίποτα.
 * Δεν ρωτά αν η αρχή βρίσκεται ήδη ΜΕΣΑ σε δακτύλιο — αυτό είναι άλλη ερώτηση, του καλούντος.
 */
export function nearestRayHitOnRings(
  origin: Point2D,
  dir: Point2D,
  rings: readonly (readonly Point2D[])[],
  maxDist: number,
): RayRingHit | null {
  let best: RayRingHit | null = null;
  rings.forEach((ring, ringIndex) => {
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      const hit = rayHitsSegment(origin.x, origin.y, dir.x, dir.y, a.x, a.y, b.x, b.y);
      if (!hit || !hit.within || hit.dist < 0 || hit.dist > maxDist) continue;
      if (!best || hit.dist < best.dist) best = { dist: hit.dist, ringIndex };
    }
  });
  return best;
}
