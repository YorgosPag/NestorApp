/**
 * ADR-911 Φ4-1 — τα σύμβολα παραθύρου ζουν ΜΕΣΑ στο σώμα συνεχών τοίχων.
 *
 * Μετρημένο στο σχέδιο δοκιμής: κανένα παράθυρο δεν βρίσκεται σε ομοαξονικό κενό· 162 από τις 232
 * γραμμές κουφωμάτων έχουν το μέσο τους μέσα σε σώμα τοίχου. Άρα ο ξενιστής είναι δεδομένος (ο
 * τοίχος που περιέχει τις γραμμές) και το πλάτος είναι η έκταση της συστάδας πάνω στον άξονά του.
 *
 * Κανόνας αντίστοιχος της Α-8: μία συστάδα σε έναν τοίχο ⇒ το πολύ ένα παράθυρο. Ο αναγνωριστής
 * του ADR-533 δεν χρησιμοποιείται εδώ: μετρήθηκε ότι δίνει τρία κομμάτια ανά παράθυρο
 * (483 + 483 + 1307,6 mm για παράθυρο 1400) — απαντά σε άλλη ερώτηση (σύμβολο πάνω σε ΕΝΑΝ
 * επιλεγμένο τοίχο), και οι ανοχές του δεν αγγίζονται.
 */

import type { Point2D } from '../../rendering/types/Types';
import { MODEL_FROM_DRAWING_LIMITS as LIMITS } from '../../config/tolerance-config';
import { calculateMidpoint } from '../../rendering/entities/shared/geometry-vector-utils';
import { frameCoords, isInsideFrameBand, type WallHostFrame } from './wall-host-frame';

export interface WindowSymbolLine {
  readonly id: string;
  readonly start: Point2D;
  readonly end: Point2D;
}

export interface WindowCluster {
  readonly wallId: string;
  /** Έκταση πάνω στον άξονα του τοίχου, από την αρχή του (μονάδες σκηνής). */
  readonly lo: number;
  readonly hi: number;
  readonly sourceIds: readonly string[];
}

interface Interval { readonly lo: number; readonly hi: number; readonly id: string }

/** Ο τοίχος που περιέχει ΟΛΟΚΛΗΡΗ τη γραμμή· ανάμεσα σε περισσότερους, ο πιο κεντρικός. */
function hostFrameOf(line: WindowSymbolLine, frames: readonly WallHostFrame[], tol: number): WallHostFrame | null {
  const mid = calculateMidpoint(line.start, line.end);
  let best: WallHostFrame | null = null;
  let bestScore = Infinity;
  for (const frame of frames) {
    if (!isInsideFrameBand(frame, line.start, tol) || !isInsideFrameBand(frame, line.end, tol)) continue;
    const score = Math.abs(frameCoords(frame, mid).across) / Math.max(frame.halfThickness, tol);
    if (score < bestScore) { best = frame; bestScore = score; }
  }
  return best;
}

function mergeIntervals(wallId: string, intervals: readonly Interval[], join: number): WindowCluster[] {
  const sorted = [...intervals].sort((a, b) => a.lo - b.lo || a.id.localeCompare(b.id));
  const clusters: { lo: number; hi: number; ids: string[] }[] = [];
  for (const it of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && it.lo <= last.hi + join) {
      last.hi = Math.max(last.hi, it.hi);
      last.ids.push(it.id);
    } else {
      clusters.push({ lo: it.lo, hi: it.hi, ids: [it.id] });
    }
  }
  return clusters.map((c) => ({ wallId, lo: c.lo, hi: c.hi, sourceIds: c.ids }));
}

/** Οι συστάδες γραμμών κουφώματος ανά τοίχο. Σειρά: όπως δόθηκαν οι τοίχοι, μετά κατά μήκος. */
export function clusterWindowSymbols(
  lines: readonly WindowSymbolLine[], frames: readonly WallHostFrame[], scale: number,
): WindowCluster[] {
  const tol = LIMITS.NODE_MERGE_TOLERANCE_MM * scale;
  const byWall = new Map<string, Interval[]>();
  for (const line of lines) {
    const frame = hostFrameOf(line, frames, tol);
    if (!frame) continue;
    const a = frameCoords(frame, line.start).along;
    const b = frameCoords(frame, line.end).along;
    const bucket = byWall.get(frame.id) ?? [];
    bucket.push({ lo: Math.min(a, b), hi: Math.max(a, b), id: line.id });
    byWall.set(frame.id, bucket);
  }
  const join = LIMITS.WINDOW_CLUSTER_JOIN_MM * scale;
  return frames.flatMap((frame) => mergeIntervals(frame.id, byWall.get(frame.id) ?? [], join));
}
