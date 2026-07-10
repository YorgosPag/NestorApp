/**
 * ADR-619 v2 — «Σκάλα από περιοχή»: ιχνηλάτης walkline (γραμμή ανάβασης).
 *
 * ΑΝΤΙΚΑΘΙΣΤΑ τον v1 bbox-bucket ταξινομητή (straight/L/U/spiral). Πλέον ο χρήστης
 * σχεδιάζει το ΚΛΕΙΣΤΟ ΟΡΘΟΓΩΝΙΟ ΟΡΙΟ του κλιμακοστασίου (το «λούκι»/corridor) και
 * η συνάρτηση επιστρέφει τη ΣΥΝΕΧΗ walkline (κεντρική γραμμή του διαδρόμου με
 * ακτινωτά τόξα στις στροφές) + το πλάτος w + τη βάση (STEP 1-4 του ADR).
 *
 * Ροή:
 *   1. Normalise (dedupe closing/consecutive, CCW, simplify collinear).
 *   2. `traceCorridorWalkline` (STEP 1: parallel-pair centreline + winder arcs).
 *   3. width = min pair distance· warning `below-min-width` όταν < 1200mm.
 *   4. base = ελεύθερο άκρο ΠΙΟ ΚΟΝΤΑ στην ΠΡΩΤΗ κορυφή σχεδίασης.
 *
 * ΠΟΤΕ δεν πετάει: εκφυλισμένο (<3 κορυφές / μηδέν εμβαδόν / χωρίς ζεύγος διαδρόμου)
 * → minimal ευθεία walkline κατά τον ΜΑΚΡΥ άξονα του bbox + warning.
 *
 * SSoT: polygon helpers από `shared/polygon-utils.ts` (area/bbox), vector helpers
 * από `geometry-vector-utils`, walkline geometry από `stair-region-walkline.ts`.
 * Τα warnings είναι ΚΩΔΙΚΟΙ (όχι user-facing strings) — το UI τα μεταφράζει αργότερα.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-619-stair-from-region.md
 */

import type { Point2D, Point3D } from '../../../rendering/types/Types';
import type { SceneUnits } from '../../../utils/scene-units';
import { mmToSceneUnits } from '../../../utils/scene-units';
import type { Vec2 } from './stair-geometry-shared';
import { polygonArea, polygonBbox } from '../shared/polygon-utils';
import {
  type CorridorWalkline,
  type WalklineSegment,
  traceCorridorWalkline,
} from './stair-region-walkline';

// ─── Public types ─────────────────────────────────────────────────────────────

/** Κάτω από αυτό το πλάτος (mm) → warning «κάτω από ελάχιστο κεντρικού κλιμακοστασίου». */
export const MIN_CENTRAL_STAIRWELL_WIDTH_MM = 1200;

export const WARNING_BELOW_MIN_WIDTH = 'below-min-width';
export const WARNING_DEGENERATE = 'degenerate-region';
export const WARNING_NO_CORRIDOR = 'no-corridor-pair';

/**
 * Αποτέλεσμα «Σκάλα από περιοχή» v2 — η walkline + οι μετρήσεις που τροφοδοτούν τον
 * `buildStairParamsFromRegion`. Όλα τα μήκη σε scene units του input πολυγώνου.
 */
export interface StairRegionClassification {
  /** Συνεχής walkline (ευθείες + τόξα), ταξινομημένη από ΒΑΣΗ προς κορυφή. */
  readonly walkline: readonly WalklineSegment[];
  /** Συνολικό μήκος τόξου L της walkline. */
  readonly length: number;
  /** Πλάτος διαδρόμου w = μετρημένη απόσταση ζεύγους (offset = w/2). */
  readonly width: number;
  /** Βάση (κάτω σκαλί, αφετηρία βέλους ΑΝΩ) — ελεύθερο άκρο κοντά στην 1η κορυφή. */
  readonly basePoint: Point2D;
  /** Κορυφή (άλλο ελεύθερο άκρο). */
  readonly topPoint: Point2D;
  /** Μοναδιαία διεύθυνση ανάβασης στη βάση. */
  readonly direction: Vec2;
  /** Το input αποτύπωμα (αμετάβλητο αντίγραφο). */
  readonly footprint: readonly Point2D[];
  /** Δομημένοι κωδικοί προειδοποίησης (internal — όχι user-facing). */
  readonly warnings: readonly string[];
}

// ─── Normalisation helpers ────────────────────────────────────────────────────

/** Αφαιρεί διαδοχικά διπλά + το closing duplicate (last === first). */
function dedupe(vertices: readonly Point2D[], eps: number): Point2D[] {
  const out: Point2D[] = [];
  for (const v of vertices) {
    const last = out[out.length - 1];
    if (last && Math.hypot(v.x - last.x, v.y - last.y) < eps) continue;
    out.push({ x: v.x, y: v.y });
  }
  if (out.length > 1) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < eps) out.pop();
  }
  return out;
}

function lift(v: Point2D): Point3D {
  return { x: v.x, y: v.y, z: 0 };
}

/** True όταν η κορυφή `i` είναι ~συγγραμμική (μοναδιαίο cross < sinTol). */
function isCollinear(a: Point2D, b: Point2D, c: Point2D, sinTol: number): boolean {
  const ux = b.x - a.x;
  const uy = b.y - a.y;
  const vx = c.x - b.x;
  const vy = c.y - b.y;
  const du = Math.hypot(ux, uy);
  const dv = Math.hypot(vx, vy);
  if (du < 1e-9 || dv < 1e-9) return true;
  return Math.abs((ux * vy - uy * vx) / (du * dv)) < sinTol;
}

/** Απλοποίηση συγγραμμικών κορυφών. */
function simplifyCollinear(pts: readonly Point2D[]): Point2D[] {
  let ring = [...pts];
  let changed = true;
  while (changed && ring.length > 3) {
    changed = false;
    const out: Point2D[] = [];
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      if (isCollinear(ring[(i - 1 + n) % n], ring[i], ring[(i + 1) % n], 0.02)) {
        changed = true;
        continue;
      }
      out.push(ring[i]);
    }
    if (out.length < 3) break;
    ring = out;
  }
  return ring;
}

/** Εξασφαλίζει CCW winding (θετικό signed area) — απαιτείται από reflex detection. */
function ensureCCW(ring: readonly Point2D[]): Point2D[] {
  const v3 = ring.map(lift);
  let signed = 0;
  for (let i = 0; i < v3.length; i++) {
    const a = v3[i];
    const b = v3[(i + 1) % v3.length];
    signed += a.x * b.y - b.x * a.y;
  }
  return signed < 0 ? [...ring].reverse() : [...ring];
}

// ─── Degenerate fallback ──────────────────────────────────────────────────────

/** Minimal ευθεία walkline κατά τον ΜΑΚΡΥ άξονα του bbox + warning. */
function degenerateFallback(
  footprint: readonly Point2D[],
  ring: readonly Point2D[],
  reason: string,
): StairRegionClassification {
  const bbox = polygonBbox(ring.map(lift));
  const w = bbox.max.x - bbox.min.x;
  const h = bbox.max.y - bbox.min.y;
  const alongX = w >= h;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  const cx = (bbox.min.x + bbox.max.x) / 2;
  const cy = (bbox.min.y + bbox.max.y) / 2;
  const base: Point2D = alongX ? { x: bbox.min.x, y: cy } : { x: cx, y: bbox.min.y };
  const top: Point2D = alongX ? { x: bbox.max.x, y: cy } : { x: cx, y: bbox.max.y };
  return {
    walkline: [{ type: 'line', start: base, end: top }],
    length: long,
    width: short,
    basePoint: base,
    topPoint: top,
    direction: alongX ? { x: 1, y: 0 } : { x: 0, y: 1 },
    footprint,
    warnings: [reason],
  };
}

// ─── Public entry ─────────────────────────────────────────────────────────────

/**
 * Ιχνηλατεί τη walkline ενός κλειστού ορθογώνιου corridor-πολυγώνου. ΠΟΤΕ δεν
 * πετάει — εκφυλισμένη είσοδος → minimal ευθεία fallback με `warnings`.
 */
export function classifyStairRegion(
  vertices: readonly Point2D[],
  sceneUnits: SceneUnits = 'mm',
): StairRegionClassification {
  const footprint: Point2D[] = vertices.map((p) => ({ x: p.x, y: p.y }));
  const s = mmToSceneUnits(sceneUnits);
  const eps = s; // 1mm σε scene units (unit-aware degeneracy threshold)
  const ring = dedupe(footprint, eps);

  if (ring.length < 3) {
    return degenerateFallback(footprint, ring.length ? ring : [{ x: 0, y: 0 }], WARNING_DEGENERATE);
  }
  const ccw = ensureCCW(simplifyCollinear(ring));
  if (polygonArea(ccw.map(lift)) <= eps * eps) {
    return degenerateFallback(footprint, ccw, WARNING_DEGENERATE);
  }

  const traced: CorridorWalkline | null = traceCorridorWalkline(ccw, footprint[0], eps);
  if (!traced) {
    return degenerateFallback(footprint, ccw, WARNING_NO_CORRIDOR);
  }

  const warnings: string[] = [];
  if (traced.width < MIN_CENTRAL_STAIRWELL_WIDTH_MM * s) warnings.push(WARNING_BELOW_MIN_WIDTH);

  return {
    walkline: traced.segments,
    length: traced.length,
    width: traced.width,
    basePoint: traced.basePoint,
    topPoint: traced.topPoint,
    direction: traced.direction,
    footprint,
    warnings,
  };
}
