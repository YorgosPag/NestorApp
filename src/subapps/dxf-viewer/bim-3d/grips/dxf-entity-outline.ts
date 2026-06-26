/**
 * dxf-entity-outline.ts — PURE plan-mm outline of a raw DXF entity for the 3D hover
 * glow overlay (ADR-538). Returns the entity's geometry as poly-lines (plan-mm point
 * lists) so the Canvas2D hover overlay can project + glow-stroke it with the SAME 2D
 * `drawEntityGlowPrePass` / `HOVER_HIGHLIGHT` SSoT.
 *
 * line / polyline / circle / arc (the types the 3D wireframe + ADR-537 picking cover).
 * Pure — no THREE, no React. Jest-friendly.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { DxfEntityUnion } from '../../canvas-v2/dxf-canvas/dxf-types';

/** Circle/arc sampling resolution (matches DxfToThreeConverter's 48-seg circle). */
const CIRCLE_SEGMENTS = 48;

/** Sample a full circle into a closed plan-mm poly-line. */
function circlePolyline(center: Point2D, radius: number): Point2D[] {
  const pts: Point2D[] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return pts;
}

/** Sample an arc (degrees, CCW from start→end) into a plan-mm poly-line. */
function arcPolyline(center: Point2D, radius: number, startDeg: number, endDeg: number): Point2D[] {
  const a0 = (startDeg * Math.PI) / 180;
  let a1 = (endDeg * Math.PI) / 180;
  if (a1 < a0) a1 += Math.PI * 2;
  const steps = Math.max(2, Math.ceil(((a1 - a0) / (Math.PI * 2)) * CIRCLE_SEGMENTS));
  const pts: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push({ x: center.x + radius * Math.cos(a), y: center.y + radius * Math.sin(a) });
  }
  return pts;
}

/**
 * Plan-mm outline poly-lines of a raw DXF entity (one array per disjoint stroke), or `[]`
 * for an unsupported type. Mirrors the geometry of `DxfToThreeConverter.appendEntitySegments`.
 */
export function dxfEntityOutlineSegments(entity: DxfEntityUnion): Point2D[][] {
  switch (entity.type) {
    case 'line':
      return [[entity.start, entity.end]];
    case 'polyline': {
      const pts = entity.vertices.map((v) => ({ x: v.x, y: v.y }));
      if (entity.closed && pts.length > 1) pts.push({ x: pts[0].x, y: pts[0].y });
      return pts.length >= 2 ? [pts] : [];
    }
    case 'circle':
      return [circlePolyline(entity.center, entity.radius)];
    case 'arc':
      return [arcPolyline(entity.center, entity.radius, entity.startAngle, entity.endAngle)];
    default:
      return [];
  }
}
