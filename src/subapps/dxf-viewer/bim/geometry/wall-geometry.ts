/**
 * Wall geometry computation (ADR-363 Phase 1).
 *
 * Pure SSoT function: derives `WallGeometry` cache από `WallParams`. Re-derive
 * on corruption (Phase 8 stair pattern). Idempotent + side-effect free.
 *
 * Port από `C:/genarc/src/engines/bom/wallGeometry.ts` με:
 *   - μονάδες mm (internal) → m (length/area/volume output, BOQ-ready)
 *   - απλοποίηση: Phase 1 υποστηρίζει μόνο `straight` kind. Curved/polyline
 *     land Phase 1.5 — οι signature θέσεις διατηρούνται για μέλλον.
 *   - 3D-readiness: `Point3D` με optional z (G11). Phase 1 z παραμένει 0.
 *   - openings subtraction (ADR-395 G6): όταν δοθεί `openings`, το `area` (και
 *     κατ' επέκταση το `volume`) είναι net = gross − Σ(opening width × height),
 *     clamped ≥ 0. Παραλείπεται → gross (display/render/3D path — ίδιο με slab).
 *
 * Σύμβαση μονάδων: όλα τα input/output γεωμετρικά σημεία σε mm. Μόνο τα
 * αριθμητικά scalars (`length`, `area`, `volume`) εκφράζονται σε m / m² / m³
 * για άμεση κατανάλωση από το BOQ pipeline (ADR-175).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.3
 */

import type { Point3D, Polyline3D, BoundingBox3D } from '../types/bim-base';
import type { WallParams, WallGeometry, WallKind } from '../types/wall-types';
import type { WallTopProfile } from './wall-top-profile';
import type { WallBaseProfile } from './wall-base-profile';
import { mmToSceneUnits } from '../../utils/scene-units';
import { offsetPolyline } from './shared/polygon-utils';
import { subdivideQuadraticBezier, tessellateArcAxis } from './shared/curve-tessellation';
import { BULGE_STRAIGHT_EPS } from '../../rendering/entities/shared/geometry-bulge-utils';

const MM_TO_M = 1 / 1000;
/** mm² → m² (1e6). ADR-395 G6 opening face area conversion. */
const MM2_TO_M2 = 1 / 1_000_000;
/**
 * ADR-363 Phase 1C — quadratic Bezier subdivision count for `curved` kind.
 * 16 segments give a visually smooth curve while keeping the offset-polyline
 * vertex-normal approximation accurate (mirrors AutoCAD `SPLINESEGS` default).
 */
const CURVED_SUBDIVISIONS = 16;

/**
 * Minimal opening descriptor for wall net-area subtraction (ADR-395 G6).
 * Passed by `useWallPersistence` from the host wall's hosted openings already
 * in memory — no Firestore query (mirror `BeamFootprintForDeduction`). Industry
 * (Revit / ArchiCAD): wall net area = gross − Σ(opening width × height), full
 * face area regardless of partial-in-wall.
 */
export interface OpeningFootprintForDeduction {
  /** mm. Opening width along wall axis. */
  readonly width: number;
  /** mm. Opening vertical extent (sill → head). */
  readonly height: number;
}

/**
 * Compute `WallGeometry` from `WallParams`. SSoT for all wall-derived geometry.
 *
 * Algorithm (straight kind):
 *   1. axisPolyline = [start, end] (centerline)
 *   2. unit perpendicular = rotate axis 90° CCW (or CW when `flip`)
 *   3. half-thickness offset along perpendicular → outerEdge / innerEdge
 *   4. bbox folds all 4 corner vertices + start.z/end.z
 *   5. length = ‖end − start‖ in mm → m
 *   6. area = length × height − Σ(opening width × height) (m²; clamp ≥ 0)
 *   7. volume = area × thickness (m² × m → m³)
 *
 * `params.kind` is honoured for polyline (when `polylineVertices` present);
 * curved kind falls back to straight axis until Phase 1.5 — the function is
 * `kind`-agnostic except for vertex selection.
 *
 * ADR-395 G6: όταν δοθεί `openings`, το `area`/`volume` είναι net (gross −
 * Σ ανοιγμάτων). Παραλείπεται → gross (back-compat — render/grips/3D path).
 *
 * ADR-401 Phase B3a: όταν δοθεί `profile` (attached τοίχος — μεταβλητή κορυφή),
 * το gross area γίνεται **profile-aware** = ∫(top(t)−base(t)) αντί `length ×
 * height`, και το bbox top ακολουθεί το πραγματικό `maxTopZmm`. Παραλείπεται →
 * flat fast path (byte-for-byte ίδιο με πριν· flat τοίχος ⇒ topExtent = height).
 *
 * ADR-401 (γ): όταν δοθεί `baseProfile` (base-attach — μεταβλητός πάτος), το
 * ύψος/area/volume γίνονται top − base (αντί top − nominalBase) και το bbox
 * bottom ακολουθεί το `minBaseZmm` (π.χ. θεμέλιο κάτω από τη στάθμη).
 */
export function computeWallGeometry(
  params: WallParams,
  kind: WallKind = 'straight',
  openings?: readonly OpeningFootprintForDeduction[],
  profile?: WallTopProfile,
  baseProfile?: WallBaseProfile,
): WallGeometry {
  // s converts mm scalar params → canvas world units (matches start/end coordinate space).
  // height and thickness are always stored in mm (SSOT); start/end are canvas world coords.
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');

  const rawVertices = pickAxisVertices(params, kind);
  const vertices = applyAxisBevels(rawVertices, params.startBevel ?? 0, params.endBevel ?? 0, s);

  // ADR-363 Phase 1O — location-line join: when a corner mitres, the drawn
  // CENTRELINE endpoint must meet the neighbour at the axis intersection J, else
  // free-end corners (endpoints not coincident, Phase 1N) leave a visible gap
  // between the two dashed axes. J is exactly the MIDPOINT of the miter outer/inner
  // points: both are offset ±half from the axis so their mean lies ON this wall's
  // axis, and being on BOTH walls' edge lines it is the axes' crossing → J. Applied
  // to the axis polyline only; the body edges keep their exact miter points, and
  // length/bbox stay on the nominal `vertices` (no BOQ ripple).
  const axisVertices = applyMiterAxisJoin(vertices, params.startMiter, params.endMiter);
  const axisPolyline: Polyline3D = { points: axisVertices, closed: false };

  const halfThicknessCanvas = (params.thickness / 2) * s;
  const sign = params.flip ? -1 : 1;

  const { outerEdge, innerEdge } = offsetAxisToEdges(vertices, halfThicknessCanvas, sign);

  // ADR-363 Phase 1D-C: override edge endpoints with true geometric miter points when
  // computed by `computeWallTrims` for corner junctions. startMiter/endMiter supersede
  // the axis-bevel approach (they are exact face intersections, not approximations).
  // Only straight/polyline kinds are relevant — the points array length is preserved.
  const outerPts = [...outerEdge.points];
  const innerPts = [...innerEdge.points];
  let edgesModified = false;
  if (params.startMiter && outerPts.length > 0) {
    const z = outerPts[0].z;
    outerPts[0] = { x: params.startMiter.outer.x, y: params.startMiter.outer.y, z };
    innerPts[0] = { x: params.startMiter.inner.x, y: params.startMiter.inner.y, z };
    edgesModified = true;
  }
  if (params.endMiter && outerPts.length > 0) {
    const last = outerPts.length - 1;
    const z = outerPts[last].z;
    outerPts[last] = { x: params.endMiter.outer.x, y: params.endMiter.outer.y, z };
    innerPts[last] = { x: params.endMiter.inner.x, y: params.endMiter.inner.y, z };
    edgesModified = true;
  }
  const finalOuter: Polyline3D = edgesModified ? { points: outerPts, closed: false } : outerEdge;
  const finalInner: Polyline3D = edgesModified ? { points: innerPts, closed: false } : innerEdge;

  // ADR-401 B3a/(γ): attached τοίχος → bbox από τα πραγματικά προφίλ. Top =
  // `maxTopZmm` (top-attach) ή nominal `baseOffset + height`. Bottom =
  // `minBaseZmm` (base-attach, π.χ. θεμέλιο κάτω από τη στάθμη) ή `baseOffset`.
  // Floor-relative datum: ο BOQ feed περνά profiles με floorElevationMm=0, άρα
  // absolute mm == floor-relative mm (ίδια σύμβαση με B3a). Flat → ταυτόσημο.
  const nominalBaseOffsetMm = params.baseOffset ?? 0;
  const bboxBottomMm = baseProfile ? baseProfile.minBaseZmm : nominalBaseOffsetMm;
  const bboxTopMm = profile ? profile.maxTopZmm : nominalBaseOffsetMm + params.height;
  const topExtentMm = Math.max(0, bboxTopMm - bboxBottomMm);
  const bbox = computeBbox(vertices, finalOuter.points, finalInner.points, topExtentMm, bboxBottomMm);

  // lengthCanvas is in canvas world units; convert to meters for BOQ.
  const lengthCanvas = computePolylineLengthMm(vertices);
  const lengthM = lengthCanvas * MM_TO_M / s;
  const heightM = params.height * MM_TO_M;
  const thicknessM = params.thickness * MM_TO_M;

  // ADR-395 G6: net area = gross − Σ(opening face area), clamped ≥ 0. Volume
  // follows the net area (a window void removes wall material). No openings →
  // gross (render/grips/3D callers pass none).
  // ADR-401 B3a/(γ): attached τοίχος (κορυφή Ή/ΚΑΙ βάση) → profile-aware gross =
  // ∫(top(t) − base(t)) dt × length (σκαλωτό/κεκλιμένο top & base). Αλλιώς flat
  // length × height (back-compat).
  const grossArea = (profile || baseProfile)
    ? profileGrossAreaM2(lengthM, params.height, profile, baseProfile)
    : lengthM * heightM;
  const area = Math.max(0, grossArea - sumOpeningAreasM2(openings));
  const volume = area * thicknessM;

  return {
    axisPolyline,
    outerEdge: finalOuter,
    innerEdge: finalInner,
    bbox,
    length: lengthM,
    area,
    volume,
  };
}

/**
 * Pure plan footprint ring (outer fwd + inner reversed) ενός τοίχου — ίδια σύμβαση με
 * το `WallRenderer.traceFootprintRing` (canvas), αλλά **pure 2D** (μηδέν screen
 * projection) για reuse σε BOQ net-volume (ADR-458 member↔column cutback) + 2Δ cutback
 * post-pass. Επιστρέφει κλειστό polygon του footprint (μήκος × πάχος στην κάτοψη). Άδειο
 * όταν κάποια ακμή έχει <2 σημεία.
 */
export function buildWallFootprintRing(
  outer: readonly Point3D[],
  inner: readonly Point3D[],
): { x: number; y: number }[] {
  if (outer.length < 2 || inner.length < 2) return [];
  const ring: { x: number; y: number }[] = [];
  for (const p of outer) ring.push({ x: p.x, y: p.y });
  for (let i = inner.length - 1; i >= 0; i--) ring.push({ x: inner[i].x, y: inner[i].y });
  return ring;
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Ελάχιστο piecewise-linear segment (top ή base) — κοινό σχήμα. */
interface ProfileSeg {
  readonly t0: number;
  readonly t1: number;
  readonly z0mm: number;
  readonly z1mm: number;
}

/**
 * Αποτίμηση piecewise-linear προφίλ στο `tEval` (mm), επιλέγοντας segment από το
 * `tMid` (interior-biased ώστε σε σκαλωτό/ασυνεχές προφίλ να μην παίρνουμε το
 * λάθος segment στα boundaries). `fallback` όταν το `tMid` πέφτει εκτός κάλυψης.
 */
function evalProfileSegAt(segs: readonly ProfileSeg[], tMid: number, tEval: number, fallback: number): number {
  const s = segs.find((seg) => tMid >= seg.t0 - 1e-9 && tMid <= seg.t1 + 1e-9);
  if (!s) return fallback;
  const span = s.t1 - s.t0;
  if (span < 1e-9) return s.z0mm;
  return s.z0mm + ((s.z1mm - s.z0mm) * (tEval - s.t0)) / span;
}

/**
 * ADR-401 B3a/(γ) — profile-aware gross wall face area (m²) = ∫(top(t) − base(t))
 * dt × length, με trapezoidal ολοκλήρωση πάνω στα **union** breakpoints των δύο
 * προφίλ (κάθε sub-interval έχει γραμμικό top & base → exact). Top: από το top
 * profile ή nominal `baseZmm + heightMm`. Base: από το base profile ή το nominal
 * baseline. Έτσι βγαίνει αυτόματα σκαλωτή (διαφορετικά segments) + κεκλιμένη
 * (z0≠z1) κορυφή ΚΑΙ βάση. Top-only flat → ισοδύναμο με `length × height`.
 */
function profileGrossAreaM2(
  lengthM: number,
  heightMm: number,
  topProfile?: WallTopProfile,
  baseProfile?: WallBaseProfile,
): number {
  const nominalBaseZmm = baseProfile?.nominalBaseZmm ?? topProfile?.baseZmm ?? 0;
  const nominalTopMm = nominalBaseZmm + heightMm;
  const nominalBaselineZmm = topProfile?.baseZmm ?? nominalBaseZmm;

  const bps = new Set<number>([0, 1]);
  if (topProfile) for (const s of topProfile.segments) { bps.add(s.t0); bps.add(s.t1); }
  if (baseProfile) for (const s of baseProfile.segments) { bps.add(s.t0); bps.add(s.t1); }
  const sorted = [...bps].sort((x, y) => x - y);

  const topAt = (tMid: number, tEval: number): number =>
    topProfile ? evalProfileSegAt(topProfile.segments, tMid, tEval, nominalTopMm) : nominalTopMm;
  const baseAt = (tMid: number, tEval: number): number =>
    baseProfile ? evalProfileSegAt(baseProfile.segments, tMid, tEval, nominalBaselineZmm) : nominalBaselineZmm;

  let total = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const ta = sorted[i];
    const tb = sorted[i + 1];
    const segLengthM = (tb - ta) * lengthM;
    if (segLengthM <= 0) continue;
    const tMid = (ta + tb) / 2;
    const hA = Math.max(0, topAt(tMid, ta) - baseAt(tMid, ta));
    const hB = Math.max(0, topAt(tMid, tb) - baseAt(tMid, tb));
    total += segLengthM * ((hA + hB) / 2) * MM_TO_M;
  }
  return total;
}

/**
 * Σ opening face areas in m² (width × height, mm → m²). Skips non-finite /
 * non-positive dimensions defensively. Undefined / empty list → 0 (gross).
 * Mirror `sumSlabOpeningAreasM2` (slab-geometry). ADR-395 G6.
 */
function sumOpeningAreasM2(
  openings: readonly OpeningFootprintForDeduction[] | undefined,
): number {
  if (!openings || openings.length === 0) return 0;
  let total = 0;
  for (const o of openings) {
    if (Number.isFinite(o.width) && Number.isFinite(o.height) && o.width > 0 && o.height > 0) {
      total += o.width * o.height * MM2_TO_M2;
    }
  }
  return total;
}

/**
 * Pick the axis vertices based on wall kind:
 *   - `polyline` + `polylineVertices` present → use them
 *   - `curved` + `arc` (bulge) present → tessellate true circular arc (ADR-565)
 *   - `curved` + `curveControl` present → subdivide quadratic Bezier (legacy)
 *   - else → [start, end] (straight kind, or curved fallback)
 *
 * `arc` (canonical DXF bulge) takes precedence over the legacy Bézier
 * `curveControl` when both are somehow present.
 */
function pickAxisVertices(params: WallParams, kind: WallKind): readonly Point3D[] {
  if (kind === 'polyline' && params.polylineVertices && params.polylineVertices.length >= 2) {
    return params.polylineVertices;
  }
  if (kind === 'curved' && params.arc != null && Math.abs(params.arc) > BULGE_STRAIGHT_EPS) {
    return tessellateArcAxis(params.start, params.end, params.arc, params.sceneUnits);
  }
  if (kind === 'curved' && params.curveControl) {
    return subdivideQuadraticBezier(params.start, params.curveControl, params.end, CURVED_SUBDIVISIONS);
  }
  return [params.start, params.end];
}

/**
 * Shorten the axis polyline at each end by the corresponding bevel amount (canvas
 * world units — SAME space as `pts`, produced by `computeWallTrims`).
 * Start bevel: moves the first point toward the second along the opening segment.
 * End bevel:   moves the last point toward the second-to-last.
 * Bevel > segment length is silently clamped to keep at least 1mm of axis. The
 * "1mm minimum" MUST be expressed in scene units (`minAxis = mmToSceneUnits`), NOT
 * a hardcoded "1": in a metres-scene drawing "1" means 1 METRE, so `seg − 1` went
 * negative for every sub-metre wall and the computed bevel was silently dropped →
 * region-fill stems kept overshooting to the neighbour centreline. ADR-363 Phase 1L.
 * Phase 1D-B: applied after vertex selection so all kinds benefit.
 */
/** ADR-363 Phase 1O — a corner miter's axis-join point J = midpoint(outer, inner). */
type WallMiterPoints = { readonly outer: { readonly x: number; readonly y: number }; readonly inner: { readonly x: number; readonly y: number } };

function miterAxisPoint(m: WallMiterPoints, z: number): Point3D {
  return { x: (m.outer.x + m.inner.x) / 2, y: (m.outer.y + m.inner.y) / 2, z };
}

/**
 * ADR-363 Phase 1O — return a copy of the axis vertices whose FIRST/LAST point is
 * snapped to the miter axis-join J (`miterAxisPoint`) when a start/end miter is
 * present, so mitred free-end corners close their dashed centrelines. Non-mitred
 * ends are untouched (returns the same array reference when there is nothing to do).
 */
function applyMiterAxisJoin(
  pts: readonly Point3D[],
  startMiter: WallMiterPoints | undefined,
  endMiter: WallMiterPoints | undefined,
): readonly Point3D[] {
  if (pts.length < 1 || (!startMiter && !endMiter)) return pts;
  const result = [...pts];
  if (startMiter) result[0] = miterAxisPoint(startMiter, result[0].z);
  if (endMiter) {
    const last = result.length - 1;
    result[last] = miterAxisPoint(endMiter, result[last].z);
  }
  return result;
}

function applyAxisBevels(
  pts: readonly Point3D[],
  startBevelMm: number,
  endBevelMm: number,
  minAxis: number,
): readonly Point3D[] {
  if (pts.length < 2 || (startBevelMm <= 0 && endBevelMm <= 0)) return pts;
  const result = [...pts];
  const n = result.length;

  if (startBevelMm > 0) {
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    const seg = Math.hypot(dx, dy);
    const clamped = Math.min(startBevelMm, seg - minAxis);
    if (clamped > 0) {
      const t = clamped / seg;
      result[0] = { x: pts[0].x + dx * t, y: pts[0].y + dy * t, z: pts[0].z ?? 0 };
    }
  }

  if (endBevelMm > 0) {
    const dx = pts[n - 2].x - pts[n - 1].x;
    const dy = pts[n - 2].y - pts[n - 1].y;
    const seg = Math.hypot(dx, dy);
    const clamped = Math.min(endBevelMm, seg - minAxis);
    if (clamped > 0) {
      const t = clamped / seg;
      result[n - 1] = { x: pts[n - 1].x + dx * t, y: pts[n - 1].y + dy * t, z: pts[n - 1].z ?? 0 };
    }
  }

  return result;
}

/**
 * Offset the axis polyline by ±halfThickness along the local perpendicular.
 * `sign` flips the offset orientation (carries `params.flip`).
 *
 * For a multi-vertex polyline each segment is offset independently and the
 * vertex point uses the average of the two adjacent segment normals (industry
 * approximation; mitred joins land Phase 1.5).
 *
 * Straight wall (2 vertices) is the common path — runs in 2 cross products.
 */
function offsetAxisToEdges(
  vertices: readonly Point3D[],
  halfThicknessMm: number,
  sign: number,
): { outerEdge: Polyline3D; innerEdge: Polyline3D } {
  if (vertices.length < 2) {
    return {
      outerEdge: { points: vertices, closed: false },
      innerEdge: { points: vertices, closed: false },
    };
  }

  // SSoT offset-with-mitre (shared/polygon-utils). outer = +sign side,
  // inner = −sign side. halfThicknessMm is already in canvas units here.
  return {
    outerEdge: { points: offsetPolyline(vertices, halfThicknessMm, sign), closed: false },
    innerEdge: { points: offsetPolyline(vertices, halfThicknessMm, -sign), closed: false },
  };
}

/**
 * Axis-aligned 3D bounding box. Phase B: z in metres (ADR-369 §2 Phase B).
 * base = baseOffset / 1000 m, top = base + height / 1000 m.
 */
function computeBbox(
  axis: readonly Point3D[],
  outer: readonly Point3D[],
  inner: readonly Point3D[],
  heightMm: number,
  baseOffsetMm: number = 0,
): BoundingBox3D {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  const fold = (p: Point3D): void => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };
  for (const p of axis) fold(p);
  for (const p of outer) fold(p);
  for (const p of inner) fold(p);
  const baseM = baseOffsetMm / 1000;
  return {
    min: { x: minX, y: minY, z: baseM },
    max: { x: maxX, y: maxY, z: baseM + heightMm / 1000 },
  };
}

/**
 * Tessellated axis vertices for a wall — straight (2 pts), polyline (N pts),
 * or curved (CURVED_SUBDIVISIONS+1 pts after Bezier subdivision). Bevel trim
 * applied. Exported for opening-geometry and wall-opening-coordinator.
 */
export function getWallAxisVertices(params: WallParams, kind: WallKind): readonly Point3D[] {
  const raw = pickAxisVertices(params, kind);
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  return applyAxisBevels(raw, params.startBevel ?? 0, params.endBevel ?? 0, s);
}

/** Polyline length in mm (sum of segment lengths). Exported for coordinators. */
export function computePolylineLengthMm(vertices: readonly Point3D[]): number {
  let len = 0;
  for (let i = 1; i < vertices.length; i++) {
    const a = vertices[i - 1];
    const b = vertices[i];
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}
