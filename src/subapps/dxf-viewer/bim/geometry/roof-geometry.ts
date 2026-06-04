/**
 * Roof geometry + validation (ADR-417, Φ1 vertical slice).
 *
 * Η **pure SSoT μηχανή παραγωγής** — `computeRoofGeometry(params)` παράγει τα
 * κεκλιμένα «νερά» (faces), τους κορφιάδες (ridges) και τα εμβαδά (projected +
 * gross) από τη συνταγή (footprint + per-edge slopes). Idempotent + side-effect
 * free (FOOTPRINT ⊥ TYPE). Όλοι οι downstream consumers (2Δ renderer, 3Δ
 * converter, BOQ) διαβάζουν ΜΟΝΟ αυτή τη derived γεωμετρία.
 *
 * ── Μοντέλο (lower envelope of rising planes) ────────────────────────────────
 * Κάθε slope-defining ακμή ορίζει ένα κεκλιμένο επίπεδο που ξεκινά από το γείσο
 * (eave, στάθμη `basePivotZ`) και ανηφορίζει προς το εσωτερικό με τον λόγο
 * `slopeRatio = rise/run`. Η επιφάνεια της στέγης σε κάθε σημείο = το **ΧΑΜΗΛΟΤΕΡΟ**
 * επίπεδο (κάτω περιβάλλουσα)· τα επίπεδα τέμνονται στους κορφιάδες/hip.
 *   - 0 slope ακμές → flat (οριζόντιο επίπεδο στο basePivotZ)
 *   - 1 slope ακμή  → mono-pitch (ΕΝΑ κεκλιμένο νερό)
 *   - 2 αντικριστές → gable (2 νερά + κορφιάς στη γραμμή τομής)
 *   - ≥3 / πλάγιες  → hip/complex (Φ2 straight-skeleton· Φ1 graceful flat fallback)
 *
 * ── Μονάδες (mirror slab-geometry) ───────────────────────────────────────────
 * `outline` xy σε canvas units· slope/elevations σε mm. `s = mmToSceneUnits` =
 * canvas units ανά mm. Οριζόντια απόσταση mm = canvasDist / s. Άρα
 * rise_mm = slopeRatio × canvasDist / s. Εμβαδά → m² μέσω `canvasToM`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 * @see bim/geometry/railing-geometry.ts — το πρότυπο pure SSoT μηχανής
 * @see bim/geometry/slab-geometry.ts — μονάδες/εμβαδά convention
 */

import { nowTimestamp } from '@/lib/firestore-now';
import type { BimValidation, Point3D, Polygon3D } from '../types/bim-base';
import type {
  RoofEdgeSlope,
  RoofFace,
  RoofGeometry,
  RoofParams,
  RoofRidgeLine,
  RoofShape,
  RoofSlopeUnit,
} from '../types/roof-types';
import {
  DEFAULT_ROOF_SLOPE_DEG,
  MIN_ROOF_POLYGON_VERTICES,
} from '../types/roof-types';
import { polygonArea, polygonBbox, polygonPerimeter } from './shared/polygon-utils';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
/** Two slope edges count as a gable pair when their inward normals are this anti-parallel. */
const GABLE_OPPOSITE_DOT = -0.7;

// ─── Slope-unit conversions (ADR-417 Q5) ─────────────────────────────────────

/** Κλίση (στη μονάδα `unit`) → λόγος rise/run. deg→tan, percent→/100. */
export function roofSlopeToRatio(slope: number, unit: RoofSlopeUnit): number {
  if (unit === 'percent') return slope / 100;
  // 'deg' — clamp κάτω από 90° (κατακόρυφο = άπειρος λόγος).
  const clamped = Math.max(0, Math.min(89.9, slope));
  return Math.tan(clamped * DEG_TO_RAD);
}

/** Λόγος rise/run → κλίση στη μονάδα `unit` (UI toggle μοίρες ↔ ποσοστό). */
export function roofSlopeFromRatio(ratio: number, unit: RoofSlopeUnit): number {
  if (unit === 'percent') return ratio * 100;
  return Math.atan(ratio) * RAD_TO_DEG;
}

// ─── Linear algebra helpers ──────────────────────────────────────────────────

interface Vec2 { readonly x: number; readonly y: number }

/**
 * Κεκλιμένο επίπεδο μιας slope-defining ακμής: σημείο αναφοράς `a` (κορυφή του
 * γείσου), εσωτερικό κάθετο `n` (μοναδιαίο, δείχνει μέσα στο CCW πολύγωνο) και
 * `ratio` = rise/run. Απόσταση σημείου από τη γραμμή γείσου (canvas) = (p−a)·n.
 */
interface EavePlane {
  readonly a: Vec2;
  readonly n: Vec2;
  readonly ratio: number;
}

/** Εσωτερικό κάθετο της ακμής v0→v1 σε CCW πολύγωνο (interior αριστερά). */
function inwardNormal(v0: Point3D, v1: Point3D): Vec2 {
  const dx = v1.x - v0.x;
  const dy = v1.y - v0.y;
  const len = Math.hypot(dx, dy) || 1;
  // Αριστερό κάθετο της κατεύθυνσης = (−dy, dx).
  return { x: -dy / len, y: dx / len };
}

/** Signed εσωτερική απόσταση (canvas) του `p` από το επίπεδο. */
function eaveDistance(plane: EavePlane, p: Vec2): number {
  return (p.x - plane.a.x) * plane.n.x + (p.y - plane.a.y) * plane.n.y;
}

// ─── Edge → plane resolution + shape classification ──────────────────────────

/** Συλλέγει τα κεκλιμένα επίπεδα + τους δείκτες των slope-defining ακμών. */
function resolveEavePlanes(
  verts: readonly Point3D[],
  edges: readonly RoofEdgeSlope[],
  unit: RoofSlopeUnit,
): { planes: EavePlane[]; slopeEdgeIndices: number[] } {
  const n = verts.length;
  const planes: EavePlane[] = [];
  const slopeEdgeIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    const e = edges[i];
    if (!e || !e.definesSlope) continue;
    const ratio = roofSlopeToRatio(e.slope, unit);
    if (ratio <= 0) continue;
    const v0 = verts[i];
    const v1 = verts[(i + 1) % n];
    planes.push({ a: { x: v0.x, y: v0.y }, n: inwardNormal(v0, v1), ratio });
    slopeEdgeIndices.push(i);
  }
  return { planes, slopeEdgeIndices };
}

/** Ταξινόμηση μορφής από τα κεκλιμένα επίπεδα (Φ1: flat/mono/gable). */
function classifyShape(planes: readonly EavePlane[]): RoofShape {
  if (planes.length === 0) return 'flat';
  if (planes.length === 1) return 'mono-pitch';
  if (planes.length === 2) {
    const dot = planes[0].n.x * planes[1].n.x + planes[0].n.y * planes[1].n.y;
    return dot <= GABLE_OPPOSITE_DOT ? 'gable' : 'complex';
  }
  return 'hip';
}

// ─── Height field (lower envelope) ───────────────────────────────────────────

/** Υψόμετρο στέγης (mm) στο plan-point `p` = basePivot + min επιπέδων. */
function roofZmm(planes: readonly EavePlane[], basePivotZ: number, s: number, p: Vec2): number {
  if (planes.length === 0) return basePivotZ;
  let minRise = Infinity;
  for (const plane of planes) {
    const distCanvas = Math.max(0, eaveDistance(plane, p));
    const rise = plane.ratio * distCanvas / s; // canvas→mm via /s
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
 * Κρατά το μέρος του πολυγώνου όπου `L(v) ≤ 0`. Το `L` είναι γραμμικό
 * functional· οι τομές στο `L=0` προστίθενται ως νέες κορυφές (κορφιάς).
 */
function clipByHalfPlane(poly: readonly Vec2[], L: (v: Vec2) => number): Vec2[] {
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

// ─── Face / ridge construction ───────────────────────────────────────────────

const sqrtSlopeScale = (ratio: number): number => Math.sqrt(1 + ratio * ratio);

function makeFace(poly2D: readonly Vec2[], ratio: number, planes: readonly EavePlane[], basePivotZ: number, s: number, canvasToM: number): RoofFace {
  const projectedAreaM2 = polygonArea(poly2D as readonly Point3D[]) * canvasToM * canvasToM;
  return {
    outline: liftVertices(poly2D, planes, basePivotZ, s),
    slopeRatio: ratio,
    projectedAreaM2,
    grossAreaM2: projectedAreaM2 * sqrtSlopeScale(ratio),
  };
}

/** Τομές της γραμμής κορφιά (L=0) με το footprint → δύο σημεία (canvas). */
function ridgeEndpoints(footprint: readonly Vec2[], L: (v: Vec2) => number): Vec2[] {
  const hits: Vec2[] = [];
  const n = footprint.length;
  for (let i = 0; i < n; i++) {
    const cur = footprint[i];
    const next = footprint[(i + 1) % n];
    const lc = L(cur);
    const ln = L(next);
    if ((lc <= 0) !== (ln <= 0)) {
      const t = lc / (lc - ln);
      hits.push({ x: cur.x + (next.x - cur.x) * t, y: cur.y + (next.y - cur.y) * t });
    }
  }
  return hits;
}

// ─── Engine ──────────────────────────────────────────────────────────────────

/**
 * Compute `RoofGeometry` από `RoofParams`. Pure SSoT. Επιστρέφει graceful flat
 * geometry για υπο-3-κορυφο footprint ή για μορφές Φ2 (hip/complex). Throws
 * nothing — validation στο `validateRoofParams()`.
 */
export function computeRoofGeometry(params: RoofParams): RoofGeometry {
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const canvasToM = (1 / s) * MM_TO_M;
  const verts = params.outline.vertices;
  const footprint2D: Vec2[] = verts.map((v) => ({ x: v.x, y: v.y }));

  const projectedAreaM2 = polygonArea(verts) * canvasToM * canvasToM;
  const perimeterM = polygonPerimeter(verts) * canvasToM;
  const xyBbox = polygonBbox(verts);

  const { planes } = resolveEavePlanes(verts, params.edges, params.slopeUnit);
  const shape = verts.length >= MIN_ROOF_POLYGON_VERTICES ? classifyShape(planes) : 'flat';

  const faces: RoofFace[] = [];
  const ridges: RoofRidgeLine[] = [];

  if (shape === 'gable' && planes.length === 2) {
    // Ridge = τομή των δύο επιπέδων: L(p) = r0·d0(p) − r1·d1(p).
    const [p0, p1] = planes;
    const L = (v: Vec2): number => p0.ratio * eaveDistance(p0, v) - p1.ratio * eaveDistance(p1, v);
    const faceA = clipByHalfPlane(footprint2D, L);        // plane0 χαμηλότερο
    const faceB = clipByHalfPlane(footprint2D, (v) => -L(v)); // plane1 χαμηλότερο
    if (faceA.length >= 3) faces.push(makeFace(faceA, p0.ratio, planes, params.basePivotZ, s, canvasToM));
    if (faceB.length >= 3) faces.push(makeFace(faceB, p1.ratio, planes, params.basePivotZ, s, canvasToM));
    const hits = ridgeEndpoints(footprint2D, L);
    if (hits.length >= 2) {
      const za = roofZmm(planes, params.basePivotZ, s, hits[0]);
      const zb = roofZmm(planes, params.basePivotZ, s, hits[1]);
      ridges.push({ a: { ...hits[0], z: za }, b: { ...hits[1], z: zb }, kind: 'ridge' });
    }
  } else if (shape === 'mono-pitch' && planes.length >= 1) {
    faces.push(makeFace(footprint2D, planes[0].ratio, planes, params.basePivotZ, s, canvasToM));
  } else {
    // flat + Φ2 fallback (hip/complex): επίπεδο footprint (graceful, μη-καταστροφικό).
    faces.push(makeFace(footprint2D, 0, [], params.basePivotZ, s, canvasToM));
  }

  const grossAreaM2 = faces.reduce((sum, f) => sum + f.grossAreaM2, 0);
  const thicknessMm = Math.max(0, params.thickness);
  const volumeM3 = grossAreaM2 * thicknessMm * MM_TO_M;

  // Ύψος κορφιά = μέγιστο z όλων των face κορυφών πάνω από το basePivot.
  let maxZmm = params.basePivotZ;
  for (const f of faces) for (const v of f.outline) if ((v.z ?? params.basePivotZ) > maxZmm) maxZmm = v.z ?? params.basePivotZ;
  const ridgeHeightMm = Math.max(0, maxZmm - params.basePivotZ);

  const bbox = {
    min: { x: xyBbox.min.x, y: xyBbox.min.y, z: (params.basePivotZ - thicknessMm) * MM_TO_M },
    max: { x: xyBbox.max.x, y: xyBbox.max.y, z: maxZmm * MM_TO_M },
  };

  return {
    footprint: params.outline,
    faces,
    ridges,
    bbox,
    projectedAreaM2,
    grossAreaM2,
    perimeterM,
    volumeM3,
    // BOQ aliases (SSoT path): covering area = κεκλιμένο GrossArea (ADR-417 Q7).
    area: grossAreaM2,
    volume: volumeM3,
    shape,
    ridgeHeightMm,
  };
}

// ─── Edge presets (UI / completion helper) ───────────────────────────────────

/** Μήκος ακμής i (canvas) σε CCW footprint. */
function edgeLength(verts: readonly Point3D[], i: number): number {
  const v0 = verts[i];
  const v1 = verts[(i + 1) % verts.length];
  return Math.hypot(v1.x - v0.x, v1.y - v0.y);
}

/** Όλες οι ακμές flat (αρχικό default — επίπεδο δώμα). */
export function buildDefaultRoofEdges(outline: Polygon3D): RoofEdgeSlope[] {
  return outline.vertices.map(() => ({ definesSlope: false, slope: 0, overhangMm: 0 }));
}

/**
 * Παράγει τον πίνακα `edges` για μια μορφή-preset (ADR-417 Q3): flat / mono /
 * gable. Επιλέγει τις slope-defining ακμές από τη γεωμετρία του footprint, ώστε
 * το contextual tab + το completion να μοιράζονται ΜΙΑ SSoT. Hip → Φ2.
 */
export function applyRoofShapePreset(
  outline: Polygon3D,
  shape: 'flat' | 'mono-pitch' | 'gable',
  slope: number,
  unit: RoofSlopeUnit,
): RoofEdgeSlope[] {
  const verts = outline.vertices;
  const n = verts.length;
  const edges = buildDefaultRoofEdges(outline);
  if (shape === 'flat' || n < MIN_ROOF_POLYGON_VERTICES) return edges;

  // Μακρύτερη ακμή = κύριο γείσο.
  let mainIdx = 0;
  let maxLen = -1;
  for (let i = 0; i < n; i++) {
    const len = edgeLength(verts, i);
    if (len > maxLen) { maxLen = len; mainIdx = i; }
  }
  edges[mainIdx] = { definesSlope: true, slope, overhangMm: 0 };
  if (shape === 'mono-pitch') return edges;

  // gable → η πιο αντικριστή ακμή (inward normals anti-parallel).
  const mainN = inwardNormal(verts[mainIdx], verts[(mainIdx + 1) % n]);
  let oppIdx = -1;
  let minDot = Infinity;
  for (let i = 0; i < n; i++) {
    if (i === mainIdx) continue;
    const ni = inwardNormal(verts[i], verts[(i + 1) % n]);
    const dot = mainN.x * ni.x + mainN.y * ni.y;
    if (dot < minDot) { minDot = dot; oppIdx = i; }
  }
  if (oppIdx >= 0 && minDot <= GABLE_OPPOSITE_DOT) {
    edges[oppIdx] = { definesSlope: true, slope, overhangMm: 0 };
  }
  return edges;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Result of a roof validation pass — hard errors non-empty when invalid. */
export interface RoofValidationResult {
  /** Όταν non-empty → caller MUST refuse entity creation. i18n keys. */
  readonly hardErrors: readonly string[];
  /** Non-blocking code violations (Revit pattern: warn, don't block). i18n keys. */
  readonly codeViolations: readonly string[];
  /** `BimValidation` payload για άμεση ανάθεση στο `RoofEntity.validation`. */
  readonly bimValidation: BimValidation;
}

/**
 * Validate `RoofParams`. Pure (geometry re-derivable). Hard errors: degenerate
 * footprint / edges-length mismatch / μη-θετικό πάχος / άκυρη κλίση σε
 * slope-defining ακμή. Code violations (warnings): πολύ απότομη κλίση (>60°).
 */
export function validateRoofParams(params: RoofParams): RoofValidationResult {
  const hardErrors: string[] = [];
  const codeViolations: string[] = [];
  const verts = params.outline.vertices;

  if (verts.length < MIN_ROOF_POLYGON_VERTICES) {
    hardErrors.push('roof.validation.hardErrors.footprintTooSmall');
  }
  if (params.edges.length !== verts.length) {
    hardErrors.push('roof.validation.hardErrors.edgesMismatch');
  }
  if (params.thickness <= 0) {
    hardErrors.push('roof.validation.hardErrors.nonPositiveThickness');
  }
  for (const e of params.edges) {
    if (!e.definesSlope) continue;
    const bad = params.slopeUnit === 'deg'
      ? !(e.slope > 0 && e.slope < 90)
      : !(e.slope > 0);
    if (bad) { hardErrors.push('roof.validation.hardErrors.invalidSlope'); break; }
  }

  for (const e of params.edges) {
    if (!e.definesSlope) continue;
    const ratio = roofSlopeToRatio(e.slope, params.slopeUnit);
    if (ratio > Math.tan(60 * DEG_TO_RAD)) {
      codeViolations.push('roof.validation.codeViolations.steepSlope');
      break;
    }
  }

  const bimValidation: BimValidation = {
    hasCodeViolations: codeViolations.length > 0,
    violationKeys: [...codeViolations],
    lastValidatedAt: nowTimestamp(),
  };

  return { hardErrors, codeViolations, bimValidation };
}

/** Convenience default slope (μοίρες) για νέα κεκλιμένη στέγη. */
export const ROOF_PRESET_DEFAULT_SLOPE_DEG = DEFAULT_ROOF_SLOPE_DEG;

/** Convenience: ratio από μια κλίση/μονάδα — re-export για downstream tooling. */
export function roofSceneCanvasToM(sceneUnits: SceneUnits): number {
  return (1 / mmToSceneUnits(sceneUnits)) * MM_TO_M;
}
