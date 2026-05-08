/**
 * 🔷 ENTITY → OVERLAY GEOMETRY MAPPER (ADR-340 Phase 9 STEP G)
 *
 * Pure mapping from a DXF Viewer drawing `Entity` (produced by
 * `createEntityFromToolPure`) plus its originating `tool` to a canonical
 * `OverlayGeometry` discriminated value, ready to be persisted via the
 * floorplan-overlay-mutation-gateway.
 *
 * Tool → geometry mapping table (handoff §Decisions, do not alter):
 *
 *   line / measure-distance / measure-distance-continuous → line
 *   rectangle                                             → polygon (4-vertex, closed)
 *   circle (8 variants)                                   → circle
 *   arc-3p / arc-cse / arc-sce                            → arc
 *   polyline                                              → polygon (closed:false)
 *   polygon                                               → polygon (closed:true)
 *   measure-area                                          → measurement (mode:'area')
 *   measure-angle (5 variants)                            → measurement (mode:'angle')
 *
 * @see src/types/floorplan-overlays.ts — geometry SSoT
 */

import type { Entity } from '../../types/entities';
import type { DrawingTool } from './drawing-types';
import type { OverlayGeometry } from '@/types/floorplan-overlays';

const ANGLE_TOOLS: ReadonlySet<DrawingTool> = new Set([
  'measure-angle',
  'measure-angle-line-arc',
  'measure-angle-two-arcs',
  'measure-angle-measuregeom',
  'measure-angle-constraint',
]);

const CIRCLE_TOOLS: ReadonlySet<DrawingTool> = new Set([
  'circle',
  'circle-diameter',
  'circle-2p-diameter',
  'circle-3p',
  'circle-chord-sagitta',
  'circle-2p-radius',
  'circle-best-fit',
]);

const ARC_TOOLS: ReadonlySet<DrawingTool> = new Set([
  'arc-3p',
  'arc-cse',
  'arc-sce',
]);

const DISTANCE_TOOLS: ReadonlySet<DrawingTool> = new Set([
  'measure-distance',
  'measure-distance-continuous',
]);

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function polygonArea(vertices: Array<{ x: number; y: number }>): number {
  let sum = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function rectangleVertices(e: Extract<Entity, { type: 'rectangle' }>): Array<{ x: number; y: number }> {
  const c1 = e.corner1 ?? { x: e.x, y: e.y };
  const c2 = e.corner2 ?? { x: e.x + e.width, y: e.y + e.height };
  return [
    { x: c1.x, y: c1.y },
    { x: c2.x, y: c1.y },
    { x: c2.x, y: c2.y },
    { x: c1.x, y: c2.y },
  ];
}

/**
 * Map a (tool, entity) pair to a canonical `OverlayGeometry`. Returns `null`
 * for unsupported / malformed inputs (caller skips persistence).
 */
export function entityToGeometry(
  entity: Entity,
  tool: DrawingTool,
): OverlayGeometry | null {
  if (CIRCLE_TOOLS.has(tool) && entity.type === 'circle') {
    return { type: 'circle', center: entity.center, radius: entity.radius };
  }

  if (ARC_TOOLS.has(tool) && entity.type === 'arc') {
    return {
      type: 'arc',
      center: entity.center,
      radius: entity.radius,
      startAngle: entity.startAngle,
      endAngle: entity.endAngle,
      ...(typeof entity.counterclockwise === 'boolean'
        ? { counterclockwise: entity.counterclockwise }
        : {}),
    };
  }

  if (tool === 'rectangle' && entity.type === 'rectangle') {
    return { type: 'polygon', vertices: rectangleVertices(entity), closed: true };
  }

  if (tool === 'polyline' && entity.type === 'polyline') {
    return { type: 'polygon', vertices: [...entity.vertices], closed: false };
  }

  if (tool === 'polygon' && entity.type === 'polyline') {
    return { type: 'polygon', vertices: [...entity.vertices], closed: true };
  }

  if (tool === 'line' && entity.type === 'line') {
    return { type: 'line', start: entity.start, end: entity.end };
  }

  if (DISTANCE_TOOLS.has(tool) && entity.type === 'line') {
    const value = distance(entity.start, entity.end);
    return {
      type: 'measurement',
      points: [entity.start, entity.end],
      mode: 'distance',
      value,
      unit: 'm',
    };
  }

  if (tool === 'measure-area' && entity.type === 'polyline') {
    const vertices = entity.vertices;
    return {
      type: 'measurement',
      points: [...vertices],
      mode: 'area',
      value: polygonArea(vertices),
      unit: 'm²',
    };
  }

  if (ANGLE_TOOLS.has(tool) && entity.type === 'angle-measurement') {
    return {
      type: 'measurement',
      points: [entity.vertex, entity.point1, entity.point2],
      mode: 'angle',
      value: entity.angle,
      unit: '°',
    };
  }

  return null;
}
