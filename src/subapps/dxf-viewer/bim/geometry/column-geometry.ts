/**
 * Column geometry computation (ADR-363 Phase 4 / Phase 8 extension).
 *
 * Pure SSoT function — derives `ColumnGeometry` cache από `ColumnParams`.
 * Idempotent + side-effect free. Footprint builder dispatches per kind:
 *
 *   - rectangular → 4-vertex CCW rect (width × depth)
 *   - circular    → CIRCULAR_COLUMN_SEGMENTS-vertex polygon (Ø = width)
 *   - L-shape     → 6-vertex CCW L (default arm = width/3, depth/3)
 *   - T-shape     → 8-vertex CCW T (default flange = width, web = depth/3)
 *   - polygon     → N-vertex regular N-gon (Ø_circ = width, sides = 3..12)  [Phase 8]
 *   - shear-wall  → 4-vertex rect (length=width, thickness=depth)           [Phase 8]
 *   - I-shape     → 12-vertex CCW double-T (b=width, h=depth, tf/tw flanges)[Phase 8]
 *   - U-shape     → 8-vertex CCW Π/κανάλι ή explicit polygon (polygon-backed) [Phase 2]
 *   - composite   → αυθαίρετο polygon (polygon-backed σύνθετη διατομή)         [Phase 2]
 *
 * Pipeline για non-circular: build local-axis vertices (origin = centroid
 * BEFORE anchor shift) → applyAnchorTransform (offsets so anchor sits on
 * `position`) → applyRotation (around `position` for visual stability with
 * Tab-cycling). Circular skips anchor offset (anchor always 'center') και
 * rotation.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import type {
  ColumnCompositeParams,
  ColumnGeometry,
  ColumnIShapeParams,
  ColumnLshapeParams,
  ColumnParams,
  ColumnPolygonParams,
  ColumnTshapeParams,
  ColumnUshapeParams,
} from '../types/column-types';
import {
  ANCHOR_OFFSETS,
  CIRCULAR_COLUMN_SEGMENTS,
  DEFAULT_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  MIN_POLYGON_SIDES,
} from '../types/column-types';
import type { Point3D } from '../types/bim-base';
import type { Point2D } from '../../rendering/types/Types';
import type { ColumnTopProfile, ColumnBaseProfile } from './column-vertical-profile';
import { polygonArea, polygonBbox } from './shared/polygon-utils';
import { buildIShapeProfile } from './shared/i-shape-profile';
import { mmToSceneUnits } from '../../utils/scene-units';
import { columnFootprintDims } from '../columns/column-footprint-dims';
import { centredPolyToWorld, type CentredAnchorFrame } from '../grips/centred-anchor-frame';

const MM_TO_M = 1 / 1000;

/** Αριθμητικός μέσος όρος (mm) μιας readonly λίστας — άδεια → fallback. */
function mean(values: readonly number[], fallback: number): number {
  if (values.length === 0) return fallback;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * ADR-401 Phase F.2 — effective ύψος (mm) attached κολώνας για BOQ. Per-corner
 * profiles → μέσο ύψος ανά footprint = `avg(cornerTopZmm) − avg(cornerBaseZmm)`
 * (για ~ομοιόμορφο footprint το avg αρκεί· mirror του wall `profileGrossAreaM2`).
 * Top-only → base = nominal· base-only → top = nominal. Flat → `params.height`.
 */
function effectiveColumnHeightMm(
  params: ColumnParams,
  topProfile?: ColumnTopProfile,
  baseProfile?: ColumnBaseProfile,
): number {
  const heightMm = Math.max(0, params.height);
  const nominalBaseZmm = baseProfile?.nominalBaseZmm ?? topProfile?.baseZmm ?? 0;
  const nominalTopMm = nominalBaseZmm + heightMm;
  const effTopMm = topProfile ? mean(topProfile.cornerTopZmm, nominalTopMm) : nominalTopMm;
  const effBaseMm = baseProfile ? mean(baseProfile.cornerBaseZmm, nominalBaseZmm) : nominalBaseZmm;
  return Math.max(0, effTopMm - effBaseMm);
}

/**
 * Compute `ColumnGeometry` από `ColumnParams`. Pure SSoT για column-derived
 * γεωμετρία. Caller MUST ensure width/depth > 0 (validator guard upstream).
 *
 * ADR-401 Phase F.2: όταν δοθούν `topProfile`/`baseProfile` (attach σε host),
 * το `height`/`volume` γίνονται profile-aware (effective μέσο ύψος αντί
 * `params.height`)· χωρίς προφίλ = byte-for-byte fast path (μηδέν regression).
 *
 * Throws nothing — validation σε `validateColumnParams()`.
 */
export function computeColumnGeometry(
  params: ColumnParams,
  topProfile?: ColumnTopProfile,
  baseProfile?: ColumnBaseProfile,
): ColumnGeometry {
  // s: canvas units per 1 mm. Shape builders emit local vertices in canvas
  // units (mm × s) so anchor-offset + rotation stay in the same space as
  // `params.position` (always canvas units from user click).
  const s = mmToSceneUnits(params.sceneUnits ?? 'mm');
  const localVerts = buildLocalFootprint(params, s);
  const transformed = transformFootprint(localVerts, params, s);

  const bbox = polygonBbox(transformed);
  // Polygon vertices are in canvas units → convert area to m².
  const areaCanvas2 = polygonArea(transformed);
  const canvasToM = (1 / s) * MM_TO_M;
  const areaM2 = areaCanvas2 * canvasToM * canvasToM;
  // ADR-401 F.2: profile-aware effective ύψος (attached κολώνα)· αλλιώς params.height.
  const heightMm = (topProfile || baseProfile)
    ? effectiveColumnHeightMm(params, topProfile, baseProfile)
    : Math.max(0, params.height);
  const volumeM3 = areaM2 * heightMm * MM_TO_M;

  return {
    footprint: { vertices: transformed },
    bbox,
    area: areaM2,
    volume: volumeM3,
    height: heightMm,
  };
}

// ─── Local footprint builders (per kind) ────────────────────────────────────

/**
 * Build the column footprint in LOCAL coordinates centred at origin (0,0),
 * BEFORE anchor offset + rotation. All variants emit CCW vertex order.
 */
function buildLocalFootprint(params: ColumnParams, s: number): Point3D[] {
  switch (params.kind) {
    case 'rectangular': return buildRectangularLocal(params.width, params.depth, s);
    case 'circular':    return buildCircularLocal(params.width, s);
    case 'L-shape':     return buildLshapeLocal(params.width, params.depth, s, params.lshape);
    case 'T-shape':     return buildTshapeLocal(params.width, params.depth, s, params.tshape);
    // ADR-363 Phase 8 — shear-wall reuses rectangular footprint (width=length, depth=thickness).
    // Validator + ribbon defaults differentiate τη συμπεριφορά.
    case 'shear-wall':  return buildRectangularLocal(params.width, params.depth, s);
    case 'polygon':     return buildPolygonLocal(params.width, s, params.polygon);
    case 'I-shape':     return buildIShapeLocal(params.width, params.depth, s, params.ishape);
    // ADR-363 Phase 2 «από περίγραμμα» — polygon-backed σύνθετες διατομές τοιχίου ΟΣ.
    case 'U-shape':     return buildUshapeLocal(params.width, params.depth, s, params.ushape);
    case 'composite':   return buildCompositeLocal(s, params.composite);
  }
}

function buildRectangularLocal(width: number, depth: number, s: number): Point3D[] {
  const hw = (width * s) / 2;  // mm → canvas units
  const hd = (depth * s) / 2;
  return [
    { x: -hw, y: -hd, z: 0 },
    { x:  hw, y: -hd, z: 0 },
    { x:  hw, y:  hd, z: 0 },
    { x: -hw, y:  hd, z: 0 },
  ];
}

function buildCircularLocal(diameter: number, s: number): Point3D[] {
  const r = (diameter * s) / 2;  // mm → canvas units
  const verts: Point3D[] = [];
  const step = (2 * Math.PI) / CIRCULAR_COLUMN_SEGMENTS;
  for (let i = 0; i < CIRCULAR_COLUMN_SEGMENTS; i++) {
    const a = i * step;
    verts.push({ x: r * Math.cos(a), y: r * Math.sin(a), z: 0 });
  }
  return verts;
}

/**
 * L-shape CCW (anchor-frame): full width × depth bounding box, με αφαίρεση
 * upper-right rectangle ώστε να μείνει το L. armLength = κόντρα μήκος
 * (default depth/3), armWidth = πάχος βραχίονα (default width/3).
 *
 * flipY=true: arm base moves to top (set by mirror — ADR-363 Phase 7.2).
 * y-flip reverses CCW winding, so vertices are reversed to restore it.
 */
function buildLshapeLocal(width: number, depth: number, s: number, override?: ColumnLshapeParams): Point3D[] {
  // All mm scalars scaled by s → canvas units for correct 2D placement.
  const armWidth = Math.max(s, (override?.armWidth ?? width / 3) * s);
  const armLength = Math.max(s, (override?.armLength ?? depth / 3) * s);
  const flipY = override?.flipY ?? false;
  const hw = (width * s) / 2;
  const hd = (depth * s) / 2;
  const ys = flipY ? -1 : 1;
  const verts: Point3D[] = [
    { x: -hw,            y: ys * -hd,              z: 0 },
    { x:  hw,            y: ys * -hd,              z: 0 },
    { x:  hw,            y: ys * (-hd + armLength), z: 0 },
    { x: -hw + armWidth, y: ys * (-hd + armLength), z: 0 },
    { x: -hw + armWidth, y: ys * hd,               z: 0 },
    { x: -hw,            y: ys * hd,               z: 0 },
  ];
  return flipY ? [...verts].reverse() : verts;
}

/**
 * T-shape CCW (anchor-frame): horizontal flange στο top + vertical web στο
 * bottom-center. flangeLength = πλάτος πέλματος (default = width),
 * webThickness = πάχος κορμού (default = depth/3).
 *
 * flipY=true: flange moves to bottom (set by mirror — ADR-363 Phase 7.2).
 * y-flip reverses CCW winding, so vertices are reversed to restore it.
 */
function buildTshapeLocal(width: number, depth: number, s: number, override?: ColumnTshapeParams): Point3D[] {
  // All mm scalars scaled by s → canvas units for correct 2D placement.
  const flangeLength = Math.max(s, (override?.flangeLength ?? width) * s);
  const webThickness = Math.max(s, (override?.webThickness ?? depth / 3) * s);
  const flangeDepth = Math.max(s, (depth / 3) * s);
  const flipY = override?.flipY ?? false;
  const hw = (width * s) / 2;
  const hd = (depth * s) / 2;
  const halfFlange = Math.min(hw, flangeLength / 2);
  const halfWeb = Math.min(hw, webThickness / 2);
  const ys = flipY ? -1 : 1;
  const verts: Point3D[] = [
    { x: -halfWeb,    y: ys * -hd,               z: 0 },
    { x:  halfWeb,    y: ys * -hd,               z: 0 },
    { x:  halfWeb,    y: ys * (hd - flangeDepth), z: 0 },
    { x:  halfFlange, y: ys * (hd - flangeDepth), z: 0 },
    { x:  halfFlange, y: ys * hd,                z: 0 },
    { x: -halfFlange, y: ys * hd,                z: 0 },
    { x: -halfFlange, y: ys * (hd - flangeDepth), z: 0 },
    { x: -halfWeb,    y: ys * (hd - flangeDepth), z: 0 },
  ];
  return flipY ? [...verts].reverse() : verts;
}

/**
 * Regular N-gon (polygon kind, ADR-363 Phase 8). `diameter` = circumscribed
 * circle diameter (matches `params.width`). Sides clamped to [MIN, MAX].
 * Vertex 0 points up (math +Y) per AutoCAD/Revit convention so even-sided
 * polygons render flat-bottom and odd-sided ones point-up out of the box.
 */
function buildPolygonLocal(diameter: number, s: number, override?: ColumnPolygonParams): Point3D[] {
  const r = (diameter * s) / 2;
  const raw = override?.sides ?? DEFAULT_POLYGON_SIDES;
  const n = Math.max(MIN_POLYGON_SIDES, Math.min(MAX_POLYGON_SIDES, Math.round(raw)));
  const verts: Point3D[] = [];
  const step = (2 * Math.PI) / n;
  const startAngle = Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = startAngle + i * step;
    verts.push({ x: r * Math.cos(a), y: r * Math.sin(a), z: 0 });
  }
  return verts;
}

/**
 * I-shape (double-T, steel IPE/HEA family) footprint — thin wrapper γύρω από το
 * κοινό SSoT `buildIShapeProfile` (ADR-363 Φ2 — N.0.2 centralization). Η κολώνα
 * extrude-άρει αυτό το footprint κατακόρυφα· το δοκάρι σαρώνει το ίδιο προφίλ ως
 * κάθετη τομή κατά τον άξονα.
 */
function buildIShapeLocal(width: number, depth: number, s: number, override?: ColumnIShapeParams): Point3D[] {
  return buildIShapeProfile(width, depth, s, override);
}

/**
 * Map ένα polygon-backed footprint (LOCAL mm, κεντραρισμένο στο bbox-center)
 * σε canvas-unit `Point3D[]`. Pure scale × `s`. Χρησιμοποιείται από U-shape
 * (explicit polygon) + composite (ADR-363 Phase 2 «από περίγραμμα»).
 */
function polygonToLocal(poly: readonly Point2D[], s: number): Point3D[] {
  return poly.map((p) => ({ x: p.x * s, y: p.y * s, z: 0 }));
}

/**
 * U-shape (Π/κανάλι) — 8-vertex CCW (math Y-up). ADR-363 Phase 2.
 *
 * Polygon-backed: αν `override.polygon` υπάρχει (από-περίγραμμα, Φάση 3), ΕΙΝΑΙ
 * το ακριβές SSoT (πάχη ανά σκέλος). Αλλιώς παραμετρικό Π σταθερού πάχους:
 *   - bbox `width` × `depth`, με αφαίρεση κεντρικού notch από την κορυφή
 *   - `legThickness` = πάχος κάθε ποδιού (default width/4)
 *   - `baseThickness` = πάχος βάσης (default depth/3)
 *
 * flipY=true: άνοιγμα προς τα κάτω· y-flip reverses CCW winding (mirror L/T).
 */
function buildUshapeLocal(width: number, depth: number, s: number, override?: ColumnUshapeParams): Point3D[] {
  if (override?.polygon && override.polygon.length >= 3) {
    return polygonToLocal(override.polygon, s);
  }
  const flipY = override?.flipY ?? false;
  const hw = (width * s) / 2;
  const hd = (depth * s) / 2;
  // mm scalars → canvas units· clamp ώστε τα δύο πόδια να μην επικαλύπτονται
  // (leg ≤ μισό πλάτος) και η βάση να μην ξεπερνά το βάθος.
  const leg = Math.min(Math.max(s, (override?.legThickness ?? width / 4) * s), hw);
  const base = Math.min(Math.max(s, (override?.baseThickness ?? depth / 3) * s), 2 * hd);
  const ys = flipY ? -1 : 1;
  const verts: Point3D[] = [
    { x: -hw,       y: ys * -hd,          z: 0 },  // v0 bottom-left
    { x:  hw,       y: ys * -hd,          z: 0 },  // v1 bottom-right
    { x:  hw,       y: ys *  hd,          z: 0 },  // v2 top-right (right leg outer)
    { x:  hw - leg, y: ys *  hd,          z: 0 },  // v3 right leg inner top
    { x:  hw - leg, y: ys * (-hd + base), z: 0 },  // v4 notch right
    { x: -hw + leg, y: ys * (-hd + base), z: 0 },  // v5 notch left
    { x: -hw + leg, y: ys *  hd,          z: 0 },  // v6 left leg inner top
    { x: -hw,       y: ys *  hd,          z: 0 },  // v7 top-left (left leg outer)
  ];
  return flipY ? [...verts].reverse() : verts;
}

/**
 * Composite (αυθαίρετη σύνθετη διατομή τοιχίου ΟΣ) — ΠΑΝΤΑ polygon-backed.
 * ADR-363 Phase 2. Το `polygon` (LOCAL mm, CCW, bbox-centered) είναι το ακριβές
 * SSoT. Degenerate guard (<3 κορυφές) → μικρό τετράγωνο 100mm (ο validator
 * μπλοκάρει κανονικά τέτοια params πριν φτάσουμε εδώ).
 */
function buildCompositeLocal(s: number, composite?: ColumnCompositeParams): Point3D[] {
  const poly = composite?.polygon;
  if (!poly || poly.length < 3) {
    const h = 50 * s; // 100mm × 100mm fallback
    return [
      { x: -h, y: -h, z: 0 },
      { x:  h, y: -h, z: 0 },
      { x:  h, y:  h, z: 0 },
      { x: -h, y:  h, z: 0 },
    ];
  }
  return polygonToLocal(poly, s);
}

// ─── Anchor + rotation transform ────────────────────────────────────────────

/**
 * Move local-frame vertices to world coords: anchor-shift so the chosen anchor
 * point sits on `position`, then rotate around `position` για visual coherence με
 * Tab cycling. Circular bypasses both (anchor fixed 'center', rotation N/A).
 *
 * ADR-363 Slice F #2 — footprint dims come from the SHARED `columnFootprintDims`
 * SSoT (the SAME source the grips + anchor-snap consume), and the anchor-shift →
 * rotate → translate runs through the centre-anchored `centredPolyToWorld` SSoT
 * (`rotateVector` → `rotatePoint`, ADR-188) — render == handles == insertion, no
 * per-engine raw cos/sin. The local vertices are already canvas units (mm × s);
 * only `dimX`/`dimY` (mm) get scaled internally for the anchor shift.
 */
function transformFootprint(
  local: readonly Point3D[],
  params: ColumnParams,
  s: number,
): Point3D[] {
  if (params.kind === 'circular') {
    return local.map((v) => ({ x: params.position.x + v.x, y: params.position.y + v.y, z: 0 }));
  }
  const { dimX, dimY } = columnFootprintDims(params);
  const frame: CentredAnchorFrame = {
    position: params.position,
    rotationDeg: params.rotation,
    scale: s,
    anchorOffset: ANCHOR_OFFSETS[params.anchor],
    dimX,
    dimY,
  };
  return centredPolyToWorld(frame, local).map((p) => ({ x: p.x, y: p.y, z: 0 }));
}

/**
 * Convenience: returns slenderness ratio = height / min(width, depth). Used
 * από validator για MAX_SLENDERNESS_RATIO check. Returns Infinity για
 * degenerate width or depth.
 *
 * `circular` + `polygon` use `width` (circumscribed Ø) since `depth` is
 * undefined for those kinds. All other kinds use min(width, depth).
 */
export function getColumnSlenderness(params: ColumnParams): number {
  const minDim = params.kind === 'circular' || params.kind === 'polygon'
    ? params.width
    : Math.min(params.width, params.depth);
  if (minDim <= 0) return Number.POSITIVE_INFINITY;
  return params.height / minDim;
}
