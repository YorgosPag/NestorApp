/**
 * ADR-929 Φ5.4 — τα τμήματα της Φ2 στο **ευθυγραμμισμένο** πλαίσιο, εκεί όπου ζει η μάσκα μελανιού: άκρα, μοναδιαίο
 * διάνυσμα, κάθετο, μήκος, πάχος. Η ταξινόμηση ρόλων ρωτά μόνο αυτή τη γεωμετρία· η επιστροφή στα αρχικά px δεν
 * χρειάζεται, γιατί ο ρόλος δεν έχει συντεταγμένες.
 *
 * Το πάχος μεταφέρεται με την **τοπική** κλίμακα της ομογραφίας στο μέσο του τμήματος (ίδια σημασιολογία με το
 * `fusion-frame.ts`): σωστό και με προοπτική.
 *
 * @module subapps/dxf-viewer/bim/plan-recognition/classify/segment-frame
 */

import { applyHomography, homographyLocalScale, type Homography, type PlanePoint } from '@/lib/geometry/homography';
import type { RasterSegment } from '../plan-recognition-types';

export interface FramedSegment {
  readonly id: string;
  readonly a: PlanePoint;
  readonly b: PlanePoint;
  /** Μοναδιαίο από `a` προς `b`. */
  readonly u: PlanePoint;
  /** Μοναδιαίο κάθετο (`u` στραμμένο +90°). */
  readonly n: PlanePoint;
  readonly length: number;
  /** Πάχος πινελιάς σε ευθυγραμμισμένα px. */
  readonly width: number;
  readonly style: RasterSegment['style'];
}

/** Θέση σημείου ως προς τμήμα: `t` κατά μήκος από το `a`, `d` προσημασμένη κάθετη απόσταση. */
export interface SegmentLocal {
  readonly t: number;
  readonly d: number;
}

export function framedSegments(segments: readonly RasterSegment[], originalToAligned: Homography): FramedSegment[] {
  return segments.map((s) => {
    const a = applyHomography(originalToAligned, s.start.x, s.start.y);
    const b = applyHomography(originalToAligned, s.end.x, s.end.y);
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const u = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const scale = homographyLocalScale(originalToAligned, (s.start.x + s.end.x) / 2, (s.start.y + s.end.y) / 2) ?? 1;
    return { id: s.id, a, b, u, n: { x: -u.y, y: u.x }, length, width: s.strokeWidthPx * scale, style: s.style };
  });
}

export function localOf(s: FramedSegment, p: PlanePoint): SegmentLocal {
  const rx = p.x - s.a.x;
  const ry = p.y - s.a.y;
  return { t: rx * s.u.x + ry * s.u.y, d: rx * s.n.x + ry * s.n.y };
}

/** `|sin|` της γωνίας ανάμεσα σε δύο τμήματα: 0 = παράλληλα, 1 = κάθετα. */
export const sinBetween = (p: FramedSegment, q: FramedSegment): number => Math.abs(p.u.x * q.u.y - p.u.y * q.u.x);

/** Το άκρο `which` και το μοναδιαίο διάνυσμα που δείχνει **έξω** από το τμήμα. */
export function endOf(s: FramedSegment, which: 'start' | 'end'): { readonly p: PlanePoint; readonly out: PlanePoint } {
  return which === 'start' ? { p: s.a, out: { x: -s.u.x, y: -s.u.y } } : { p: s.b, out: s.u };
}

/**
 * Συγγραμμικά: παράλληλα (`sin ≤ maxSin`) και τα άκρα του `q` απέχουν ≤ `tolPx` από την ευθεία του `p`. Επιστρέφει το
 * κενό ανάμεσά τους κατά μήκος της ευθείας του `p` (αρνητικό ⇒ επικαλύπτονται) και τη φορά (`q` μετά ή πριν το `p`).
 */
export function collinearGap(
  p: FramedSegment, q: FramedSegment, tolPx: number, maxSin: number,
): { readonly gap: number; readonly qAfter: boolean } | null {
  if (sinBetween(p, q) > maxSin) return null;
  const qa = localOf(p, q.a);
  const qb = localOf(p, q.b);
  if (Math.abs(qa.d) > tolPx || Math.abs(qb.d) > tolPx) return null;
  const lo = Math.min(qa.t, qb.t);
  const hi = Math.max(qa.t, qb.t);
  return lo >= p.length / 2 ? { gap: lo - p.length, qAfter: true } : { gap: -hi, qAfter: false };
}
