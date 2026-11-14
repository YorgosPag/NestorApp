/**
 * ADR-941 Φ2β — η γεωμετρία της εισαγωγής ως **ευθύγραμμα τμήματα** σε px της σελίδας, με χωρικό ευρετήριο και τα δύο
 * ερωτήματα που χρειάζεται η αναγνώριση γραφικών διάστασης: «πόσο **καλύπτουν** τα τμήματα μια ευθεία;» και «βρίσκεται ένα
 * τμήμα **ολόκληρο** πάνω σε μια ευθεία;». Καθαρό.
 *
 * 🔑 Ο ΕΝΑΣ τόπος των πράξεων διανυσμάτων σε `PxPoint` για την εισαγωγή (το δέσιμο Φ2α τις παίρνει από εδώ).
 * 🔑 Τμήμα = ζεύγος διαδοχικών κορυφών μιας πολυγραμμής (και η κλείνουσα, όταν είναι κλειστή)· κρατά τον δείκτη της
 *   πολυγραμμής, γιατί η απορρόφηση γίνεται **μόνο** σε ολόκληρες πολυγραμμές (Δ19).
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-segments
 */

import type { PdfVectorPolyline, PxPoint } from '../../pdf-background/services/pdf-vector-content';

export const sub = (a: PxPoint, b: PxPoint): PxPoint => [a[0] - b[0], a[1] - b[1]];
export const add = (a: PxPoint, v: PxPoint, t = 1): PxPoint => [a[0] + v[0] * t, a[1] + v[1] * t];
export const cross = (a: PxPoint, b: PxPoint): number => a[0] * b[1] - a[1] * b[0];
export const dot = (a: PxPoint, b: PxPoint): number => a[0] * b[0] + a[1] * b[1];
export const length = (a: PxPoint): number => Math.hypot(a[0], a[1]);
export const distance = (a: PxPoint, b: PxPoint): number => length(sub(a, b));
export const negate = (a: PxPoint): PxPoint => [-a[0], -a[1]];
export const midpoint = (a: PxPoint, b: PxPoint): PxPoint => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Το μοναδιαίο του `a`, ή `null` για μηδενικό διάνυσμα. */
export function unit(a: PxPoint): PxPoint | null {
  const l = length(a);
  return l > 0 ? [a[0] / l, a[1] / l] : null;
}

/** Ένα ευθύγραμμο τμήμα της εισαγωγής. `id` = θέση στη λίστα των τμημάτων. */
export interface PdfSegment {
  readonly id: number;
  readonly polylineIndex: number;
  /** Ο δείκτης της κορυφής αρχής μέσα στην πολυγραμμή (η κλείνουσα ακμή ξεκινά από την τελευταία). */
  readonly from: number;
  readonly to: number;
  readonly a: PxPoint;
  readonly b: PxPoint;
  readonly length: number;
}

/** Όλα τα μη μηδενικά τμήματα όλων των πολυγραμμών, με σταθερή σειρά. */
export function polylineSegments(polylines: readonly PdfVectorPolyline[]): PdfSegment[] {
  const out: PdfSegment[] = [];
  polylines.forEach((polyline, polylineIndex) => {
    const n = polyline.points.length;
    const pairs: [number, number][] = [];
    for (let i = 0; i + 1 < n; i++) pairs.push([i, i + 1]);
    if (polyline.closed && n > 2) pairs.push([n - 1, 0]);
    for (const [from, to] of pairs) {
      const a = polyline.points[from];
      const b = polyline.points[to];
      const l = distance(a, b);
      if (l > 0) out.push({ id: out.length, polylineIndex, from, to, a, b, length: l });
    }
  });
  return out;
}

/** Κάθετη (προσημασμένη) απόσταση του `p` από την ευθεία `(origin, dir)` με μοναδιαίο `dir`. */
export const offsetFrom = (p: PxPoint, origin: PxPoint, dir: PxPoint): number => cross(dir, sub(p, origin));
/** Η παράμετρος του `p` κατά μήκος της ευθείας `(origin, dir)`. */
export const alongOf = (p: PxPoint, origin: PxPoint, dir: PxPoint): number => dot(sub(p, origin), dir);

/** Βρίσκεται το τμήμα ολόκληρο πάνω στην ευθεία `(origin, dir)`, σε ανοχή `tol`; */
export const isOnLine = (s: PdfSegment, origin: PxPoint, dir: PxPoint, tol: number): boolean =>
  Math.abs(offsetFrom(s.a, origin, dir)) <= tol && Math.abs(offsetFrom(s.b, origin, dir)) <= tol;

/** Βρίσκεται το τμήμα ολόκληρο πάνω στο τμήμα `p → q` (ευθεία **και** έκταση), σε ανοχή `tol`; */
export function liesWithin(s: PdfSegment, p: PxPoint, q: PxPoint, tol: number): boolean {
  const dir = unit(sub(q, p));
  if (!dir) return false;
  const span = distance(p, q);
  const inside = (x: PxPoint): boolean => {
    const t = alongOf(x, p, dir);
    return t >= -tol && t <= span + tol;
  };
  return isOnLine(s, p, dir, tol) && inside(s.a) && inside(s.b);
}

/** Το διάστημα `[t0, t1]` του τμήματος κατά μήκος της ευθείας `(origin, dir)`. */
export function intervalOn(s: PdfSegment, origin: PxPoint, dir: PxPoint): [number, number] {
  const ta = alongOf(s.a, origin, dir);
  const tb = alongOf(s.b, origin, dir);
  return ta <= tb ? [ta, tb] : [tb, ta];
}

/** Τι κλάσμα του `p → q` καλύπτουν τα τμήματα που κάθονται πάνω στην ευθεία του (ένωση διαστημάτων). */
export function coverageOf(p: PxPoint, q: PxPoint, segments: readonly PdfSegment[], tol: number): number {
  const dir = unit(sub(q, p));
  const span = distance(p, q);
  if (!dir) return 0;
  const intervals = segments
    .filter((s) => isOnLine(s, p, dir, tol))
    .map((s) => intervalOn(s, p, dir))
    .map(([t0, t1]): [number, number] => [Math.max(0, t0), Math.min(span, t1)])
    .filter(([t0, t1]) => t1 > t0)
    .sort((x, y) => x[0] - y[0]);
  let covered = 0;
  let reach = 0;
  for (const [t0, t1] of intervals) {
    const start = Math.max(t0, reach);
    if (t1 > start) covered += t1 - start;
    reach = Math.max(reach, t1);
  }
  return covered / span;
}

/** Χωρικό ευρετήριο τμημάτων (ομοιόμορφο πλέγμα): τα τμήματα που **ίσως** περνούν σε απόσταση `r` από ένα σημείο. */
export interface SegmentGrid {
  near(p: PxPoint, r: number): PdfSegment[];
}

/** Απόσταση σημείου από τμήμα. */
export function distanceToSegment(p: PxPoint, s: PdfSegment): number {
  const v = sub(s.b, s.a);
  const t = Math.max(0, Math.min(1, dot(sub(p, s.a), v) / dot(v, v)));
  return distance(p, add(s.a, v, t));
}

export function segmentGrid(segments: readonly PdfSegment[], cellPx: number): SegmentGrid {
  const cell = cellPx > 0 ? cellPx : 1;
  const cells = new Map<string, PdfSegment[]>();
  const key = (i: number, j: number): string => `${i}:${j}`;
  for (const s of segments) {
    const [i0, i1] = [Math.floor(Math.min(s.a[0], s.b[0]) / cell), Math.floor(Math.max(s.a[0], s.b[0]) / cell)];
    const [j0, j1] = [Math.floor(Math.min(s.a[1], s.b[1]) / cell), Math.floor(Math.max(s.a[1], s.b[1]) / cell)];
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const list = cells.get(key(i, j));
      if (list) list.push(s); else cells.set(key(i, j), [s]);
    }
  }
  return {
    near(p, r) {
      const seen = new Set<number>();
      const out: PdfSegment[] = [];
      const [i0, i1] = [Math.floor((p[0] - r) / cell), Math.floor((p[0] + r) / cell)];
      const [j0, j1] = [Math.floor((p[1] - r) / cell), Math.floor((p[1] + r) / cell)];
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        for (const s of cells.get(key(i, j)) ?? []) {
          if (!seen.has(s.id) && distanceToSegment(p, s) <= r) { seen.add(s.id); out.push(s); }
        }
      }
      return out;
    },
  };
}
