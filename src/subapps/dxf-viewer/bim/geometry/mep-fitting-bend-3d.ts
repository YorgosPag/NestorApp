/**
 * ADR-408 Φ-B2b — 3D pipe-bend centreline SSoT (Revit-grade tilted elbow).
 *
 * The 2D `mep-fitting-bend.ts` rounds a corner in the PLAN plane — correct for the
 * top-down footprint, but a fitting on SLOPED/riser pipes (ADR-408 Φ-A per-endpoint
 * z) must bend in the real 3D plane of the two pipes, otherwise its faces sit flat
 * while the pipes tilt away (the joint gaps). This pure helper builds the bend
 * centreline as a true circular arc in the plane spanned by the two 3D incident
 * directions, tangent to both legs at exactly `dir · tangentLen` — the SAME tangent
 * length the segment trim uses, so the fitting meets each trimmed pipe end exactly.
 *
 * UNIT-AGNOSTIC & PURE (same contract as the 2D bend): the directions are unit
 * vectors, `tangentLen` is in the caller's unit, and the samples come back in that
 * unit with the node at the origin. The 3D converter passes WORLD-oriented unit
 * directions → world-local samples it sweeps into a tube. No store / THREE / React.
 *
 * Geometry (mirrors the 2D long-radius construction, lifted to 3D):
 *   - `φ`        = angle between the two OUTWARD leg directions (π ⇒ straight).
 *   - `R`        = bend centreline radius = `tangentLen · tan(φ/2)` (so the arc is
 *                  tangent to each leg at `dir · tangentLen` — the trim point).
 *   - `center`   = node + bisector · (R / sin(φ/2)).
 *   - arc        = slerp of `(tangentA − center)` → `(tangentB − center)` (radius R).
 *
 * @see ./mep-fitting-bend.ts — the 2D (plan) counterpart this lifts to 3D
 * @see ../../bim-3d/converters/mep-fitting-to-mesh.ts — the consumer
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ-B2b
 */

import type { Point3D } from '../types/bim-base';

/** Below/above this angle from straight (rad) the legs need no arc. */
const STRAIGHT_EPSILON_RAD = 0.05;

interface V3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const v3 = (p: { x: number; y: number; z?: number }): V3 => ({ x: p.x, y: p.y, z: p.z ?? 0 });
const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const scale = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (a: V3): number => Math.hypot(a.x, a.y, a.z);
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

function normalize(a: V3): V3 | null {
  const len = length(a);
  return len < 1e-9 ? null : scale(a, 1 / len);
}

/** Spherical interpolation of two equal-length vectors (linear fallback when ~parallel). */
function slerp(a: V3, b: V3, t: number): V3 {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return add(scale(a, 1 - t), scale(b, t));
  const omega = Math.acos(clamp(dot(na, nb), -1, 1));
  if (omega < 1e-6) return add(scale(a, 1 - t), scale(b, t));
  const so = Math.sin(omega);
  return add(scale(a, Math.sin((1 - t) * omega) / so), scale(b, Math.sin(t * omega) / so));
}

const toPoint = (a: V3): Point3D => ({ x: a.x, y: a.y, z: a.z });

/**
 * Sample the 3D bend centreline (node at the origin) between two outward unit
 * directions. Returns `segments + 1` points from tangentA → tangentB. A
 * (near-)collinear or degenerate input yields a straight 2-point stub
 * (`tangentA → tangentB`) so the caller still sweeps a valid tube.
 */
export function computeBend3DArcPoints(
  dirAIn: Point3D,
  dirBIn: Point3D,
  tangentLen: number,
  segments = 16,
): Point3D[] {
  const dirA = normalize(v3(dirAIn));
  const dirB = normalize(v3(dirBIn));
  if (!dirA || !dirB || tangentLen <= 0) {
    const a = dirA ? scale(dirA, Math.max(tangentLen, 0)) : v3(dirAIn);
    const b = dirB ? scale(dirB, Math.max(tangentLen, 0)) : v3(dirBIn);
    return [toPoint(a), toPoint(b)];
  }

  const tangentA = scale(dirA, tangentLen);
  const tangentB = scale(dirB, tangentLen);

  const phi = Math.acos(clamp(dot(dirA, dirB), -1, 1));
  const bis = normalize(add(dirA, dirB));
  if (phi < STRAIGHT_EPSILON_RAD || phi > Math.PI - STRAIGHT_EPSILON_RAD || !bis) {
    return [toPoint(tangentA), toPoint(tangentB)];
  }

  const half = phi / 2;
  const R = tangentLen * Math.tan(half);
  const center = scale(bis, R / Math.sin(half));
  const vA = sub(tangentA, center);
  const vB = sub(tangentB, center);

  const pts: Point3D[] = [];
  for (let i = 0; i <= segments; i++) {
    pts.push(toPoint(add(center, slerp(vA, vB, i / segments))));
  }
  return pts;
}
