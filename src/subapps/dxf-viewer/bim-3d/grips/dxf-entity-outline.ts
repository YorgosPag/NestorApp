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
import { circlePolyline, arcPolyline } from '../converters/dxf-arc-circle-sample';

/**
 * Plan-mm outline poly-lines of a raw DXF entity (one array per disjoint stroke), or `[]`
 * for an unsupported type. Mirrors the geometry of `DxfToThreeConverter.appendEntitySegments`.
 *
 * `unitToMm` (ADR-537 γ) scales the entity's native DXF coordinates to millimetres so the
 * outline aligns with the mm-based plan projector for non-mm scenes (cm / m / in / ft). It
 * defaults to `1` (mm scenes) — a no-op that keeps the geometry byte-identical.
 */
export function dxfEntityOutlineSegments(entity: DxfEntityUnion, unitToMm = 1): Point2D[][] {
  const s = (p: Point2D): Point2D => ({ x: p.x * unitToMm, y: p.y * unitToMm });
  switch (entity.type) {
    case 'line':
      return [[s(entity.start), s(entity.end)]];
    case 'polyline': {
      const pts = entity.vertices.map(s);
      if (entity.closed && pts.length > 1) pts.push({ x: pts[0].x, y: pts[0].y });
      return pts.length >= 2 ? [pts] : [];
    }
    case 'circle':
      return [circlePolyline(s(entity.center), entity.radius * unitToMm)];
    case 'arc':
      return [arcPolyline(s(entity.center), entity.radius * unitToMm, entity.startAngle, entity.endAngle, entity.counterclockwise)];
    default:
      return [];
  }
}
