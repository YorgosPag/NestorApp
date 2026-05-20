/**
 * Column geometry computation (ADR-363 Phase 4).
 *
 * Pure SSoT function — derives `ColumnGeometry` cache από `ColumnParams`.
 * Idempotent + side-effect free. Footprint builder dispatches per kind:
 *
 *   - rectangular → 4-vertex CCW rect (width × depth)
 *   - circular    → CIRCULAR_COLUMN_SEGMENTS-vertex polygon (Ø = width)
 *   - L-shape     → 6-vertex CCW L (default arm = width/3, depth/3)
 *   - T-shape     → 8-vertex CCW T (default flange = width, web = depth/3)
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
  ColumnKind,
  ColumnLshapeParams,
  ColumnParams,
  ColumnTshapeParams,
} from '../types/column-types';
import {
  ANCHOR_OFFSETS,
  CIRCULAR_COLUMN_SEGMENTS,
} from '../types/column-types';
import type { Point3D } from '../types/bim-base';
import { polygonArea, polygonBbox } from './shared/polygon-utils';
import { mmToSceneUnits } from '../../utils/scene-units';

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute `ColumnGeometry` από `ColumnParams`. Pure SSoT για column-derived
 * γεωμετρία. Caller MUST ensure width/depth > 0 (validator guard upstream).
 *
 * Throws nothing — validation σε `validateColumnParams()`.
 */
export function computeColumnGeometry(params: ColumnParams): ColumnGeometry {
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
  const heightMm = Math.max(0, params.height);
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

// ─── Anchor + rotation transform ────────────────────────────────────────────

/**
 * Move local-frame vertices to world coords: translate by anchor offset so
 * the chosen anchor point sits on `position`, then rotate around `position`
 * για visual coherence με Tab cycling. Circular bypasses both (anchor fixed
 * 'center', rotation N/A).
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
  const shiftX = -dx * width * s;
  const shiftY = -dy * depth * s;
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
 */
export function getColumnSlenderness(params: ColumnParams): number {
  const minDim = params.kind === 'circular'
    ? params.width
    : Math.min(params.width, params.depth);
  if (minDim <= 0) return Number.POSITIVE_INFINITY;
  return params.height / minDim;
}
