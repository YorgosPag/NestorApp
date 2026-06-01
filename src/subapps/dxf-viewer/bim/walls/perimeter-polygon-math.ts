/**
 * ADR-363 — pure polygon math για το «Δομικά στοιχεία από περίγραμμα» SSoT.
 *
 * Εξήχθη από `perimeter-from-faces.ts` (N.7.1 file-size split): καθαρή γεωμετρία
 * πολυγώνου χωρίς εξάρτηση από scene entities —
 *   1) κανονικοποίηση (dedupe κλεισίματος → CCW → αφαίρεση συγγραμμικών),
 *   2) κατηγοριοποίηση σχήματος (ευθύ/Γ/Τ/Π/σύνθετο) από ορθές/ανακλαστικές γωνίες,
 *   3) αποσύνθεση ορθογωνικού πολυγώνου σε ορθογώνια σκέλη (slab sweep, στραμμένα OK).
 *
 * Το `perimeter-from-faces.ts` (extraction + union + orchestrator) καταναλώνει αυτά
 * και τα re-export-άρει για backward-compat του public API.
 *
 * @see ./perimeter-from-faces.ts
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DetectedRectangle } from './wall-in-region';

/** Κατηγορία διατομής περιμέτρου (ευθύ / Γ / Τ / Π / σύνθετο). */
export type PerimeterShape = 'rectangle' | 'L' | 'T' | 'U' | 'composite';

// ─── Vector helpers ──────────────────────────────────────────────────────────

export const EPS = 1e-9;
const COS_RIGHT = 0.08; // ~±4.6° ανοχή ορθής γωνίας (όπως wall-in-region)

export function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** z-component of (a−o)×(b−o) — εμβαδόν×2 / πρόσημο στροφής. */
function crossZ(o: Point2D, a: Point2D, b: Point2D): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function unit(dx: number, dy: number): Point2D {
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l };
}

// ─── Polygon normalization ───────────────────────────────────────────────────

/** Πετά το διπλό κλείσιμο (πρώτη ≈ τελευταία κορυφή). */
function dedupeClosing(poly: readonly Point2D[]): Point2D[] {
  const out = poly.map((p) => ({ x: p.x, y: p.y }));
  if (out.length >= 2 && dist(out[0], out[out.length - 1]) < EPS) out.pop();
  return out;
}

/** Διώχνει συγγραμμικές κορυφές (κάθετη απόσταση από prev→next < tol). */
function removeCollinear(poly: readonly Point2D[], tol: number): Point2D[] {
  const n = poly.length;
  if (n < 3) return poly.map((p) => ({ x: p.x, y: p.y }));
  const out: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const cur = poly[i];
    const next = poly[(i + 1) % n];
    const base = dist(prev, next);
    const height = base > EPS ? Math.abs(crossZ(prev, cur, next)) / base : 0;
    if (height >= tol) out.push({ x: cur.x, y: cur.y });
  }
  return out;
}

function signedArea(poly: readonly Point2D[]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/** Επιστρέφει το πολύγωνο σε CCW φορά (θετικό signed area). */
function toCCW(poly: readonly Point2D[]): Point2D[] {
  const p = poly.map((q) => ({ x: q.x, y: q.y }));
  return signedArea(p) < 0 ? p.reverse() : p;
}

/** Κανονικοποιημένο πολύγωνο (dedupe → CCW → χωρίς συγγραμμικά). */
export function normalize(poly: readonly Point2D[], tol: number): Point2D[] {
  return removeCollinear(toCCW(dedupeClosing(poly)), tol);
}

// ─── Angle analysis ──────────────────────────────────────────────────────────

/** Όλες οι γωνίες ~90°; (γινόμενο μοναδιαίων ακμών ~0). */
function allRightAngles(poly: readonly Point2D[]): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const prev = poly[(i - 1 + n) % n];
    const cur = poly[i];
    const next = poly[(i + 1) % n];
    const u = unit(prev.x - cur.x, prev.y - cur.y);
    const v = unit(next.x - cur.x, next.y - cur.y);
    if (Math.abs(u.x * v.x + u.y * v.y) > COS_RIGHT) return false;
  }
  return true;
}

/** Πλήθος ανακλαστικών (reflex, >180°) κορυφών σε CCW πολύγωνο. */
function countReflex(ccwPoly: readonly Point2D[]): number {
  const n = ccwPoly.length;
  let r = 0;
  for (let i = 0; i < n; i++) {
    const prev = ccwPoly[(i - 1 + n) % n];
    const cur = ccwPoly[i];
    const next = ccwPoly[(i + 1) % n];
    // CCW polygon: θετικό cross = κυρτή κορυφή, αρνητικό = ανακλαστική (reflex).
    if (crossZ(prev, cur, next) < -EPS) r++;
  }
  return r;
}

/**
 * Τ έναντι Π για 8-κορυφο/2-reflex ορθογωνικό, με βάση την κυκλική απόσταση των δύο
 * ανακλαστικών κορυφών: στο Π ενώνονται με ΜΙΑ ακμή (πάτος της εσοχής) → απόσταση 1·
 * στο Τ τις χωρίζει ο κορμός (δύο κυρτές κορυφές) → απόσταση 3. Σημείωση: Φάση 3 το
 * επικυρώνει/εκλεπτύνει για το ColumnKind (U-shape / composite).
 */
function classifyTU(ccwPoly: readonly Point2D[]): 'T' | 'U' {
  const n = ccwPoly.length;
  const reflex: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = ccwPoly[(i - 1 + n) % n];
    const next = ccwPoly[(i + 1) % n];
    if (crossZ(prev, ccwPoly[i], next) < -EPS) reflex.push(i);
  }
  if (reflex.length < 2) return 'U';
  const raw = Math.abs(reflex[0] - reflex[1]);
  return Math.min(raw, n - raw) === 1 ? 'U' : 'T';
}

/** Κατηγοριοποίηση σχήματος από κορυφές + ανακλαστικές γωνίες. */
export function classifyPerimeter(polygon: readonly Point2D[], tol: number): PerimeterShape {
  const poly = normalize(polygon, tol);
  const n = poly.length;
  if (n < 4 || !allRightAngles(poly)) return 'composite';
  const reflex = countReflex(poly);
  if (n === 4 && reflex === 0) return 'rectangle';
  if (n === 6 && reflex === 1) return 'L';
  if (n === 8 && reflex === 2) return classifyTU(poly);
  return 'composite';
}

// ─── Rectilinear decomposition (slab sweep) ──────────────────────────────────

function rotate(p: Point2D, ang: number): Point2D {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

/** Γωνία της μεγαλύτερης ακμής (τοπικό πλαίσιο → άξονας X). */
function dominantEdgeAngle(poly: readonly Point2D[]): number {
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = dist(a, b);
    if (len > bestLen) {
      bestLen = len;
      best = Math.atan2(b.y - a.y, b.x - a.x);
    }
  }
  return best;
}

/** Ταξινομημένες μοναδικές τιμές (συγχώνευση εντός tol). */
function uniqueSorted(values: number[], tol: number): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const out: number[] = [];
  for (const v of sorted) {
    if (out.length === 0 || v - out[out.length - 1] > tol) out.push(v);
  }
  return out;
}

/** Τομές των ακμών του πολυγώνου με την οριζόντια y=`y` (x-συντεταγμένες). */
function horizontalCrossings(poly: readonly Point2D[], y: number): number[] {
  const xs: number[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
      xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
  }
  return xs.sort((p, q) => p - q);
}

interface LocalRect {
  xa: number;
  xb: number;
  y0: number;
  y1: number;
}

/** Συγχώνευση κατακόρυφα γειτονικών slab-rects με ίδιο [xa,xb] (anti over-split). */
function mergeVertical(rects: LocalRect[], tol: number): LocalRect[] {
  const groups = new Map<string, LocalRect[]>();
  for (const r of rects) {
    const key = `${Math.round(r.xa / tol)}:${Math.round(r.xb / tol)}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  const out: LocalRect[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => a.y0 - b.y0);
    let cur = { ...g[0] };
    for (let i = 1; i < g.length; i++) {
      if (Math.abs(g[i].y0 - cur.y1) <= tol) cur.y1 = g[i].y1;
      else {
        out.push(cur);
        cur = { ...g[i] };
      }
    }
    out.push(cur);
  }
  return out;
}

/** Slab sweep σε τοπικό (axis-aligned) πλαίσιο → ορθογώνια σκέλη. */
function slabDecompose(local: readonly Point2D[], tol: number): LocalRect[] {
  const ys = uniqueSorted(local.map((p) => p.y), tol);
  const rects: LocalRect[] = [];
  for (let k = 0; k < ys.length - 1; k++) {
    const y0 = ys[k];
    const y1 = ys[k + 1];
    const xs = horizontalCrossings(local, (y0 + y1) / 2);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      if (xs[i + 1] - xs[i] > tol) rects.push({ xa: xs[i], xb: xs[i + 1], y0, y1 });
    }
  }
  return mergeVertical(rects, tol);
}

/** LocalRect → DetectedRectangle (στροφή πίσω στο world πλαίσιο). */
function toDetectedRect(r: LocalRect, ang: number): DetectedRectangle {
  const corners: [Point2D, Point2D, Point2D, Point2D] = [
    rotate({ x: r.xa, y: r.y0 }, ang),
    rotate({ x: r.xb, y: r.y0 }, ang),
    rotate({ x: r.xb, y: r.y1 }, ang),
    rotate({ x: r.xa, y: r.y1 }, ang),
  ];
  const w = r.xb - r.xa;
  const h = r.y1 - r.y0;
  return {
    polygon: corners,
    longSide: Math.max(w, h),
    shortSide: Math.min(w, h),
    area: w * h,
  };
}

/**
 * Αποσύνθεση ορθογωνικού πολυγώνου σε ορθογώνια σκέλη (slab sweep σε τοπικό πλαίσιο
 * ευθυγραμμισμένο με τη μεγαλύτερη ακμή). Επιστρέφει `[]` αν δεν είναι ορθογωνικό
 * (γωνίες ≠ 90° → 'composite').
 */
export function decomposeRectilinear(polygon: readonly Point2D[], tol: number): DetectedRectangle[] {
  const poly = normalize(polygon, tol);
  if (poly.length < 4 || !allRightAngles(poly)) return [];
  const ang = dominantEdgeAngle(poly);
  const local = poly.map((p) => rotate(p, -ang));
  return slabDecompose(local, tol).map((r) => toDetectedRect(r, ang));
}
