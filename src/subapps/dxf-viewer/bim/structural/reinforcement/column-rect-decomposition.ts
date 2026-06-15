/**
 * Column section → **επικαλυπτόμενα ορθογώνια σκέλη** (ADR-460 — follow-up 6,
 * overlapping rectangular hoops).
 *
 * Διασπά το rectilinear section outline (Γ/Τ/Π/Ι/composite-ορθογώνιο) σε ένα σύνολο
 * **μεγιστικών αξονικών ορθογωνίων** που **επικαλύπτονται** στις ζώνες συμβολής — η
 * γεωμετρική βάση της σωστής μεθόδου όπλισης (ένας κλειστός ορθογώνιος συνδετήρας ανά
 * σκέλος, Revit/Tekla). Καθαρά geometry-driven (δουλεύει πάνω στο ΙΔΙΟ outline με
 * 2Δ/3Δ → μηδέν per-kind παραμετρικός κώδικας, μηδέν mismatch με το footprint).
 *
 * Αλγόριθμος (Y-sweep + κατακόρυφη μεγιστοποίηση):
 *   1. Αν το outline ΔΕΝ είναι rectilinear (υπάρχει λοξή ακμή — π.χ. N-gon polygon,
 *      reshaped composite με διαγώνιο) → `[]` (ο caller πέφτει σε perimeter-from-outline).
 *   2. Y-bands από τις διακριτές y-συντεταγμένες· ανά band, τα **εσωτερικά x-διαστήματα**.
 *   3. Κάθε (band, διάστημα) **μεγιστοποιείται κατακόρυφα**: επεκτείνεται σε γειτονικά
 *      bands όσο το x-διάστημά του παραμένει πλήρως εσωτερικό → maximal ορθογώνιο.
 *      Έτσι ο κορμός ενός Τ διαπερνά το πέλμα (επικάλυψη) — ακριβώς η ζώνη συμβολής.
 *   4. Dedup (όμοια + περιεχόμενα ορθογώνια).
 *
 * LOCAL mm (centroid-centered), ίδιο σύστημα με το rebar layout. Pure.
 *
 * @see ./column-multihoop-layout.ts
 * @see ./column-section-outline.ts
 */

import type { Point2D } from '../../../rendering/types/Types';
import { pointInPolygon } from '../../geometry/shared/polygon-utils';

/** Άξονικό ορθογώνιο σκέλος σε LOCAL mm: κέντρο + διαστάσεις (X=width, Y=depth). */
export interface SectionRectMm {
  readonly cx: number;
  readonly cy: number;
  readonly width: number;
  readonly depth: number;
}

/** Ανοχή «η ακμή είναι αξονική» (mm) — κάτω από αυτό θεωρείται οριζόντια/κατακόρυφη. */
const AXIS_EPS_MM = 1e-6;
/** Ελάχιστη διάσταση έγκυρου ορθογωνίου (mm). */
const MIN_RECT_MM = 1;

/** true αν ΟΛΕΣ οι ακμές του κλειστού πολυγώνου είναι αξονικές (οριζόντιες/κατακόρυφες). */
function isRectilinear(poly: readonly Point2D[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    if (Math.abs(b.x - a.x) > AXIS_EPS_MM && Math.abs(b.y - a.y) > AXIS_EPS_MM) return false;
  }
  return true;
}

/** Διακριτές, ταξινομημένες συντεταγμένες (με ανοχή). */
function distinctSorted(values: readonly number[]): number[] {
  const out: number[] = [];
  for (const v of [...values].sort((a, b) => a - b)) {
    if (out.length === 0 || v - out[out.length - 1] > AXIS_EPS_MM) out.push(v);
  }
  return out;
}

/** Pseudo-3D για το pointInPolygon (που δουλεύει σε XY). */
function toXY(poly: readonly Point2D[]): { x: number; y: number; z: number }[] {
  return poly.map((p) => ({ x: p.x, y: p.y, z: 0 }));
}

/** true αν η κυψέλη [xs[c],xs[c+1]] × [ys[b],ys[b+1]] είναι εσωτερική (έλεγχος κέντρου). */
function cellInside(xs: number[], ys: number[], c: number, b: number, poly3: { x: number; y: number; z: number }[]): boolean {
  const mx = (xs[c] + xs[c + 1]) / 2;
  const my = (ys[b] + ys[b + 1]) / 2;
  return pointInPolygon({ x: mx, y: my }, poly3);
}

/** Συνεχόμενα εσωτερικά x-διαστήματα ενός band ως ζεύγη στηλών [cLo, cHi]. */
function bandIntervals(xs: number[], ys: number[], b: number, poly3: { x: number; y: number; z: number }[]): [number, number][] {
  const intervals: [number, number][] = [];
  let start = -1;
  for (let c = 0; c < xs.length - 1; c++) {
    const inside = cellInside(xs, ys, c, b, poly3);
    if (inside && start < 0) start = c;
    if ((!inside || c === xs.length - 2) && start >= 0) {
      intervals.push([start, inside ? c : c - 1]);
      start = -1;
    }
  }
  return intervals;
}

/** true αν, στο band `b`, ΟΛΕΣ οι στήλες [cLo,cHi] είναι εσωτερικές. */
function bandCoversCols(xs: number[], ys: number[], b: number, cLo: number, cHi: number, poly3: { x: number; y: number; z: number }[]): boolean {
  for (let c = cLo; c <= cHi; c++) {
    if (!cellInside(xs, ys, c, b, poly3)) return false;
  }
  return true;
}

/** Μεγιστοποίηση κατακόρυφης έκτασης ενός x-διαστήματος [cLo,cHi] γύρω από το band `b0`. */
function growBand(xs: number[], ys: number[], b0: number, cLo: number, cHi: number, poly3: { x: number; y: number; z: number }[]): [number, number] {
  let lo = b0;
  let hi = b0;
  while (lo - 1 >= 0 && bandCoversCols(xs, ys, lo - 1, cLo, cHi, poly3)) lo--;
  while (hi + 1 < ys.length - 1 && bandCoversCols(xs, ys, hi + 1, cLo, cHi, poly3)) hi++;
  return [lo, hi];
}

/** Στρογγυλεμένο κλειδί ορθογωνίου για dedup. */
function rectKey(r: SectionRectMm): string {
  const q = (v: number): number => Math.round(v * 100) / 100;
  return `${q(r.cx)},${q(r.cy)},${q(r.width)},${q(r.depth)}`;
}

/** true αν το `a` περιέχεται (ή ισούται) στο `b`. */
function rectContained(a: SectionRectMm, b: SectionRectMm): boolean {
  const tol = 1e-6;
  return (
    a.cx - a.width / 2 >= b.cx - b.width / 2 - tol &&
    a.cx + a.width / 2 <= b.cx + b.width / 2 + tol &&
    a.cy - a.depth / 2 >= b.cy - b.depth / 2 - tol &&
    a.cy + a.depth / 2 <= b.cy + b.depth / 2 + tol
  );
}

/** Αφαίρεση ορθογωνίων που περιέχονται πλήρως σε άλλο (κρατά τα μεγιστικά). */
function dropContained(rects: SectionRectMm[]): SectionRectMm[] {
  return rects.filter((a, i) => !rects.some((b, j) => i !== j && rectContained(a, b) && (!rectContained(b, a) || j < i)));
}

/**
 * Διασπά το LOCAL-mm rectilinear outline σε επικαλυπτόμενα maximal ορθογώνια σκέλη.
 * Επιστρέφει `[]` αν το outline δεν είναι rectilinear (διαγώνιες ακμές → ο caller
 * χρησιμοποιεί perimeter-from-outline). Τα ορθογώνια ταξινομούνται κατά εμβαδόν φθίνον
 * (το μεγαλύτερο σκέλος = κύριο στεφάνι).
 */
export function decomposeColumnSectionRects(outlineMm: readonly Point2D[]): SectionRectMm[] {
  if (outlineMm.length < 4 || !isRectilinear(outlineMm)) return [];
  const xs = distinctSorted(outlineMm.map((p) => p.x));
  const ys = distinctSorted(outlineMm.map((p) => p.y));
  if (xs.length < 2 || ys.length < 2) return [];
  const poly3 = toXY(outlineMm);

  const byKey = new Map<string, SectionRectMm>();
  for (let b = 0; b < ys.length - 1; b++) {
    for (const [cLo, cHi] of bandIntervals(xs, ys, b, poly3)) {
      const [b0, b1] = growBand(xs, ys, b, cLo, cHi, poly3);
      const x0 = xs[cLo];
      const x1 = xs[cHi + 1];
      const y0 = ys[b0];
      const y1 = ys[b1 + 1];
      const rect: SectionRectMm = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, width: x1 - x0, depth: y1 - y0 };
      if (rect.width >= MIN_RECT_MM && rect.depth >= MIN_RECT_MM) byKey.set(rectKey(rect), rect);
    }
  }
  return dropContained([...byKey.values()]).sort((a, b) => b.width * b.depth - a.width * a.depth);
}
