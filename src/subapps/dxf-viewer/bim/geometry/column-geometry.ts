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
  CIRCULAR_COLUMN_SEGMENTS,
  DEFAULT_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  MIN_POLYGON_SIDES,
} from '../types/column-types';
import type { Point2D } from '../../rendering/types/Types';
import type { ColumnTopProfile, ColumnBaseProfile } from './column-vertical-profile';
import { polygonArea, polygonBbox } from './shared/polygon-utils';
import { translatePoints } from '../../rendering/entities/shared/geometry-vector-utils';
import { buildIShapeProfile } from './shared/i-shape-profile';
import { mmScaleFor } from '../../utils/scene-units';
import { columnAnchorFrame, columnFootprintDims } from '../columns/column-footprint-dims';
import { centredLocalToWorld, centredPolyToWorld } from '../grips/centred-anchor-frame';
import { bboxOf } from './shared/xy-bounds';

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
  const s = mmScaleFor(params);
  const localVerts = buildLocalFootprint(params, s);
  const transformed = transformFootprint(localVerts, params);

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
function buildLocalFootprint(params: ColumnParams, s: number): Point2D[] {
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

function buildRectangularLocal(width: number, depth: number, s: number): Point2D[] {
  const hw = (width * s) / 2;  // mm → canvas units
  const hd = (depth * s) / 2;
  return [
    { x: -hw, y: -hd },
    { x:  hw, y: -hd },
    { x:  hw, y:  hd },
    { x: -hw, y:  hd },
  ];
}

function buildCircularLocal(diameter: number, s: number): Point2D[] {
  const r = (diameter * s) / 2;  // mm → canvas units
  const verts: Point2D[] = [];
  const step = (2 * Math.PI) / CIRCULAR_COLUMN_SEGMENTS;
  for (let i = 0; i < CIRCULAR_COLUMN_SEGMENTS; i++) {
    const a = i * step;
    verts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
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
/** L-shape μετρικά (scaled, scene units) — ΕΝΑ SSoT για footprint ΚΑΙ reference lines (ADR-523 §L-shape). */
interface LshapeMetrics {
  readonly armWidth: number;  // πάχος δευτερεύοντος (κατακόρυφου) βραχίονα κατά τον τοπικό x
  readonly armLength: number; // πάχος οριζόντιου σκέλους κατά τον τοπικό y
  readonly hw: number;        // ημι-πλάτος (width·s/2) — το οριζόντιο σκέλος εκτείνεται ±hw (centered)
  readonly hd: number;        // ημι-βάθος (depth·s/2)
  readonly ys: number;        // +1 default (σκέλος κάτω) / -1 flipY (σκέλος πάνω)
}

export function lshapeMetrics(width: number, depth: number, s: number, override?: ColumnLshapeParams): LshapeMetrics {
  // All mm scalars scaled by s → canvas units for correct 2D placement.
  return {
    armWidth: Math.max(s, (override?.armWidth ?? width / 3) * s),
    armLength: Math.max(s, (override?.armLength ?? depth / 3) * s),
    hw: (width * s) / 2,
    hd: (depth * s) / 2,
    ys: override?.flipY ? -1 : 1,
  };
}

function buildLshapeLocal(width: number, depth: number, s: number, override?: ColumnLshapeParams): Point2D[] {
  const { armWidth, armLength, hw, hd, ys } = lshapeMetrics(width, depth, s, override);
  const verts: Point2D[] = [
    { x: -hw,            y: ys * -hd },
    { x:  hw,            y: ys * -hd },
    { x:  hw,            y: ys * (-hd + armLength) },
    { x: -hw + armWidth, y: ys * (-hd + armLength) },
    { x: -hw + armWidth, y: ys * hd },
    { x: -hw,            y: ys * hd },
  ];
  return override?.flipY ? [...verts].reverse() : verts;
}

/**
 * T-shape CCW (anchor-frame): horizontal flange στο top + vertical web στο
 * bottom-center. flangeLength = πλάτος πέλματος (default = width),
 * webThickness = πάχος κορμού (default = depth/3), flangeThickness = πάχος
 * πέλματος / flange depth (default = depth/3· ADR-496 Phase 2 — override-able
 * ώστε το smart-fit να το ορίζει ίσο με το πλάτος του συνεχόμενου δοκαριού).
 *
 * flipY=true: flange moves to bottom (set by mirror — ADR-363 Phase 7.2).
 * y-flip reverses CCW winding, so vertices are reversed to restore it.
 */
/** T-shape μετρικά (scaled, scene units) — ΕΝΑ SSoT για footprint ΚΑΙ reference lines (ADR-523). */
interface TshapeMetrics {
  readonly flangeDepth: number; // πάχος πέλματος (κατά τον τοπικό y)
  readonly hd: number;          // ημι-βάθος (depth·s/2) — η κεφαλή κορυφώνεται στο ±hd
  readonly halfFlange: number;  // ημι-μήκος πέλματος (κατά τον τοπικό x)
  readonly halfWeb: number;     // ημι-πάχος κορμού
  readonly ys: number;          // +1 default / -1 flipY (κεφαλή κάτω)
}

export function tshapeMetrics(width: number, depth: number, s: number, override?: ColumnTshapeParams): TshapeMetrics {
  // All mm scalars scaled by s → canvas units for correct 2D placement.
  const flangeLength = Math.max(s, (override?.flangeLength ?? width) * s);
  const webThickness = Math.max(s, (override?.webThickness ?? depth / 3) * s);
  const flangeDepth = Math.max(s, (override?.flangeThickness ?? depth / 3) * s);
  const hw = (width * s) / 2;
  return {
    flangeDepth,
    hd: (depth * s) / 2,
    halfFlange: Math.min(hw, flangeLength / 2),
    halfWeb: Math.min(hw, webThickness / 2),
    ys: override?.flipY ? -1 : 1,
  };
}

function buildTshapeLocal(width: number, depth: number, s: number, override?: ColumnTshapeParams): Point2D[] {
  const { flangeDepth, hd, halfFlange, halfWeb, ys } = tshapeMetrics(width, depth, s, override);
  const verts: Point2D[] = [
    { x: -halfWeb,    y: ys * -hd },
    { x:  halfWeb,    y: ys * -hd },
    { x:  halfWeb,    y: ys * (hd - flangeDepth) },
    { x:  halfFlange, y: ys * (hd - flangeDepth) },
    { x:  halfFlange, y: ys * hd },
    { x: -halfFlange, y: ys * hd },
    { x: -halfFlange, y: ys * (hd - flangeDepth) },
    { x: -halfWeb,    y: ys * (hd - flangeDepth) },
  ];
  return ys === -1 ? [...verts].reverse() : verts;
}

/**
 * Regular N-gon (polygon kind, ADR-363 Phase 8). `diameter` = circumscribed
 * circle diameter (matches `params.width`). Sides clamped to [MIN, MAX].
 * Vertex 0 points up (math +Y) per AutoCAD/Revit convention so even-sided
 * polygons render flat-bottom and odd-sided ones point-up out of the box.
 */
function buildPolygonLocal(diameter: number, s: number, override?: ColumnPolygonParams): Point2D[] {
  const r = (diameter * s) / 2;
  const raw = override?.sides ?? DEFAULT_POLYGON_SIDES;
  const n = Math.max(MIN_POLYGON_SIDES, Math.min(MAX_POLYGON_SIDES, Math.round(raw)));
  const verts: Point2D[] = [];
  const step = (2 * Math.PI) / n;
  const startAngle = Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = startAngle + i * step;
    verts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return verts;
}

/**
 * I-shape (double-T, steel IPE/HEA family) footprint — thin wrapper γύρω από το
 * κοινό SSoT `buildIShapeProfile` (ADR-363 Φ2 — N.0.2 centralization). Η κολώνα
 * extrude-άρει αυτό το footprint κατακόρυφα· το δοκάρι σαρώνει το ίδιο προφίλ ως
 * κάθετη τομή κατά τον άξονα.
 */
function buildIShapeLocal(width: number, depth: number, s: number, override?: ColumnIShapeParams): Point2D[] {
  return buildIShapeProfile(width, depth, s, override);
}

/**
 * Map ένα polygon-backed footprint (LOCAL mm, κεντραρισμένο στο bbox-center)
 * σε canvas-unit `Point2D[]`. Pure scale × `s`. Χρησιμοποιείται από U-shape
 * (explicit polygon) + composite (ADR-363 Phase 2 «από περίγραμμα»).
 */
function polygonToLocal(poly: readonly Point2D[], s: number): Point2D[] {
  return poly.map((p) => ({ x: p.x * s, y: p.y * s }));
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
function buildUshapeLocal(width: number, depth: number, s: number, override?: ColumnUshapeParams): Point2D[] {
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
  const verts: Point2D[] = [
    { x: -hw,       y: ys * -hd },  // v0 bottom-left
    { x:  hw,       y: ys * -hd },  // v1 bottom-right
    { x:  hw,       y: ys *  hd },  // v2 top-right (right leg outer)
    { x:  hw - leg, y: ys *  hd },  // v3 right leg inner top
    { x:  hw - leg, y: ys * (-hd + base) },  // v4 notch right
    { x: -hw + leg, y: ys * (-hd + base) },  // v5 notch left
    { x: -hw + leg, y: ys *  hd },  // v6 left leg inner top
    { x: -hw,       y: ys *  hd },  // v7 top-left (left leg outer)
  ];
  return flipY ? [...verts].reverse() : verts;
}

/**
 * Composite (αυθαίρετη σύνθετη διατομή τοιχίου ΟΣ) — ΠΑΝΤΑ polygon-backed.
 * ADR-363 Phase 2. Το `polygon` (LOCAL mm, CCW, bbox-centered) είναι το ακριβές
 * SSoT. Degenerate guard (<3 κορυφές) → μικρό τετράγωνο 100mm (ο validator
 * μπλοκάρει κανονικά τέτοια params πριν φτάσουμε εδώ).
 */
function buildCompositeLocal(s: number, composite?: ColumnCompositeParams): Point2D[] {
  const poly = composite?.polygon;
  if (!poly || poly.length < 3) {
    const h = 50 * s; // 100mm × 100mm fallback
    return [
      { x: -h, y: -h },
      { x:  h, y: -h },
      { x:  h, y:  h },
      { x: -h, y:  h },
    ];
  }
  return polygonToLocal(poly, s);
}

/**
 * ADR-456 Slice 3 — μεταφέρει LOCAL mm σημεία (κεντραρισμένα στο centroid της
 * διατομής, ΠΡΙΝ anchor/rotation/scale) σε WORLD (scene units), μέσω του ΙΔΙΟΥ
 * `centredLocalToWorld` SSoT που χρησιμοποιεί το `transformFootprint`. Έτσι τα
 * παράγωγα overlays (θέσεις οπλισμού) ακολουθούν ΑΚΡΙΒΩΣ rotation/anchor της
 * κολώνας — render == footprint, μηδέν per-engine cos/sin. Circular: anchor πάντα
 * center, μηδέν rotation (όπως ο `transformFootprint`).
 */
export function columnLocalMmToWorld(params: ColumnParams, localMm: readonly Point2D[]): Point2D[] {
  const s = mmScaleFor(params);
  if (params.kind === 'circular') {
    return localMm.map((p) => ({ x: params.position.x + p.x * s, y: params.position.y + p.y * s }));
  }
  const frame = columnAnchorFrame(params);
  return localMm.map((p) => centredLocalToWorld(frame, p));
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
function transformFootprint(local: readonly Point2D[], params: ColumnParams): Point2D[] {
  if (params.kind === 'circular') {
    // Circular: κάθε local vertex μετατοπίζεται κατά `position`. Το `translatePoints`
    // (SSoT) είναι generic ⇒ διατηρεί τον τύπο εισόδου (2Δ προφίλ, ADR-789 Φάση Δ).
    return translatePoints(local, params.position);
  }
  const frame = columnAnchorFrame(params);
  return centredPolyToWorld(frame, local);
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

/**
 * ADR-363/449 — Υλοποιεί το footprint **οποιουδήποτε** kind ως ρητό polygon σε LOCAL mm
 * (bbox-centered), μέσω του ΙΔΙΟΥ SSoT (`buildLocalFootprint`) που τρέφει τη γεωμετρία. Το
 * χρησιμοποιεί το free per-corner reshape (`reshapeColumnCornerFree`) ώστε ένα παραμετρικό
 * shaped column (L/T/I/…) να μετατραπεί σε `composite` (custom διατομή) όταν ο χρήστης σύρει
 * ελεύθερα μια γωνία — μηδέν νέα γεωμετρία. canvas units → mm (÷ s), re-center στο bbox-center
 * (το σύμβολο που περιμένει το `resizePolyVertex`). Η σειρά κορυφών είναι ίδια με το rendered
 * `geometry.footprint.vertices` (ίδιο `buildLocalFootprint` + order-preserving transform).
 */
export function materializeColumnLocalPolygonMm(params: ColumnParams): Point2D[] {
  const s = mmScaleFor(params);
  const mm = buildLocalFootprint(params, s).map((v) => ({ x: v.x / s, y: v.y / s }));
  const { minX, maxX, minY, maxY } = bboxOf(mm);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return mm.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}
