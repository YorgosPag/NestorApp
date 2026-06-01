/**
 * ADR-363 — «Δομικά στοιχεία από περίγραμμα»: κοινό perimeter-from-faces SSoT (Φάση 0).
 *
 * Παίρνεις τις ΠΑΡΕΙΕΣ (περιγράμματα) ενός δομικού στοιχείου — κλειστά polylines /
 * ορθογώνια / αλυσίδες ανεξάρτητων γραμμών — και βγάζεις:
 *   1) τα κλειστά πολύγωνα (εξώτατη περίμετρος ανά στοιχείο),
 *   2) την ΚΑΤΗΓΟΡΙΑ σχήματος (ευθύ/Γ/Τ/Π/σύνθετο) από ορθές/ανακλαστικές γωνίες,
 *   3) την ΑΠΟΣΥΝΘΕΣΗ σε ορθογώνια σκέλη (slab sweep) → πάχος ανά σκέλος = μικρή πλευρά.
 *
 * Κοινό SSoT για ΔΥΟ builders (Giorgio 2026-06-01):
 *   - ΤΟΙΧΟΣ  → rects → `buildWallFillingRect` ×N (αλυσίδα WallEntity + miter στον caller).
 *   - ΤΟΙΧΙΟ  → polygon + shape → ColumnEntity (Φάση 3).
 *
 * ΚΑΜΙΑ αναπαραγωγή geometry math πέρα από το shape analysis:
 *   - rectangle entity corners → `rectangleCorners` (wall-from-entity).
 *   - containment → `isPointInPolygon` (GeometryUtils).
 *   - scene → segments → `extractLineSegments` (wall-in-region).
 *   - rect → τοίχος → `buildWallFillingRect` (wall-in-region, στον caller).
 *
 * Περιορισμός Φάσης 0/1: σχήματα με γωνίες ≠ 90° χαρακτηρίζονται 'composite' και ΔΕΝ
 * αποσυντίθενται σε rects (τοίχοι → αγνοούνται· τοιχία Φάσης 3 → ΕΝΑ composite column).
 * Loose-line loops πιάνονται μόνο ως καθαρός απλός κύκλος (κάθε κόμβος βαθμού 2).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6
 * @see ./wall-in-region.ts (rect detection + filling-wall builder)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Entity } from '../../types/entities';
import {
  isPolylineEntity,
  isLWPolylineEntity,
  isRectangleEntity,
  isRectEntity,
} from '../../types/entities';
import { rectangleCorners } from './wall-from-entity';
import { extractLineSegments, type DetectedRectangle, type RegionLineSeg } from './wall-in-region';
import { safeUnion } from '../geometry/shared/safe-polygon-boolean';

// ─── Public types ────────────────────────────────────────────────────────────

/** Κατηγορία διατομής περιμέτρου (ευθύ / Γ / Τ / Π / σύνθετο). */
export type PerimeterShape = 'rectangle' | 'L' | 'T' | 'U' | 'composite';

/** Ένα κλειστό περίγραμμα: εξώτατο πολύγωνο + κατηγορία + αποσύνθεση σε σκέλη. */
export interface ClosedPerimeter {
  /** Καθαρισμένο πολύγωνο (CCW, χωρίς διπλό κλείσιμο/συγγραμμικά). */
  readonly polygon: readonly Point2D[];
  readonly shape: PerimeterShape;
  /** Ορθογώνια σκέλη (κενό για 'composite'). */
  readonly rects: readonly DetectedRectangle[];
}

/** Αποτέλεσμα ανάλυσης μιας μικτής επιλογής. */
export interface PerimeterFacesResult {
  readonly perimeters: readonly ClosedPerimeter[];
  /** Όλα τα σκέλη όλων των αποσυντιθέμενων περιμέτρων (flatten). */
  readonly rects: readonly DetectedRectangle[];
  /** Κλειστά σχήματα που δεν έδωσαν κανένα σκέλος (composite/άκυρα) → toast. */
  readonly ignoredCount: number;
}

// ─── Vector helpers ──────────────────────────────────────────────────────────

const EPS = 1e-9;
const COS_RIGHT = 0.08; // ~±4.6° ανοχή ορθής γωνίας (όπως wall-in-region)

function dist(a: Point2D, b: Point2D): number {
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
function normalize(poly: readonly Point2D[], tol: number): Point2D[] {
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

// ─── Closed-polygon extraction from scene entities ───────────────────────────

/** Κλειστό polyline/lwpolyline (≥3 κορυφές) → πολύγωνο, αλλιώς null. */
function closedPolylinePolygon(e: Entity): Point2D[] | null {
  if (!(isPolylineEntity(e) || isLWPolylineEntity(e))) return null;
  const verts = e.vertices;
  if (!e.closed || !verts || verts.length < 3) return null;
  return verts.map((v) => ({ x: v.x, y: v.y }));
}

/** RECTANGLE/RECT entity → 4 κορυφές, αλλιώς null. */
function rectEntityPolygon(e: Entity): Point2D[] | null {
  if (!(isRectangleEntity(e) || isRectEntity(e))) return null;
  const corners = rectangleCorners(e as Parameters<typeof rectangleCorners>[0]);
  return corners.length === 4 ? corners : null;
}

/** Γράφος κόμβων/γειτνίασης από segments (συγχώνευση άκρων εντός tol). */
function buildSegmentGraph(
  segs: readonly RegionLineSeg[],
  tol: number,
): { nodes: Point2D[]; adj: number[][] } {
  const nodes: Point2D[] = [];
  const adj: number[][] = [];
  const indexOf = (p: Point2D): number => {
    for (let i = 0; i < nodes.length; i++) {
      if (dist(nodes[i], p) <= tol) return i;
    }
    nodes.push({ x: p.x, y: p.y });
    adj.push([]);
    return nodes.length - 1;
  };
  for (const s of segs) {
    const a = indexOf(s.start);
    const b = indexOf(s.end);
    if (a === b) continue;
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  }
  return { nodes, adj };
}

/** Διατρέχει απλό κύκλο από `start` (όλοι οι κόμβοι βαθμού 2). null αν δεν κλείνει. */
function walkSimpleCycle(start: number, adj: readonly number[][]): number[] | null {
  const cycle = [start];
  let prev = -1;
  let cur = start;
  while (true) {
    const nbrs = adj[cur];
    if (nbrs.length !== 2) return null;
    const next = nbrs[0] === prev ? nbrs[1] : nbrs[0];
    if (next === start) return cycle;
    if (cycle.includes(next) || cycle.length > 4096) return null;
    cycle.push(next);
    prev = cur;
    cur = next;
  }
}

/** Κλειστοί βρόχοι από αλυσίδες ανεξάρτητων γραμμών (καθαροί απλοί κύκλοι μόνο). */
function buildPolygonLoops(segs: readonly RegionLineSeg[], tol: number): Point2D[][] {
  if (segs.length < 3) return [];
  const { nodes, adj } = buildSegmentGraph(segs, tol);
  const loops: Point2D[][] = [];
  const visited = new Set<number>();
  for (let s = 0; s < nodes.length; s++) {
    if (visited.has(s) || adj[s].length !== 2) continue;
    const cycle = walkSimpleCycle(s, adj);
    visited.add(s);
    if (!cycle) continue;
    cycle.forEach((i) => visited.add(i));
    if (cycle.length >= 4) loops.push(cycle.map((i) => nodes[i]));
  }
  return loops;
}

/**
 * Όλα τα κλειστά πολύγωνα από scene entities: κλειστά polylines + ορθογώνια
 * απευθείας· οι ανεξάρτητες γραμμές αλυσιδώνονται σε καθαρούς απλούς κύκλους.
 */
export function extractClosedPolygons(entities: readonly Entity[], tol: number): Point2D[][] {
  const polygons: Point2D[][] = [];
  const looseEntities: Entity[] = [];
  for (const e of entities) {
    const poly = closedPolylinePolygon(e) ?? rectEntityPolygon(e);
    if (poly) polygons.push(poly);
    else looseEntities.push(e);
  }
  for (const loop of buildPolygonLoops(extractLineSegments(looseEntities), tol)) {
    polygons.push(loop);
  }
  return polygons;
}

// ─── Polygon union (ADR-363 Phase 3b — γειτονικά πλαίσια → ΕΝΑ σχήμα) ─────────

/**
 * Convert ένα ring polygon-clipping `[number,number][]` πίσω σε `Point2D[]`,
 * αφαιρώντας το διπλό κλείσιμο (polygon-clipping κλείνει τα rings: first===last).
 */
function ringToPoints(ring: ReadonlyArray<readonly [number, number]>): Point2D[] {
  const pts = ring.map(([x, y]) => ({ x, y }));
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) pts.pop();
  }
  return pts;
}

/**
 * Ενώνει γειτονικά/επικαλυπτόμενα κλειστά πολύγωνα σε ΕΝΑ περίγραμμα (ADR-363
 * Phase 3b). Γιατί: ένα τοιχίο σχήματος Π σχεδιασμένο ως 3 χωριστά ορθογώνια
 * είναι **ΕΝΑ φέρον στοιχείο** (Eurocode 8 — σύνθετη στατική λειτουργία, ενιαίο
 * κεντροειδές/ροπές αδρανείας/κέντρο διάτμησης), όχι τρία. Το boolean `safeUnion`
 * (polygon-clipping SSoT) ενώνει εφαπτόμενα/επικαλυπτόμενα και κρατά τα ασύνδετα
 * ΧΩΡΙΣΤΑ (κάθε στοιχείο = δικό του τοιχίο). Holes αγνοούνται (μόνο outer ring)·
 * empty union → fallback στα αρχικά (zero data loss). Pure — wrapper του SSoT.
 */
function unionTouchingPolygons(
  polys: ReadonlyArray<readonly Point2D[]>,
): Point2D[][] {
  const copy = (p: readonly Point2D[]): Point2D[] => p.map((q) => ({ x: q.x, y: q.y }));
  if (polys.length <= 1) return polys.map(copy);
  const geoms = polys.map((p) => [p.map((q) => [q.x, q.y] as [number, number])]);
  const merged = safeUnion(geoms[0], ...geoms.slice(1));
  if (merged.length === 0) return polys.map(copy);
  return merged.map((polygon) => ringToPoints(polygon[0]));
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

/**
 * Ανάλυση μιας επιλογής παρειών → περιγράμματα + σκέλη + πλήθος αγνοημένων.
 * Composite/άκυρα κλειστά σχήματα δεν παράγουν σκέλη (ignoredCount → toast).
 *
 * `options.unionTouching` (ADR-363 Phase 3b): ενώνει γειτονικά/επικαλυπτόμενα
 * κλειστά σχήματα σε ΕΝΑ περίγραμμα ΠΡΙΝ την κατηγοριοποίηση (3 ορθογώνια Π → ΕΝΑ
 * τοιχίο Π). Default `false` — οι τοίχοι κρατούν την ανά-σχήμα συμπεριφορά (δύο
 * γειτονικά δωμάτια ≠ ένα). Το column path (`perimeterFacesToColumns`) το ανάβει.
 */
export function perimeterFacesToRects(
  entities: readonly Entity[],
  tol: number,
  options?: { readonly unionTouching?: boolean },
): PerimeterFacesResult {
  const closed = extractClosedPolygons(entities, tol);
  const polys = options?.unionTouching ? unionTouchingPolygons(closed) : closed;
  const perimeters: ClosedPerimeter[] = [];
  let ignoredCount = 0;
  for (const polygon of polys) {
    const shape = classifyPerimeter(polygon, tol);
    const rects = shape === 'composite' ? [] : decomposeRectilinear(polygon, tol);
    perimeters.push({ polygon: normalize(polygon, tol), shape, rects });
    if (rects.length === 0) ignoredCount++;
  }
  return { perimeters, rects: perimeters.flatMap((p) => [...p.rects]), ignoredCount };
}
