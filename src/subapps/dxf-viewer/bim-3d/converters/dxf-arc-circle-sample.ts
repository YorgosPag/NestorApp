/**
 * dxf-arc-circle-sample.ts — PURE plan-mm samplers for raw DXF circle / arc geometry.
 *
 * ONE canonical tessellation SSoT for the 3D DXF path, shared by ALL three consumers so
 * the wireframe, the hover outline, and the grip-drag ghost draw arcs/circles identically:
 *   - `DxfToThreeConverter.appendEntitySegments`  (the WebGL wireframe, ADR-366)
 *   - `dxf-entity-outline.ts`                     (3D hover glow, ADR-538)
 *   - `dxf-grip-ghost-paint.ts`                   (grip-drag live ghost, ADR-537)
 *
 * `arcPolyline` honours the DXF `counterclockwise` flag (and its `!== false` default) and
 * uses the same 48-seg full-circle resolution + signed-sweep normalisation everywhere, so a
 * clockwise arc — which a naive CCW-only sampler draws the long way round — is faithful.
 *
 * Pure — no THREE, no React, no canvas. Jest-friendly.
 */

import type { Point2D } from '../../rendering/types/Types';

/** Full-circle approximation segment count. */
const CIRCLE_SEGMENTS = 48;
const DEG2RAD = Math.PI / 180;
const TAU = Math.PI * 2;

/** Sample a full circle into a closed plan-mm poly-line (start = end = (cx+r, cy)). */
export function circlePolyline(center: Point2D, radius: number): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * TAU;
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return pts;
}

/**
 * Sample an arc (angles in DEGREES) into a plan-mm poly-line, honouring the DXF
 * `counterclockwise` flag. `counterclockwise` defaults to true (`!== false`) to match the
 * DXF back-compat assumption.
 */
export function arcPolyline(
  center: Point2D,
  radius: number,
  startDeg: number,
  endDeg: number,
  counterclockwise?: boolean,
): Point2D[] {
  const startRad = startDeg * DEG2RAD;
  const endRad = endDeg * DEG2RAD;
  const ccw = counterclockwise !== false;
  let sweep = endRad - startRad;
  if (ccw) {
    if (sweep <= 0) sweep += TAU;
  } else if (sweep >= 0) {
    sweep -= TAU;
  }
  const segs = Math.max(4, Math.round((Math.abs(sweep) / TAU) * CIRCLE_SEGMENTS));
  const pts: Point2D[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = startRad + sweep * (i / segs);
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return pts;
}
