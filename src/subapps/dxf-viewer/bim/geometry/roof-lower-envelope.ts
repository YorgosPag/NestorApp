/**
 * Roof lower-envelope solver (ADR-417, Φ2a).
 *
 * Pure SSoT γεωμετρικός πυρήνας της στέγης: από τα ανερχόμενα κεκλιμένα επίπεδα
 * (eave planes) παράγει τα «νερά» (faces) ΚΑΙ τους κορφιάδες/hips (ridges). Είναι
 * η **γενίκευση** του παλιού gable-only special-case σε N επίπεδα — έτσι δίρριχτη
 * (gable, 2 αντικριστά επίπεδα) και τετράρριχτη (hip, 4 επίπεδα) προκύπτουν από
 * τον ΙΔΙΟ αλγόριθμο (Boy-Scout / FULL SSOT, N.0.2).
 *
 * ── Μοντέλο (lower envelope of rising planes) ────────────────────────────────
 * Κάθε slope-defining ακμή ορίζει επίπεδο που ξεκινά από το γείσο (στάθμη
 * `basePivotZ`) και ανηφορίζει με λόγο `ratio = rise/run`. Η στέγη σε κάθε σημείο
 * = το ΧΑΜΗΛΟΤΕΡΟ επίπεδο. Το «νερό» του επιπέδου `i` = η περιοχή του footprint
 * όπου `ratio_i·dist_i ≤ ratio_j·dist_j` ∀ j≠i, υπολογισμένη με διαδοχικό
 * half-plane clip (`clipByHalfPlane`). Οι κορφιάδες/hips = τα ΕΣΩΤΕΡΙΚΑ
 * ακμοτεμάχια των faces (τομές δύο επιπέδων· midpoint αυστηρά μέσα στο footprint).
 *
 * Στοχεύει **convex footprints** (η κοινή περίπτωση gable/hip). Concave/complex
 * footprints δίνουν graceful — μη ακριβές αλλά μη-καταστροφικό — αποτέλεσμα.
 *
 * ── Μονάδες (mirror slab/roof-geometry) ──────────────────────────────────────
 * `footprint2D` xy σε canvas units· slope/elevations σε mm. `s = mmToSceneUnits`
 * = canvas units ανά mm. Οριζόντια απόσταση mm = canvasDist / s.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 * @see bim/geometry/roof-geometry.ts — orchestrator/validation/presets
 */

import type { Point3D } from '../types/bim-base';
import type {
  RoofEdgeSlope,
  RoofFace,
  RoofRidgeLine,
  RoofSlopeUnit,
} from '../types/roof-types';
import { polygonArea, pointInPolygon } from './shared/polygon-utils';
import { roofSlopeToRatio } from './roof-slope-units';

// ─── Geometry primitives ─────────────────────────────────────────────────────

export interface Vec2 { readonly x: number; readonly y: number }

/**
 * Κεκλιμένο επίπεδο μιας slope-defining ακμής: σημείο αναφοράς `a` (κορυφή του
 * γείσου), εσωτερικό μοναδιαίο κάθετο `n` (δείχνει μέσα στο πολύγωνο) και `ratio`
 * = rise/run. Signed εσωτερική απόσταση (canvas) σημείου από τη γραμμή = (p−a)·n.
 */
export interface EavePlane {
  readonly a: Vec2;
  readonly n: Vec2;
  readonly ratio: number;
}

/**
 * Signed area (shoelace) στο xy επίπεδο των κορυφών. >0 = CCW στο σύστημα των
 * verts, <0 = CW. Καθαρά αλγεβρικό — ανεξάρτητο από y-up/y-down.
 */
function polygonSignedAreaXY(verts: readonly Point3D[]): number {
  let a = 0;
  const n = verts.length;
  for (let i = 0; i < n; i++) {
    const p = verts[i];
    const q = verts[(i + 1) % n];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Πρόσημο winding: +1 αν CCW στο σύστημα των verts, −1 αν CW. */
export function windingSign(verts: readonly Point3D[]): 1 | -1 {
  return polygonSignedAreaXY(verts) >= 0 ? 1 : -1;
}

/**
 * Εσωτερικό κάθετο της ακμής v0→v1. Το αριστερό κάθετο (−dy, dx) δείχνει μέσα για
 * CCW· για CW πολλαπλασιάζουμε επί `sign = −1`. Έτσι winding-agnostic.
 */
export function inwardNormal(v0: Point3D, v1: Point3D, sign: 1 | -1): Vec2 {
  const dx = v1.x - v0.x;
  const dy = v1.y - v0.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (sign * -dy) / len, y: (sign * dx) / len };
}

/** Signed εσωτερική απόσταση (canvas) του `p` από το επίπεδο. */
export function eaveDistance(plane: EavePlane, p: Vec2): number {
  return (p.x - plane.a.x) * plane.n.x + (p.y - plane.a.y) * plane.n.y;
}

/** Συλλέγει τα κεκλιμένα επίπεδα + τους δείκτες των slope-defining ακμών. */
export function resolveEavePlanes(
  verts: readonly Point3D[],
  edges: readonly RoofEdgeSlope[],
  unit: RoofSlopeUnit,
): { planes: EavePlane[]; slopeEdgeIndices: number[] } {
  const n = verts.length;
  const sign = windingSign(verts);
  const planes: EavePlane[] = [];
  const slopeEdgeIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    const e = edges[i];
    if (!e || !e.definesSlope) continue;
    const ratio = roofSlopeToRatio(e.slope, unit);
    if (ratio <= 0) continue;
    const v0 = verts[i];
    const v1 = verts[(i + 1) % n];
    planes.push({ a: { x: v0.x, y: v0.y }, n: inwardNormal(v0, v1, sign), ratio });
    slopeEdgeIndices.push(i);
  }
  return { planes, slopeEdgeIndices };
}

// ─── Height field (lower envelope) ───────────────────────────────────────────

/** Υψόμετρο στέγης (mm) στο plan-point `p` = basePivot + min επιπέδων. */
export function roofZmm(
  planes: readonly EavePlane[],
  basePivotZ: number,
  s: number,
  p: Vec2,
): number {
  if (planes.length === 0) return basePivotZ;
  let minRise = Infinity;
  for (const plane of planes) {
    const distCanvas = Math.max(0, eaveDistance(plane, p));
    const rise = (plane.ratio * distCanvas) / s; // canvas→mm via /s
    if (rise < minRise) minRise = rise;
  }
  return basePivotZ + (Number.isFinite(minRise) ? minRise : 0);
}

/** Σηκώνει 2D κορυφές σε 3D με z από το height field. */
function liftVertices(
  poly2D: readonly Vec2[],
  planes: readonly EavePlane[],
  basePivotZ: number,
  s: number,
): Point3D[] {
  return poly2D.map((v) => ({ x: v.x, y: v.y, z: roofZmm(planes, basePivotZ, s, v) }));
}

// ─── Half-plane clip (Sutherland–Hodgman) ────────────────────────────────────

/**
 * Κρατά το μέρος του πολυγώνου όπου `L(v) ≤ 0`. Οι τομές στο `L=0` προστίθενται
 * ως νέες κορυφές (κορφιάς/hip).
 */
export function clipByHalfPlane(poly: readonly Vec2[], L: (v: Vec2) => number): Vec2[] {
  const out: Vec2[] = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const cur = poly[i];
    const next = poly[(i + 1) % n];
    const lc = L(cur);
    const ln = L(next);
    if (lc <= 0) out.push(cur);
    if ((lc <= 0) !== (ln <= 0)) {
      const t = lc / (lc - ln);
      out.push({ x: cur.x + (next.x - cur.x) * t, y: cur.y + (next.y - cur.y) * t });
    }
  }
  return out;
}

// ─── Face construction ───────────────────────────────────────────────────────

const sqrtSlopeScale = (ratio: number): number => Math.sqrt(1 + ratio * ratio);

/** Ένα «νερό» (planar face) από 2D πολύγωνο + κλίση. */
export function makeFace(
  poly2D: readonly Vec2[],
  ratio: number,
  planes: readonly EavePlane[],
  basePivotZ: number,
  s: number,
  canvasToM: number,
): RoofFace {
  const projectedAreaM2 = polygonArea(poly2D as readonly Point3D[]) * canvasToM * canvasToM;
  return {
    outline: liftVertices(poly2D, planes, basePivotZ, s),
    slopeRatio: ratio,
    projectedAreaM2,
    grossAreaM2: projectedAreaM2 * sqrtSlopeScale(ratio),
  };
}

// ─── Ridge / hip extraction ──────────────────────────────────────────────────

/** Tolerance (canvas units) — κάτω από αυτό ένα σημείο θεωρείται «πάνω στη γραμμή». */
const BOUNDARY_EPS = 1e-3;
/** Tolerance (mm) — κάτω από αυτό μια ακμή θεωρείται οριζόντια (ridge vs hip). */
const HORIZONTAL_Z_EPS = 1;

/** Απόσταση σημείου `p` από το ευθύγραμμο τμήμα a→b (canvas). */
function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** True όταν το midpoint της face-ακμής a→b είναι ΕΣΩΤΕΡΙΚΟ (όχι σε footprint edge). */
function isInteriorEdge(a: Vec2, b: Vec2, footprint: readonly Vec2[]): boolean {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if (!pointInPolygon(mid, footprint as readonly Point3D[])) return false;
  const n = footprint.length;
  for (let i = 0; i < n; i++) {
    if (distToSegment(mid, footprint[i], footprint[(i + 1) % n]) <= BOUNDARY_EPS) return false;
  }
  return true;
}

/** Canonical κλειδί ακμής (rounded + sorted endpoints) για dedupe. */
function edgeKey(a: Vec2, b: Vec2): string {
  const k = (v: Vec2): string => `${Math.round(v.x * 100)},${Math.round(v.y * 100)}`;
  const ka = k(a);
  const kb = k(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/** Μετατρέπει εσωτερική ακμή σε `RoofRidgeLine` (ridge=οριζόντιος, hip=κεκλιμένος). */
function ridgeFromEdge(
  a: Vec2,
  b: Vec2,
  planes: readonly EavePlane[],
  basePivotZ: number,
  s: number,
): RoofRidgeLine {
  const za = roofZmm(planes, basePivotZ, s, a);
  const zb = roofZmm(planes, basePivotZ, s, b);
  const kind: RoofRidgeLine['kind'] = Math.abs(za - zb) < HORIZONTAL_Z_EPS ? 'ridge' : 'hip';
  return { a: { x: a.x, y: a.y, z: za }, b: { x: b.x, y: b.y, z: zb }, kind };
}

/** Result of the lower-envelope solver: τα νερά + οι κορφιάδες/hips. */
export interface LowerEnvelopeResult {
  readonly faces: RoofFace[];
  readonly ridges: RoofRidgeLine[];
}

/**
 * Γενικός N-plane solver. Για κάθε επίπεδο `i` κόβει το footprint στην περιοχή
 * όπου είναι το χαμηλότερο (= το «νερό» του), μετά εξάγει τις εσωτερικές ακμές
 * (τομές επιπέδων) ως κορφιάδες/hips. Αναπαράγει το gable για 2 αντικριστά
 * επίπεδα· δίνει σωστή τετράρριχτη για 4.
 */
export function solveLowerEnvelope(
  footprint2D: readonly Vec2[],
  planes: readonly EavePlane[],
  basePivotZ: number,
  s: number,
  canvasToM: number,
): LowerEnvelopeResult {
  const faces: RoofFace[] = [];
  const facePolys: Vec2[][] = [];
  for (let i = 0; i < planes.length; i++) {
    let poly: Vec2[] = footprint2D.slice();
    for (let j = 0; j < planes.length && poly.length >= 3; j++) {
      if (i === j) continue;
      const pi = planes[i];
      const pj = planes[j];
      poly = clipByHalfPlane(
        poly,
        (v) => pi.ratio * eaveDistance(pi, v) - pj.ratio * eaveDistance(pj, v),
      );
    }
    if (poly.length >= 3) {
      faces.push(makeFace(poly, planes[i].ratio, planes, basePivotZ, s, canvasToM));
      facePolys.push(poly);
    }
  }

  const seen = new Set<string>();
  const ridges: RoofRidgeLine[] = [];
  for (const poly of facePolys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (!isInteriorEdge(a, b, footprint2D)) continue;
      const key = edgeKey(a, b);
      if (seen.has(key)) continue;
      seen.add(key);
      ridges.push(ridgeFromEdge(a, b, planes, basePivotZ, s));
    }
  }
  return { faces, ridges };
}
