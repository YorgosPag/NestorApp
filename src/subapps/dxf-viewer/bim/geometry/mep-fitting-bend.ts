/**
 * ADR-408 Φ11 — pipe-bend geometry SSoT (Revit-grade elbow).
 *
 * The ONE source of truth for the circular bend that rounds the corner where two
 * pipes meet at an angle (Revit long-radius elbow). Consumed by:
 *   - `mep-fitting-geometry.ts` (2D plan footprint = the swept bend body),
 *   - `mep-fitting-to-mesh.ts` (3D torus sweep of the pipe section along the arc),
 *   - the segment trim resolver (each leg is shortened by `tangentLen`, so the
 *     straight pipes stop exactly where the bend begins — no ugly crossing).
 *
 * UNIT-AGNOSTIC & PURE: every length (node coords, `diameter`) is in ONE caller
 * unit; the result comes back in that same unit. 2D passes canvas units, 3D passes
 * metres. No store / Firestore / React.
 *
 * Geometry (Revit "long radius" R = 1.5·D, tangent fillet of the two centrelines):
 *   - `φ`   = angle between the two OUTWARD leg directions (π ⇒ straight, no bend).
 *   - `R`   = bend centreline radius = `bendFactor · diameter`.
 *   - `T`   = tangent length from the node along each leg = `R / tan(φ/2)`.
 *   - `C`   = arc centre = node + bisector · (R / sin(φ/2)).
 *   - walls = arcs concentric with `C` at `R ± diameter/2`.
 *
 * @see ./mep-fitting-geometry.ts
 * @see ../../bim-3d/converters/mep-fitting-to-mesh.ts
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import type { Point3D } from '../types/bim-base';

/** Revit long-radius default: centreline bend radius = 1.5 × pipe diameter. */
export const DEFAULT_BEND_FACTOR = 1.5;

/** Below this angle from straight (rad) the legs are treated as collinear → no bend. */
const STRAIGHT_EPSILON_RAD = 0.05;

/** A resolved elbow bend, all lengths in the caller's unit (canvas or metres). */
export interface ElbowBend {
  /** Arc centre. */
  readonly center: { x: number; y: number };
  /** Centreline radius R (= bendFactor · diameter). */
  readonly centerRadius: number;
  /** Outer wall radius R + maxRadius (bounding — uniform-elbow back-compat / bbox). */
  readonly outerRadius: number;
  /** Inner wall radius max(R − maxRadius, ~0) (bounding). */
  readonly innerRadius: number;
  /**
   * Pipe radius at tangentA (leg A = incident[0]). Equals tangentB's radius for a
   * uniform elbow; differs for a REDUCING elbow, where the swept tube tapers
   * `radiusStart → radiusEnd` along the arc.
   */
  readonly radiusStart: number;
  /** Pipe radius at tangentB (leg B = incident[1]). */
  readonly radiusEnd: number;
  /** Tangent length T from node along each leg (where the straight pipe stops). */
  readonly tangentLen: number;
  /** Tangent point on leg A (node + dirA · T). */
  readonly tangentA: { x: number; y: number };
  /** Tangent point on leg B (node + dirB · T). */
  readonly tangentB: { x: number; y: number };
  /** Arc angle (rad) at tangentA, measured about `center`. */
  readonly startAngle: number;
  /** Arc angle (rad) at tangentB, measured about `center`. */
  readonly endAngle: number;
  /** True when the minor arc from start→end runs clockwise (canvas `arc` flag). */
  readonly anticlockwise: boolean;
}

function norm2(x: number, y: number): { x: number; y: number } | null {
  const len = Math.hypot(x, y);
  if (len < 1e-9) return null;
  return { x: x / len, y: y / len };
}

/**
 * Resolve the bend that rounds the corner between two outward leg directions.
 * `dirA`/`dirB` are unit vectors pointing from the node along each pipe. Returns
 * `null` when the legs are (near-)collinear (a straight run needs no bend) or a
 * direction is degenerate.
 *
 * `diameter` is leg A's pipe diameter; `diameterB` (defaults to `diameter`) is leg
 * B's. When they differ this is a REDUCING elbow — the centreline radius is sized to
 * the LARGER pipe (Revit long-radius) and the swept tube tapers `radiusStart →
 * radiusEnd` from tangentA to tangentB.
 */
export function computeElbowBend(
  node: { x: number; y: number },
  dirA: { x: number; y: number },
  dirB: { x: number; y: number },
  diameter: number,
  bendFactor: number = DEFAULT_BEND_FACTOR,
  diameterB: number = diameter,
): ElbowBend | null {
  const a = norm2(dirA.x, dirA.y);
  const b = norm2(dirB.x, dirB.y);
  if (!a || !b || diameter <= 0 || diameterB <= 0) return null;

  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y));
  const phi = Math.acos(dot); // angle between the two outward legs
  // Collinear (straight pass-through) → no bend.
  if (phi > Math.PI - STRAIGHT_EPSILON_RAD || phi < STRAIGHT_EPSILON_RAD) return null;

  const half = phi / 2;
  const sinHalf = Math.sin(half);
  const tanHalf = Math.tan(half);
  if (sinHalf < 1e-6 || tanHalf < 1e-6) return null;

  // The bend radius follows the LARGER pipe so a reducing elbow stays roomy enough
  // for the big end (Revit sizes the elbow on its nominal/larger diameter).
  const maxDiameter = Math.max(diameter, diameterB);
  const R = bendFactor * maxDiameter;
  const tangentLen = R / tanHalf;
  const bis = norm2(a.x + b.x, a.y + b.y);
  if (!bis) return null;

  const center = { x: node.x + bis.x * (R / sinHalf), y: node.y + bis.y * (R / sinHalf) };
  const tangentA = { x: node.x + a.x * tangentLen, y: node.y + a.y * tangentLen };
  const tangentB = { x: node.x + b.x * tangentLen, y: node.y + b.y * tangentLen };

  const startAngle = Math.atan2(tangentA.y - center.y, tangentA.x - center.x);
  const endAngle = Math.atan2(tangentB.y - center.y, tangentB.x - center.x);
  let delta = endAngle - startAngle;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;

  return {
    center,
    centerRadius: R,
    outerRadius: R + maxDiameter / 2,
    innerRadius: Math.max(R - maxDiameter / 2, maxDiameter * 0.05),
    radiusStart: diameter / 2,
    radiusEnd: diameterB / 2,
    tangentLen,
    tangentA,
    tangentB,
    startAngle,
    endAngle,
    anticlockwise: delta < 0,
  };
}

/**
 * Tessellate the swept bend BODY into a closed plan polygon (outer arc forward +
 * inner arc back). Used as the 2D footprint so the existing fill/outline path and
 * the hit-test/bbox treat the real bend shape — not an axis-aligned box.
 */
export function tessellateBendFootprint(bend: ElbowBend, segments = 16): Point3D[] {
  const { center, centerRadius, radiusStart, radiusEnd, startAngle, endAngle, anticlockwise } = bend;
  let sweep = endAngle - startAngle;
  // Normalise the sweep to the same (minor) direction the arc is drawn in.
  if (anticlockwise && sweep > 0) sweep -= 2 * Math.PI;
  if (!anticlockwise && sweep < 0) sweep += 2 * Math.PI;

  const outer: Point3D[] = [];
  const inner: Point3D[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = startAngle + (sweep * i) / segments;
    const c = Math.cos(t);
    const s = Math.sin(t);
    // Pipe radius lerps along the arc so a reducing elbow narrows tangentA → tangentB
    // (uniform when radiusStart === radiusEnd → identical to a concentric elbow).
    const r = radiusStart + (radiusEnd - radiusStart) * (i / segments);
    const outerR = centerRadius + r;
    const innerR = Math.max(centerRadius - r, r * 0.1);
    outer.push({ x: center.x + outerR * c, y: center.y + outerR * s, z: 0 });
    inner.push({ x: center.x + innerR * c, y: center.y + innerR * s, z: 0 });
  }
  // Closed ring: outer forward, inner backward.
  return [...outer, ...inner.reverse()];
}
