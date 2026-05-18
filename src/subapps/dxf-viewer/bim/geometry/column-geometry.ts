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

const MM_TO_M = 1 / 1000;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Compute `ColumnGeometry` από `ColumnParams`. Pure SSoT για column-derived
 * γεωμετρία. Caller MUST ensure width/depth > 0 (validator guard upstream).
 *
 * Throws nothing — validation σε `validateColumnParams()`.
 */
export function computeColumnGeometry(params: ColumnParams): ColumnGeometry {
  const localVerts = buildLocalFootprint(params);
  const transformed = transformFootprint(
    localVerts,
    params.position,
    params.anchor,
    params.width,
    params.depth,
    params.rotation,
    params.kind,
  );

  const bbox = polygonBbox(transformed);
  const areaMm2 = polygonArea(transformed);
  const areaM2 = areaMm2 * (MM_TO_M * MM_TO_M);
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
function buildLocalFootprint(params: ColumnParams): Point3D[] {
  switch (params.kind) {
    case 'rectangular': return buildRectangularLocal(params.width, params.depth);
    case 'circular':    return buildCircularLocal(params.width);
    case 'L-shape':     return buildLshapeLocal(params.width, params.depth, params.lshape);
    case 'T-shape':     return buildTshapeLocal(params.width, params.depth, params.tshape);
  }
}

function buildRectangularLocal(width: number, depth: number): Point3D[] {
  const hw = width / 2;
  const hd = depth / 2;
  return [
    { x: -hw, y: -hd, z: 0 },
    { x:  hw, y: -hd, z: 0 },
    { x:  hw, y:  hd, z: 0 },
    { x: -hw, y:  hd, z: 0 },
  ];
}

function buildCircularLocal(diameter: number): Point3D[] {
  const r = diameter / 2;
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
 */
function buildLshapeLocal(width: number, depth: number, override?: ColumnLshapeParams): Point3D[] {
  const armWidth = Math.max(1, override?.armWidth ?? width / 3);
  const armLength = Math.max(1, override?.armLength ?? depth / 3);
  const hw = width / 2;
  const hd = depth / 2;
  // L-shape vertices CCW (anchor-frame, origin = bbox centre):
  //   sw → se → upper-right notch corner1 → notch corner2 → nw
  return [
    { x: -hw,            y: -hd,            z: 0 }, // sw
    { x:  hw,            y: -hd,            z: 0 }, // se
    { x:  hw,            y: -hd + armLength, z: 0 }, // notch bottom-right
    { x: -hw + armWidth, y: -hd + armLength, z: 0 }, // notch inside
    { x: -hw + armWidth, y:  hd,            z: 0 }, // notch top
    { x: -hw,            y:  hd,            z: 0 }, // nw
  ];
}

/**
 * T-shape CCW (anchor-frame): horizontal flange στο top + vertical web στο
 * bottom-center. flangeLength = πλάτος πέλματος (default = width),
 * webThickness = πάχος κορμού (default = depth/3).
 */
function buildTshapeLocal(width: number, depth: number, override?: ColumnTshapeParams): Point3D[] {
  const flangeLength = Math.max(1, override?.flangeLength ?? width);
  const webThickness = Math.max(1, override?.webThickness ?? depth / 3);
  const flangeDepth = Math.max(1, depth / 3);
  const hw = width / 2;
  const hd = depth / 2;
  const halfFlange = Math.min(hw, flangeLength / 2);
  const halfWeb = Math.min(hw, webThickness / 2);
  // 8 vertices CCW starting στο web bottom-left:
  return [
    { x: -halfWeb,    y: -hd,                z: 0 },
    { x:  halfWeb,    y: -hd,                z: 0 },
    { x:  halfWeb,    y:  hd - flangeDepth,  z: 0 },
    { x:  halfFlange, y:  hd - flangeDepth,  z: 0 },
    { x:  halfFlange, y:  hd,                z: 0 },
    { x: -halfFlange, y:  hd,                z: 0 },
    { x: -halfFlange, y:  hd - flangeDepth,  z: 0 },
    { x: -halfWeb,    y:  hd - flangeDepth,  z: 0 },
  ];
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
): Point3D[] {
  if (kind === 'circular') {
    return local.map((v) => ({ x: position.x + v.x, y: position.y + v.y, z: 0 }));
  }
  const { dx, dy } = ANCHOR_OFFSETS[anchor];
  // Translate so anchor sits on origin BEFORE rotation, then rotate, then
  // shift to `position`. dx/dy are unit fractions of width/depth.
  const shiftX = -dx * width;
  const shiftY = -dy * depth;
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
