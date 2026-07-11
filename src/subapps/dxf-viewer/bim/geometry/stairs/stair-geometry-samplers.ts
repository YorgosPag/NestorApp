/**
 * Per-kind tread / curve samplers (ADR-611) — extracted from
 * `stair-geometry-generators.ts` to keep that module under the 500-line cap.
 *
 * Two families of geometric samplers that the polar (spiral / helical /
 * triangular-fan) and walkline-following (elliptical / sketch /
 * triangular-outline) kind computers inject into the shared assembler:
 *
 *   • **Polar grid** — angular grid + radial point / tangent samplers.
 *   • **Walkline-following** — chord-perpendicular wedge treads, diagonal
 *     risers, and the first-crossing cut-line.
 *
 * Re-exported from `stair-geometry-generators.ts` for backward compatibility, so
 * existing import sites are unaffected.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-611-stair-geometry-generators-ssot.md
 */

import type { Point3D } from '../../../rendering/types/Types';
import type { Polygon3D, Segment3D, StairTurnDirectionCW } from '../../../bim/types/stair-types';
import { type Vec2, perp, point, buildCutLine } from './stair-geometry-shared';

const DEG2RAD = Math.PI / 180;

// ─── Polar grid (radial / angular kinds) ──────────────────────────────────────

export interface AngularGrid {
  readonly sign: 1 | -1;
  readonly angleStep: number;
  readonly riseStep: number;
}

/**
 * Angular grid for radial stairs: `sign` = +1 for `ccw`, −1 for `cw`;
 * `angleStep` = signed sweep divided over the steps; `riseStep` = per-step rise.
 * Shared by spiral (`sweepAngle`), helical (`sweepAngle`), triangular-fan
 * (`openingAngle`).
 */
export function buildAngularGrid(
  sweepAngleDeg: number,
  turnDirection: StairTurnDirectionCW,
  stepCount: number,
  rise: number,
): AngularGrid {
  const sign: 1 | -1 = turnDirection === 'ccw' ? 1 : -1;
  const sweepRad = sweepAngleDeg * DEG2RAD;
  return { sign, angleStep: (sign * sweepRad) / stepCount, riseStep: rise };
}

/** Point on a circle of radius `radius` at angle `theta` about `center`, at `z`. */
export function radialPoint(
  center: Readonly<Point3D>,
  radius: number,
  theta: number,
  z: number,
): Point3D {
  return point(
    center.x + radius * Math.cos(theta),
    center.y + radius * Math.sin(theta),
    z,
  );
}

/** Unit tangent of the radial parametrization at `theta` (sign flips for cw sweep). */
export function radialTangentAt(theta: number, sign: 1 | -1): Vec2 {
  // d/dθ (cos θ, sin θ) = (-sin θ, cos θ). Sign flips for cw sweep.
  return { x: -sign * Math.sin(theta), y: sign * Math.cos(theta) };
}

/**
 * One radial tread/landing quad, flat at `z`, spanning `[theta0, theta1]`. `apex`
 * collapses the inner edge to the centre point (spiral / triangular-fan → triangle);
 * otherwise an annular quad at `[innerRadius, outerRadius]` (helical). Winding is
 * `sign`-oriented (ccw = +1). SSoT sector — shared by `buildRadialTreads` and the
 * rest-landing sector (ADR-637 Φ3 radial): a landing is just a sector swept over a
 * wider angle at constant `z`, so no new tread/landing math (N.18).
 */
export function radialSector(
  center: Readonly<Point3D>,
  innerRadius: number,
  outerRadius: number,
  theta0: number,
  theta1: number,
  z: number,
  apex: boolean,
  sign: 1 | -1,
): Polygon3D {
  const outerA = radialPoint(center, outerRadius, theta0, z);
  const outerB = radialPoint(center, outerRadius, theta1, z);
  if (apex) {
    const apexPt = point(center.x, center.y, z);
    return sign === 1 ? [apexPt, outerA, outerB] : [apexPt, outerB, outerA];
  }
  const innerA = radialPoint(center, innerRadius, theta0, z);
  const innerB = radialPoint(center, innerRadius, theta1, z);
  return sign === 1 ? [innerA, outerA, outerB, innerB] : [innerB, outerB, outerA, innerA];
}

/**
 * One diagonal radial riser (ADR-370 Phase 5.3) at boundary `theta`, spanning the
 * radial width from `zLow` (inner edge) to `zHigh` (outer edge). SSoT — shared by
 * `buildRadialRisers` and the rest-landing walk.
 */
export function radialRiser(
  center: Readonly<Point3D>,
  innerRadius: number,
  outerRadius: number,
  theta: number,
  zLow: number,
  zHigh: number,
): Segment3D {
  return {
    start: radialPoint(center, innerRadius, theta, zLow),
    end: radialPoint(center, outerRadius, theta, zHigh),
  };
}

// ─── Walkline-following kinds (chord-perpendicular wedges) ─────────────────────

/** Normalized chord tangent from `a` to `b`; falls back to +X for a zero chord. */
export function chordTangent(a: Readonly<Point3D>, b: Readonly<Point3D>): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

/**
 * Wedge treads that follow a walkline, extending ±`width/2` along the local
 * chord-perpendicular. `sign = +1` → `[innerA, outerA, outerB, innerB]`;
 * `sign = -1` → reversed winding. Shared by elliptical (signed) and sketch
 * (`sign = +1`).
 */
export function buildWalklineTreads(
  walkline: readonly Point3D[],
  width: number,
  sign: 1 | -1,
): readonly Polygon3D[] {
  const halfW = width * 0.5;
  const stepCount = walkline.length - 1;
  const treads: Polygon3D[] = new Array(stepCount);
  for (let i = 0; i < stepCount; i++) {
    const n = perp(chordTangent(walkline[i], walkline[i + 1]));
    const z = walkline[i].z;
    const innerA = point(walkline[i].x - halfW * n.x, walkline[i].y - halfW * n.y, z);
    const outerA = point(walkline[i].x + halfW * n.x, walkline[i].y + halfW * n.y, z);
    const innerB = point(walkline[i + 1].x - halfW * n.x, walkline[i + 1].y - halfW * n.y, z);
    const outerB = point(walkline[i + 1].x + halfW * n.x, walkline[i + 1].y + halfW * n.y, z);
    treads[i] = sign === 1
      ? [innerA, outerA, outerB, innerB]
      : [innerB, outerB, outerA, innerA];
  }
  return treads;
}

/**
 * Diagonal risers (ADR-370 Phase 5.3) for a walkline-following flight: at each
 * interior boundary i+1, the riser spans the chord-perpendicular width edges,
 * rising from tread i to tread i+1. `sign = +1` places the inner edge on the
 * −perp side (sketch convention); `sign = -1` flips it (elliptical cw). Shared
 * by elliptical and sketch — sketch is exactly the `sign = +1` case.
 */
export function buildWalklineRisers(
  walkline: readonly Point3D[],
  width: number,
  sign: 1 | -1,
): readonly Segment3D[] {
  const halfW = width * 0.5;
  const stepCount = walkline.length - 1;
  const innerSign = sign === 1 ? -1 : 1;
  const risers: Segment3D[] = [];
  for (let i = 0; i < stepCount - 1; i++) {
    const nNext = perp(chordTangent(walkline[i + 1], walkline[i + 2]));
    const ix = walkline[i + 1].x + innerSign * halfW * nNext.x;
    const iy = walkline[i + 1].y + innerSign * halfW * nNext.y;
    const ox = walkline[i + 1].x - innerSign * halfW * nNext.x;
    const oy = walkline[i + 1].y - innerSign * halfW * nNext.y;
    risers.push({
      start: point(ix, iy, walkline[i].z),
      end: point(ox, oy, walkline[i + 1].z),
    });
  }
  return risers;
}

/**
 * cutLine perpendicular to the first walkline chord crossing `cutPlaneHeight`,
 * emitted at the chord midpoint. Shared by elliptical and sketch.
 */
export function buildWalklineCutLine(
  walkline: readonly Point3D[],
  width: number,
  cutPlaneHeight: number,
): Segment3D | undefined {
  for (let i = 0; i < walkline.length - 1; i++) {
    if (walkline[i].z >= cutPlaneHeight) {
      const tangent = chordTangent(walkline[i], walkline[i + 1]);
      const mx = (walkline[i].x + walkline[i + 1].x) * 0.5;
      const my = (walkline[i].y + walkline[i + 1].y) * 0.5;
      const tread: Polygon3D = [
        point(mx, my, cutPlaneHeight),
        point(mx, my, cutPlaneHeight),
        point(mx, my, cutPlaneHeight),
        point(mx, my, cutPlaneHeight),
      ];
      return buildCutLine(tread, tangent, width, cutPlaneHeight);
    }
  }
  return undefined;
}
