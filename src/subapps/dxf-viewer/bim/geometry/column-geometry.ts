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
  ColumnAnchor,
  ColumnGeometry,
  ColumnIShapeParams,
  ColumnKind,
  ColumnLshapeParams,
  ColumnParams,
  ColumnPolygonParams,
  ColumnTshapeParams,
} from '../types/column-types';
import {
  ANCHOR_OFFSETS,
  CIRCULAR_COLUMN_SEGMENTS,
  DEFAULT_I_FLANGE_THICKNESS_MM,
  DEFAULT_I_WEB_THICKNESS_MM,
  DEFAULT_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  MIN_I_PLATE_THICKNESS_MM,
  MIN_POLYGON_SIDES,
} from '../types/column-types';
import type { Point3D } from '../types/bim-base';
import type { ColumnTopProfile, ColumnBaseProfile } from './column-vertical-profile';
import { polygonArea, polygonBbox } from './shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;

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
  const transformed = transformFootprint(
    localVerts,
    params.position,
    params.anchor,
    params.width,
    params.depth,
    params.rotation,
    params.kind,
    s,
  );

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
 * I-shape (double-T, steel IPE/HEA family) — 12-vertex CCW (math Y-up).
 *
 *   - `width` (b)  = flange total width  (X-axis)
 *   - `depth` (h)  = section depth       (Y-axis)
 *   - `flangeThickness` (tf) = vertical thickness of top/bottom flanges
 *   - `webThickness`    (tw) = horizontal thickness of central web
 *
 * Vertices traverse outer outline starting bottom-left of bottom flange,
 * going right along bottom, up the web, left along top, and back down.
 *
 * flipY=true reverses winding (parity with L/T mirror transform). Visually
 * symmetric for I, but kept for transform-pipeline consistency.
 */
function buildIShapeLocal(width: number, depth: number, s: number, override?: ColumnIShapeParams): Point3D[] {
  const tfMm = override?.flangeThickness ?? DEFAULT_I_FLANGE_THICKNESS_MM;
  const twMm = override?.webThickness ?? DEFAULT_I_WEB_THICKNESS_MM;
  const tfRaw = Math.max(MIN_I_PLATE_THICKNESS_MM, tfMm) * s;
  const twRaw = Math.max(MIN_I_PLATE_THICKNESS_MM, twMm) * s;
  const hb = (width * s) / 2;
  const hh = (depth * s) / 2;
  // Clamp tf ≤ h/2 (else flanges overlap) and tw ≤ b (else web exits flange).
  const tf = Math.min(tfRaw, hh);
  const halfWeb = Math.min(twRaw / 2, hb);
  const flipY = override?.flipY ?? false;
  const ys = flipY ? -1 : 1;
  const verts: Point3D[] = [
    { x: -hb,      y: ys * -hh,        z: 0 },  // v0  bottom flange BL
    { x:  hb,      y: ys * -hh,        z: 0 },  // v1  bottom flange BR
    { x:  hb,      y: ys * (-hh + tf), z: 0 },  // v2  top of BR corner
    { x:  halfWeb, y: ys * (-hh + tf), z: 0 },  // v3  web BR
    { x:  halfWeb, y: ys * ( hh - tf), z: 0 },  // v4  web TR
    { x:  hb,      y: ys * ( hh - tf), z: 0 },  // v5  bottom of TR corner
    { x:  hb,      y: ys *  hh,        z: 0 },  // v6  top flange TR
    { x: -hb,      y: ys *  hh,        z: 0 },  // v7  top flange TL
    { x: -hb,      y: ys * ( hh - tf), z: 0 },  // v8  bottom of TL corner
    { x: -halfWeb, y: ys * ( hh - tf), z: 0 },  // v9  web TL
    { x: -halfWeb, y: ys * (-hh + tf), z: 0 },  // v10 web BL
    { x: -hb,      y: ys * (-hh + tf), z: 0 },  // v11 top of BL corner
  ];
  return flipY ? [...verts].reverse() : verts;
}

// ─── Anchor + rotation transform ────────────────────────────────────────────

/**
 * Compute canvas-space bbox dimensions από local vertices. Used by polygon
 * (no `depth` param) ώστε anchor offsets να βασίζονται σε actual bbox.
 */
function computeLocalBboxCanvas(local: readonly Point3D[]): { dimX: number; dimY: number } {
  let minX = Number.POSITIVE_INFINITY, maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY, maxY = Number.NEGATIVE_INFINITY;
  for (const v of local) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  return { dimX: maxX - minX, dimY: maxY - minY };
}

/**
 * Move local-frame vertices to world coords: translate by anchor offset so
 * the chosen anchor point sits on `position`, then rotate around `position`
 * για visual coherence με Tab cycling. Circular bypasses both (anchor fixed
 * 'center', rotation N/A). Polygon derives anchor dims from actual bbox.
 */
function transformFootprint(
  local: readonly Point3D[],
  position: Point3D,
  anchor: ColumnAnchor,
  width: number,
  depth: number,
  rotationDeg: number,
  kind: ColumnKind,
  s: number,
): Point3D[] {
  if (kind === 'circular') {
    return local.map((v) => ({ x: position.x + v.x, y: position.y + v.y, z: 0 }));
  }
  const { dx, dy } = ANCHOR_OFFSETS[anchor];
  // dx/dy are unit fractions of width/depth. Convert mm → canvas units via s.
  const { dimX, dimY } = kind === 'polygon'
    ? computeLocalBboxCanvas(local)
    : { dimX: width * s, dimY: depth * s };
  const shiftX = -dx * dimX;
  const shiftY = -dy * dimY;
  const cos = Math.cos(rotationDeg * DEG_TO_RAD);
  const sin = Math.sin(rotationDeg * DEG_TO_RAD);
  return local.map((v) => {
    const lx = v.x + shiftX;
    const ly = v.y + shiftY;
    const rx = lx * cos - ly * sin;
    const ry = lx * sin + ly * cos;
    return { x: position.x + rx, y: position.y + ry, z: 0 };
  });
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
