/**
 * ADR-561 — Oriented-rectangle detection for polylines (pure helpers).
 *
 * A DXF `rectangle`/`rect` scene entity normalises to a closed 4-vertex `polyline`
 * in the DXF pipeline (`dxf-scene-entity-converter` → `rectangleToVertices`), so
 * the polyline grip path owns ALL rectangles. When those 4 vertices actually form
 * a rectangle (right angles), Giorgio wants the rotation handle to sit on a fixed
 * side of the box and TILT with the shape — «rect-box parity» like the column /
 * text (Giorgio 2026-07-01). This module recovers the oriented `RectFrame` from
 * the vertices so `polyline-grips` can place the handle via the shared
 * `rect-frame` SSoT; a non-rectangular / non-4-vertex polyline returns `null`
 * and falls back to axis-aligned-bbox placement.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/rect-frame.ts — the shared `RectFrame` the caller places handles on
 * @see systems/polyline/polyline-grips.ts — the consumer (move + rotation placement)
 */

import type { Point2D } from '../../rendering/types/Types';
import type { RectFrame } from '../../bim/grips/rect-frame';

/** Axis-aligned bounding box of a vertex ring. */
export interface Bbox {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Axis-aligned bounding box of `vertices` (assumes ≥1 point). */
export function polylineBbox(vertices: readonly Point2D[]): Bbox {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Centre of the axis-aligned bounding box (the whole-polyline MOVE anchor). */
export function polylineBboxCenter(vertices: readonly Point2D[]): Point2D {
  const b = polylineBbox(vertices);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}

/** Minimal structural view of the scene shapes that carry a polyline vertex ring. */
interface RectOrPolylineShape {
  readonly type?: string;
  readonly vertices?: readonly Point2D[];
  readonly corner1?: Point2D;
  readonly corner2?: Point2D;
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
}

/**
 * ADR-561 — the SSoT vertex ring of a scene shape that behaves as a polyline in the
 * DXF pipeline: a `rectangle`/`rect` yields its 4 axis-aligned corners (from
 * `corner1`/`corner2` or `x`/`y`/`width`/`height`), any other shape yields its own
 * `vertices`. Returns `null` when neither is available. Consumed by BOTH the rotation
 * commit (`commitPolylineRotationGripDrag`) and the live rect-axis rotation reference
 * (`resolveRectRotationReference`), so the two can never disagree on «what ring is this».
 */
export function rectOrPolylineVertices(entity: unknown): Point2D[] | null {
  const e = entity as RectOrPolylineShape;
  if (e.type === 'rectangle' || e.type === 'rect') {
    if (e.corner1 && e.corner2) {
      return [
        e.corner1,
        { x: e.corner2.x, y: e.corner1.y },
        e.corner2,
        { x: e.corner1.x, y: e.corner2.y },
      ];
    }
    if (e.x != null && e.y != null && e.width != null && e.height != null) {
      const c1: Point2D = { x: e.x, y: e.y };
      const c2: Point2D = { x: e.x + e.width, y: e.y + e.height };
      return [c1, { x: c2.x, y: c1.y }, c2, { x: c1.x, y: c2.y }];
    }
    return null;
  }
  return e.vertices ? e.vertices.slice() : null;
}

/**
 * Drop a trailing vertex that just repeats the first (some closed rings duplicate
 * the start point). Returns the distinct-corner list.
 */
function distinctRing(vertices: readonly Point2D[]): Point2D[] {
  if (vertices.length >= 2) {
    const first = vertices[0];
    const last = vertices[vertices.length - 1];
    if (Math.abs(first.x - last.x) < 1e-9 && Math.abs(first.y - last.y) < 1e-9) {
      return vertices.slice(0, -1);
    }
  }
  return vertices.slice();
}

const RIGHT_ANGLE_COS_TOL = 1e-3; // |cos θ| ≤ tol ⇒ ~90° (robust to float drift)

/**
 * Recover the oriented `RectFrame` of a closed 4-corner polyline, or `null` when
 * it is not a rectangle (wrong corner count or a non-right angle). `rotationDeg`
 * comes from the first edge (v0→v1) so the frame's local +X runs along that edge;
 * `halfWidth` is half |v0→v1|, `halfLength` half |v0→v3|. Consumers read handle
 * positions via `rectLocalWorld` (shared `rect-frame` SSoT), so the rotation
 * handle tilts with the box exactly like the column / text.
 */
export function asOrientedRect(vertices: readonly Point2D[]): RectFrame | null {
  const ring = distinctRing(vertices);
  if (ring.length !== 4) return null;

  // All four interior angles must be right angles.
  for (let i = 0; i < 4; i++) {
    const prev = ring[(i + 3) % 4];
    const cur = ring[i];
    const next = ring[(i + 1) % 4];
    const ax = prev.x - cur.x, ay = prev.y - cur.y;
    const bx = next.x - cur.x, by = next.y - cur.y;
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) return null;
    const cos = (ax * bx + ay * by) / (la * lb);
    if (Math.abs(cos) > RIGHT_ANGLE_COS_TOL) return null;
  }

  const [v0, v1, , v3] = ring;
  const center: Point2D = {
    x: (ring[0].x + ring[1].x + ring[2].x + ring[3].x) / 4,
    y: (ring[0].y + ring[1].y + ring[2].y + ring[3].y) / 4,
  };
  const rotationDeg = Math.atan2(v1.y - v0.y, v1.x - v0.x) * (180 / Math.PI);
  const halfWidth = Math.hypot(v1.x - v0.x, v1.y - v0.y) / 2;
  const halfLength = Math.hypot(v3.x - v0.x, v3.y - v0.y) / 2;
  return { center, rotationDeg, halfWidth, halfLength };
}
