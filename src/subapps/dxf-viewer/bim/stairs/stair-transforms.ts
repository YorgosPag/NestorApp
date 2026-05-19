/**
 * ADR-358 Phase 5c — Stair parametric transforms (G17).
 *
 * Pure functions: zero React / DOM / Firestore / canvas deps. Apply CAD
 * mirror / rotate / copy to `StairParams` preserving full parametric
 * editability — variants with `turnDirection`/`turnSequence`/signed
 * `winder.turnAngle` are auto-flipped on mirror to avoid the well-known
 * Revit bug (post-mirror loss of parametricity, ADR-358 §5.11 + §9.2 Q23).
 *
 * SSoT:
 *   - 2D reflection math via `utils/mirror-math` (`mirrorPoint`, `mirrorAngle`,
 *     `getAxisAngleDeg`, `MirrorAxis`).
 *   - 2D rotation math via `utils/rotation-math` (`rotatePoint`).
 *   - Angle normalization via `geometry-utils.normalizeAngleDeg`.
 *
 * z-coordinate is preserved across all three transforms (xy-plane operations).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.11 §9.2 Q23
 */

import type { Point2D, Point3D } from '../../rendering/types/Types';
import type {
  StairParams,
  StairTurnDirectionCW,
  StairTurnDirectionLR,
  StairVariantParams,
} from '../../bim/types/stair-types';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-utils';
import {
  getAxisAngleDeg,
  mirrorAngle,
  mirrorPoint,
  type MirrorAxis,
} from '../../utils/mirror-math';
import { rotatePoint } from '../../utils/rotation-math';

// ─── Point3D xy-plane primitives (z preserved) ───────────────────────────────

function mirrorPoint3D(p: Readonly<Point3D>, axis: MirrorAxis): Point3D {
  const m = mirrorPoint({ x: p.x, y: p.y }, axis);
  return { x: m.x, y: m.y, z: p.z };
}

function rotatePoint3D(
  p: Readonly<Point3D>,
  pivot: Readonly<Point2D>,
  angleDeg: number,
): Point3D {
  const r = rotatePoint({ x: p.x, y: p.y }, pivot, angleDeg);
  return { x: r.x, y: r.y, z: p.z };
}

function translatePoint3D(p: Readonly<Point3D>, delta: Readonly<Point2D>): Point3D {
  return { x: p.x + delta.x, y: p.y + delta.y, z: p.z };
}

// ─── Turn direction flippers (Q23 auto-flip semantics) ───────────────────────

function flipLR(d: StairTurnDirectionLR): StairTurnDirectionLR {
  return d === 'left' ? 'right' : 'left';
}

function flipCW(d: StairTurnDirectionCW): StairTurnDirectionCW {
  return d === 'cw' ? 'ccw' : 'cw';
}

// ─── Variant dispatch — MIRROR ──────────────────────────────────────────────

function mirrorVariant(
  v: Readonly<StairVariantParams>,
  axis: MirrorAxis,
): StairVariantParams {
  switch (v.kind) {
    case 'straight':
      return v;
    case 'l-shape':
    case 'u-shape':
      return { ...v, turnDirection: flipLR(v.turnDirection) };
    case 'gamma':
      return {
        ...v,
        turnSequence: [
          flipLR(v.turnSequence[0]),
          flipLR(v.turnSequence[1]),
        ] as const,
      };
    case 'spiral':
    case 'helical':
      return {
        ...v,
        centerPoint: mirrorPoint3D(v.centerPoint, axis),
        turnDirection: flipCW(v.turnDirection),
      };
    case 'elliptical':
      return {
        ...v,
        centerPoint: mirrorPoint3D(v.centerPoint, axis),
        turnDirection: flipCW(v.turnDirection),
        rotation: normalizeAngleDeg(
          mirrorAngle(v.rotation, getAxisAngleDeg(axis)),
        ),
      };
    case 'winder':
      return { ...v, turnAngle: -v.turnAngle };
    case 'triangular-fan':
      return {
        ...v,
        apexPoint: mirrorPoint3D(v.apexPoint, axis),
        turnDirection: flipCW(v.turnDirection),
      };
    case 'triangular-outline':
      return {
        ...v,
        triangleVertices: [
          mirrorPoint3D(v.triangleVertices[0], axis),
          mirrorPoint3D(v.triangleVertices[1], axis),
          mirrorPoint3D(v.triangleVertices[2], axis),
        ] as const,
        orientation: flipCW(v.orientation),
      };
    case 'sketch':
      return {
        ...v,
        walklinePath: v.walklinePath.map((p) => mirrorPoint3D(p, axis)),
      };
    case 'v-shape':
      // Mirroring flips the divergence direction → negate armAngleDeg.
      // Arm 0/1 swap so the visual mirror is correct across the axis.
      return {
        ...v,
        armAngleDeg: -v.armAngleDeg,
        armSplit: [v.armSplit[1], v.armSplit[0]] as const,
      };
    default: {
      const _exhaustive: never = v;
      return _exhaustive;
    }
  }
}

// ─── Variant dispatch — ROTATE ──────────────────────────────────────────────

function rotateVariant(
  v: Readonly<StairVariantParams>,
  pivot: Readonly<Point2D>,
  angleDeg: number,
): StairVariantParams {
  switch (v.kind) {
    case 'straight':
    case 'l-shape':
    case 'u-shape':
    case 'gamma':
    case 'winder':
    case 'v-shape':
      return v;
    case 'spiral':
    case 'helical':
      return { ...v, centerPoint: rotatePoint3D(v.centerPoint, pivot, angleDeg) };
    case 'elliptical':
      return {
        ...v,
        centerPoint: rotatePoint3D(v.centerPoint, pivot, angleDeg),
        rotation: normalizeAngleDeg(v.rotation + angleDeg),
      };
    case 'triangular-fan':
      return { ...v, apexPoint: rotatePoint3D(v.apexPoint, pivot, angleDeg) };
    case 'triangular-outline':
      return {
        ...v,
        triangleVertices: [
          rotatePoint3D(v.triangleVertices[0], pivot, angleDeg),
          rotatePoint3D(v.triangleVertices[1], pivot, angleDeg),
          rotatePoint3D(v.triangleVertices[2], pivot, angleDeg),
        ] as const,
      };
    case 'sketch':
      return {
        ...v,
        walklinePath: v.walklinePath.map((p) =>
          rotatePoint3D(p, pivot, angleDeg),
        ),
      };
    default: {
      const _exhaustive: never = v;
      return _exhaustive;
    }
  }
}

// ─── Variant dispatch — COPY (translate) ────────────────────────────────────

function copyVariant(
  v: Readonly<StairVariantParams>,
  delta: Readonly<Point2D>,
): StairVariantParams {
  switch (v.kind) {
    case 'straight':
    case 'l-shape':
    case 'u-shape':
    case 'gamma':
    case 'winder':
    case 'v-shape':
      return v;
    case 'spiral':
    case 'helical':
    case 'elliptical':
      return { ...v, centerPoint: translatePoint3D(v.centerPoint, delta) };
    case 'triangular-fan':
      return { ...v, apexPoint: translatePoint3D(v.apexPoint, delta) };
    case 'triangular-outline':
      return {
        ...v,
        triangleVertices: [
          translatePoint3D(v.triangleVertices[0], delta),
          translatePoint3D(v.triangleVertices[1], delta),
          translatePoint3D(v.triangleVertices[2], delta),
        ] as const,
      };
    case 'sketch':
      return {
        ...v,
        walklinePath: v.walklinePath.map((p) => translatePoint3D(p, delta)),
      };
    default: {
      const _exhaustive: never = v;
      return _exhaustive;
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Reflect a `StairParams` across the 2D axis defined by two points.
 *
 * Semantics (ADR-358 §9.2 Q23 — auto-flip, anti-Revit-bug):
 *   - `basePoint` reflected (z preserved).
 *   - `direction` reflected via `mirrorAngle(direction, axisAngleDeg)`.
 *   - Variant `turnDirection` (LR or CW) auto-flipped per kind.
 *   - `gamma.turnSequence` entries each LR-flipped.
 *   - `winder.turnAngle` (signed) negated.
 *   - `triangular-outline.orientation` CW-flipped.
 *   - `elliptical.rotation` mirrored.
 *   - Variant-internal points (`centerPoint`, `apexPoint`, `triangleVertices`,
 *     `walklinePath`) reflected.
 *
 * Idempotent: `mirror ∘ mirror ≡ identity` (within floating-point tolerance).
 */
export function mirrorStairParams(
  params: Readonly<StairParams>,
  axisStart: Readonly<Point2D>,
  axisEnd: Readonly<Point2D>,
): StairParams {
  const axis: MirrorAxis = { p1: axisStart, p2: axisEnd };
  const axisAngleDeg = getAxisAngleDeg(axis);
  return {
    ...params,
    basePoint: mirrorPoint3D(params.basePoint, axis),
    direction: normalizeAngleDeg(mirrorAngle(params.direction, axisAngleDeg)),
    variant: mirrorVariant(params.variant, axis),
  };
}

/**
 * Rotate a `StairParams` around a 2D pivot by `angleDeg` (positive = CCW).
 *
 *   - `basePoint` rotated (z preserved).
 *   - `direction += angleDeg`.
 *   - Variant-internal points rotated (`centerPoint`/`apexPoint`/
 *     `triangleVertices`/`walklinePath`).
 *   - `elliptical.rotation += angleDeg`.
 *   - `turnDirection`/`turnSequence` unchanged (rotation preserves chirality).
 *
 * Idempotent on angleDeg=0.
 */
export function rotateStairParams(
  params: Readonly<StairParams>,
  pivot: Readonly<Point2D>,
  angleDeg: number,
): StairParams {
  return {
    ...params,
    basePoint: rotatePoint3D(params.basePoint, pivot, angleDeg),
    direction: normalizeAngleDeg(params.direction + angleDeg),
    variant: rotateVariant(params.variant, pivot, angleDeg),
  };
}

/**
 * Translate a `StairParams` by a 2D delta (z preserved).
 *
 *   - `basePoint` translated, variant-internal points translated.
 *   - `direction`, `turnDirection`, `turnSequence` unchanged.
 *
 * Idempotent on delta={0,0}.
 */
export function copyStairParams(
  params: Readonly<StairParams>,
  delta: Readonly<Point2D>,
): StairParams {
  return {
    ...params,
    basePoint: translatePoint3D(params.basePoint, delta),
    variant: copyVariant(params.variant, delta),
  };
}
