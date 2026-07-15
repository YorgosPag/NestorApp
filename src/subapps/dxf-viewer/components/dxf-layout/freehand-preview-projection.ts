/**
 * freehand-preview-projection — SSoT world→screen helpers for freehand trace previews (ADR-658).
 *
 * Shared by the lasso-crop and «Μολύβι» sketch preview leaves so neither re-implements the
 * per-point `worldToScreen` projection (N.18 — no parallel twins). Pure functions, no React.
 */
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { ViewTransform, Point2D } from '../../rendering/types/Types';

/** Projects a world-space freehand trace to screen-space points. */
export function traceToScreenPoints(
  points: ReadonlyArray<readonly [number, number]>,
  transform: ViewTransform,
  viewport: { width: number; height: number },
): Point2D[] {
  return points.map(([wx, wy]) =>
    CoordinateTransforms.worldToScreen({ x: wx, y: wy }, transform, viewport),
  );
}

/** Serialises screen points into an SVG `<polyline points>` string. */
export function screenPointsToPolylineStr(screenPts: ReadonlyArray<Point2D>): string {
  return screenPts.map((p) => `${p.x},${p.y}`).join(' ');
}

export interface FreehandScreenGeometry {
  readonly screenPts: Point2D[];
  readonly polylineStr: string;
  readonly first: Point2D;
  readonly last: Point2D;
}

/**
 * Derives the screen-space geometry a freehand preview leaf needs (projected points,
 * polyline string, first/last endpoints). Returns null for a degenerate trace (< 2 pts).
 * SSoT setup shared by the lasso + sketch preview leaves (N.18 — no parallel twins).
 */
export function freehandScreenGeometry(
  points: ReadonlyArray<readonly [number, number]>,
  transform: ViewTransform,
  viewport: { width: number; height: number },
): FreehandScreenGeometry | null {
  if (points.length < 2) return null;
  const screenPts = traceToScreenPoints(points, transform, viewport);
  return {
    screenPts,
    polylineStr: screenPointsToPolylineStr(screenPts),
    first: screenPts[0],
    last: screenPts[screenPts.length - 1],
  };
}
