/**
 * Pure handrail-extension helpers for `StairRenderer` (ADR-358 Phase 7b1).
 *
 * Extracted from `StairRenderer.ts` to keep it under the 500-line SRP limit
 * (N.7.1 / ADR-623 Φ2). Plan-view handrails share the stringer path; ADA-driven
 * extensions (305 mm top horizontal + one-tread bottom) extend the polyline past
 * the stringer ends along the local tangent. Kept pure (no canvas/`this`) so the
 * branches stay unit-testable in isolation.
 */
import type { Point3D } from '../../rendering/types/Types';

/** ADR-358 §3.6 + §5.1 — ADA top handrail extension is 305 mm horizontal. */
const ADA_TOP_EXTENSION_MM = 305;

export function pickTopExtensionMm(
  override: number | undefined,
  isAda: boolean,
): number {
  if (typeof override === 'number' && override > 0) return override;
  return isAda ? ADA_TOP_EXTENSION_MM : 0;
}

export function pickBottomExtensionMm(
  override: 'one-tread' | number | undefined,
  treadStepMm: number,
  isAda: boolean,
): number {
  if (typeof override === 'number' && override > 0) return override;
  if (override === 'one-tread') return treadStepMm;
  return isAda ? treadStepMm : 0;
}

/**
 * Extends a polyline past its first and last vertices along the local
 * tangent of the adjacent segment. Returns a NEW array; input untouched.
 * No-op when `front`/`back` are 0 or the polyline has < 2 points.
 */
export function extendPolylineEnds(
  poly: ReadonlyArray<Point3D>,
  topMm: number,
  bottomMm: number,
): ReadonlyArray<Point3D> {
  if (poly.length < 2) return poly;
  const head = poly[0];
  const next = poly[1];
  const tail = poly[poly.length - 1];
  const prev = poly[poly.length - 2];

  const result: Point3D[] = [];
  if (bottomMm > 0) {
    const ext = extendOutward(next, head, bottomMm);
    if (ext) result.push(ext);
  }
  for (const p of poly) result.push(p);
  if (topMm > 0) {
    const ext = extendOutward(prev, tail, topMm);
    if (ext) result.push(ext);
  }
  return result;
}

function extendOutward(
  inside: Point3D,
  edge: Point3D,
  distanceMm: number,
): Point3D | null {
  const dx = edge.x - inside.x;
  const dy = edge.y - inside.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uy = dy / len;
  return {
    x: edge.x + ux * distanceMm,
    y: edge.y + uy * distanceMm,
    z: edge.z,
  };
}
