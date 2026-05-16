/**
 * ADR-358 Phase 2a + 2b — Curve sampling math for spiral / helical /
 * elliptical stairs.
 *
 * Pure functions (no DOM / React / DXF deps). Arc-length parameterization
 * yields uniform tread spacing along the walkline — industry standard for
 * curved stairs (Revit, ArchiCAD, AutoCAD Architecture).
 *
 * Phase 2a scope: `spiralSample` + `helixSample`.
 * Phase 2b scope: `ellipseArcLength` + `ellipseSample`.
 * Tread placement (Polygon3D treads) lands in Phase 4a inside
 * `StairGeometryService`.
 *
 * Conventions:
 *   - Plan view: +X right, +Y up. ccw rotation = positive angle (math).
 *   - cw stairs use sign = -1 (clockwise plan-view).
 *   - Unit Archimedean spiral: r(θ) = θ (caller scales radial output).
 *   - z grows linearly: zᵢ = centerPoint.z + (i / stepCount) · totalRise.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.4 §6.3
 */

import type { Point3D } from '../../types/Types';

const DEG2RAD = Math.PI / 180;
const BISECTION_MAX_ITER = 60;
const BISECTION_EPS = 1e-14;
const ELLIPSE_SIMPSON_SUBINTERVALS = 256;

/** Plan-view turn direction sign: ccw = +1 (math CCW), cw = -1 (clockwise). */
function turnSign(dir: 'cw' | 'ccw'): 1 | -1 {
  return dir === 'ccw' ? 1 : -1;
}

/**
 * Arc length of unit Archimedean spiral r(θ) = θ from 0 to `theta`.
 *
 * Analytical: ∫₀^θ √(r² + (dr/dθ)²) dθ = ∫₀^θ √(θ² + 1) dθ
 *           = ½ · [ θ · √(θ² + 1) + asinh(θ) ]
 *
 * Reference: https://en.wikipedia.org/wiki/Archimedean_spiral (arc length).
 */
export function archimedeanArcLength(theta: number): number {
  return 0.5 * (theta * Math.sqrt(theta * theta + 1) + Math.asinh(theta));
}

/**
 * Invert `archimedeanArcLength`: find θ ∈ [0, thetaMax] s.t. L(θ) = s.
 *
 * Bisection — monotonically increasing function, guaranteed convergence
 * to double-precision tolerance in ≤ 60 iterations.
 */
function archimedeanThetaAt(s: number, thetaMax: number): number {
  let lo = 0;
  let hi = thetaMax;
  for (let i = 0; i < BISECTION_MAX_ITER; i++) {
    const mid = (lo + hi) * 0.5;
    if (archimedeanArcLength(mid) < s) lo = mid;
    else hi = mid;
    if (hi - lo < BISECTION_EPS) break;
  }
  return (lo + hi) * 0.5;
}

/**
 * Sample unit Archimedean spiral with arc-length parameterization.
 *
 * Returns `stepCount + 1` points (apex → outer end, inclusive). Sample 0
 * sits exactly on `centerPoint`; each subsequent sample advances by equal
 * arc length along the spiral and equal z rise. The spiral grows from
 * r = 0 outward — `outerRadius` per step is the derived r(θᵢ).
 *
 * Phase 4a `StairGeometryService` (kind 'spiral') scales the xy plane to
 * the actual stair footprint and offsets the walkline by `walklineOffset`.
 *
 * @param centerPoint    Spiral apex (3D anchor in stair-local frame).
 * @param sweepAngle     Total sweep in degrees (e.g. 360 = full turn).
 * @param turnDirection  Plan-view rotation: `'cw'` or `'ccw'`.
 * @param stepCount      Number of treads (≥ 1). Result length = stepCount + 1.
 * @param totalRise      Vertical climb in the same unit as `centerPoint.z`.
 */
export function spiralSample(
  centerPoint: Readonly<Point3D>,
  sweepAngle: number,
  turnDirection: 'cw' | 'ccw',
  stepCount: number,
  totalRise: number,
): readonly Point3D[] {
  const thetaMax = sweepAngle * DEG2RAD;
  const sTotal = archimedeanArcLength(thetaMax);
  const sign = turnSign(turnDirection);
  const riseStep = totalRise / stepCount;
  const out: Point3D[] = new Array(stepCount + 1);
  for (let i = 0; i <= stepCount; i++) {
    const theta =
      i === 0 ? 0
      : i === stepCount ? thetaMax
      : archimedeanThetaAt((i / stepCount) * sTotal, thetaMax);
    const angle = sign * theta;
    out[i] = {
      x: centerPoint.x + theta * Math.cos(angle),
      y: centerPoint.y + theta * Math.sin(angle),
      z: centerPoint.z + i * riseStep,
    };
  }
  return out;
}

/**
 * Sample a circular helix (open-well stair) along its walkline at radius
 * `(innerRadius + outerRadius) / 2`. Arc-length parameterization on a
 * constant-radius walkline reduces to uniform angular spacing
 * (ds = R · dθ for fixed R).
 *
 * Returns `stepCount + 1` points (start at angle 0 → end at sign · sweepRad).
 * z grows linearly from `centerPoint.z` to `centerPoint.z + totalRise`.
 *
 * Constraint enforced by §5.1 panel UI: `outerRadius = innerRadius + width`.
 * This function trusts the caller — no runtime check (panel-side validation).
 *
 * @param centerPoint    Helix axis center (z = base of stair).
 * @param innerRadius    Inner well edge (≥ 0).
 * @param outerRadius    Outer edge (> innerRadius).
 * @param sweepAngle     Total sweep in degrees.
 * @param turnDirection  Plan-view rotation: `'cw'` or `'ccw'`.
 * @param stepCount      Number of treads (≥ 1). Result length = stepCount + 1.
 * @param totalRise      Vertical climb (same unit as `centerPoint.z`).
 */
export function helixSample(
  centerPoint: Readonly<Point3D>,
  innerRadius: number,
  outerRadius: number,
  sweepAngle: number,
  turnDirection: 'cw' | 'ccw',
  stepCount: number,
  totalRise: number,
): readonly Point3D[] {
  const walklineRadius = (innerRadius + outerRadius) * 0.5;
  const sweepRad = sweepAngle * DEG2RAD;
  const sign = turnSign(turnDirection);
  const angleStep = (sign * sweepRad) / stepCount;
  const riseStep = totalRise / stepCount;
  const out: Point3D[] = new Array(stepCount + 1);
  for (let i = 0; i <= stepCount; i++) {
    const angle = i * angleStep;
    out[i] = {
      x: centerPoint.x + walklineRadius * Math.cos(angle),
      y: centerPoint.y + walklineRadius * Math.sin(angle),
      z: centerPoint.z + i * riseStep,
    };
  }
  return out;
}

/**
 * Incomplete elliptic integral of the 2nd kind for an ellipse with semi-axes
 * `semiMajor` (a) and `semiMinor` (b), evaluated from parameter 0 to `theta`:
 *
 *     L(θ) = ∫₀^θ √( a²·sin²(t) + b²·cos²(t) ) dt
 *
 * No closed-form solution exists for arbitrary (a, b). Evaluated by composite
 * Simpson's rule over `ELLIPSE_SIMPSON_SUBINTERVALS` even subintervals — error
 * O((θ/N)⁴·max|f⁽⁴⁾|), well below 1e-6 for typical stair sweeps.
 *
 * Degenerate cases:
 *   - a === b (circle) → reduces to R·|θ|, returned exactly without integration.
 *   - θ === 0 → 0.
 *   - θ < 0 → uses |θ| (arc length is unsigned).
 *
 * Reference: https://en.wikipedia.org/wiki/Ellipse#Arc_length
 */
export function ellipseArcLength(
  semiMajor: number,
  semiMinor: number,
  theta: number,
): number {
  const t = Math.abs(theta);
  if (t === 0) return 0;
  if (semiMajor === semiMinor) return semiMajor * t;
  const a2 = semiMajor * semiMajor;
  const b2 = semiMinor * semiMinor;
  const n = ELLIPSE_SIMPSON_SUBINTERVALS;
  const h = t / n;
  const integrand = (u: number): number => {
    const su = Math.sin(u);
    const cu = Math.cos(u);
    return Math.sqrt(a2 * su * su + b2 * cu * cu);
  };
  let sum = integrand(0) + integrand(t);
  for (let i = 1; i < n; i++) {
    sum += (i % 2 === 0 ? 2 : 4) * integrand(i * h);
  }
  return (h / 3) * sum;
}

/** Invert `ellipseArcLength`: find θ ∈ [0, thetaMax] s.t. L(θ) = s. */
function ellipseThetaAt(
  s: number,
  thetaMax: number,
  semiMajor: number,
  semiMinor: number,
): number {
  let lo = 0;
  let hi = thetaMax;
  for (let i = 0; i < BISECTION_MAX_ITER; i++) {
    const mid = (lo + hi) * 0.5;
    if (ellipseArcLength(semiMajor, semiMinor, mid) < s) lo = mid;
    else hi = mid;
    if (hi - lo < BISECTION_EPS) break;
  }
  return (lo + hi) * 0.5;
}

/**
 * Sample an elliptical helix (axis-aligned ellipse, then rotated + translated)
 * with arc-length parameterization. Used by Phase 4b `StairGeometryService`
 * kind `'elliptical'`.
 *
 * Local ellipse (before rotation/translation):
 *     x(t) = semiMajor · cos(t)
 *     y(t) = semiMinor · sin(t)        (t multiplied by `sign` for cw/ccw)
 *
 * Sample 0 sits at `centerPoint + (semiMajor, 0)` rotated by `rotation`.
 * Each subsequent sample advances by equal arc length along the ellipse, and z
 * grows linearly to `centerPoint.z + totalRise`.
 *
 * @param centerPoint    Ellipse center (3D anchor in stair-local frame).
 * @param semiMajor      a-axis half-length (> 0).
 * @param semiMinor      b-axis half-length (> 0).
 * @param sweepAngle     Total parametric sweep in degrees (e.g. 360 = full).
 * @param turnDirection  Plan-view rotation: `'cw'` or `'ccw'`.
 * @param rotation       Rotation of the ellipse around `centerPoint`, in degrees.
 * @param stepCount      Number of treads (≥ 1). Result length = stepCount + 1.
 * @param totalRise      Vertical climb (same unit as `centerPoint.z`).
 */
export function ellipseSample(
  centerPoint: Readonly<Point3D>,
  semiMajor: number,
  semiMinor: number,
  sweepAngle: number,
  turnDirection: 'cw' | 'ccw',
  rotation: number,
  stepCount: number,
  totalRise: number,
): readonly Point3D[] {
  const thetaMax = sweepAngle * DEG2RAD;
  const sTotal = ellipseArcLength(semiMajor, semiMinor, thetaMax);
  const sign = turnSign(turnDirection);
  const rotRad = rotation * DEG2RAD;
  const cosR = Math.cos(rotRad);
  const sinR = Math.sin(rotRad);
  const riseStep = totalRise / stepCount;
  const out: Point3D[] = new Array(stepCount + 1);
  for (let i = 0; i <= stepCount; i++) {
    const theta =
      i === 0 ? 0
      : i === stepCount ? thetaMax
      : ellipseThetaAt((i / stepCount) * sTotal, thetaMax, semiMajor, semiMinor);
    const xLocal = semiMajor * Math.cos(theta);
    const yLocal = sign * semiMinor * Math.sin(theta);
    out[i] = {
      x: centerPoint.x + xLocal * cosR - yLocal * sinR,
      y: centerPoint.y + xLocal * sinR + yLocal * cosR,
      z: centerPoint.z + i * riseStep,
    };
  }
  return out;
}
