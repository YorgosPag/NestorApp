/**
 * Geometry utilities for DXF entity processing
 * Handles arc tessellation, segment chaining, and geometric calculations
 */

import { Point2D } from '../../types/shared';

export const GEOMETRY_CONSTANTS = {
  EPS: 1e-3, // Relaxed tolerance for better entity matching
  GAP_TOLERANCE: 0.5, // Allow moderate gaps between entities (CAD units)
  DEFAULT_ARC_SEGMENTS: 24
} as const;

// Point2D imported from shared types

export interface Segment {
  start: Point2D;
  end: Point2D;
}

export interface Arc {
  center: Point2D;
  radius: number;
  startAngle?: number;
  endAngle?: number;
}

/**
 * Check if two numbers are approximately equal
 */
export function approximatelyEqual(a: number, b: number, tolerance = GEOMETRY_CONSTANTS.EPS): boolean {
  return Math.abs(a - b) < tolerance;
}

/**
 * Check if two points are the same within tolerance
 */
export function samePoint(p: Point2D, q: Point2D): boolean {
  return approximatelyEqual(p.x, q.x) && approximatelyEqual(p.y, q.y);
}

/**
 * Check if two points are near each other within gap tolerance
 */
export function nearPoint(p: Point2D, q: Point2D): boolean {
  const dist = Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
  return dist <= GEOMETRY_CONSTANTS.GAP_TOLERANCE;
}

/**
 * Calculate distance between two points
 */
export function distance(p: Point2D, q: Point2D): number {
  return Math.sqrt((p.x - q.x) ** 2 + (p.y - q.y) ** 2);
}

/**
 * Convert arc to polyline vertices
 */
export function arcToPolyline(arc: Arc, segments: number = GEOMETRY_CONSTANTS.DEFAULT_ARC_SEGMENTS): Point2D[] {
  if (!arc.center || typeof arc.radius !== 'number') return [];

  const { center, radius } = arc;

  // DXF angles are in DEGREES (counter-clockwise). Convert to RADIANS.
  const deg2rad = (d: number) => (d * Math.PI) / 180;

  let start = deg2rad(arc.startAngle ?? 0);
  let end = deg2rad(arc.endAngle ?? 0);

  console.log(`Arc conversion: startAngle=${arc.startAngle}° -> ${start.toFixed(3)} rad, endAngle=${arc.endAngle}° -> ${end.toFixed(3)} rad`);
  console.log(`Arc center:(${center.x.toFixed(3)}, ${center.y.toFixed(3)}) radius:${radius.toFixed(3)}`);

  // Normalize to ensure end > start within [0, 2π)
  const TAU = Math.PI * 2;
  start = ((start % TAU) + TAU) % TAU;
  end = ((end % TAU) + TAU) % TAU;
  if (end <= start) end += TAU;

  const span = end - start;
  const steps = Math.max(2, segments);
  const step = span / steps;

  const verts: Point2D[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + i * step;
    const x = center.x + radius * Math.cos(a);
    const y = center.y + radius * Math.sin(a);
    
    // Drop consecutive duplicates
    if (verts.length === 0 || Math.hypot(x - verts[verts.length - 1].x, y - verts[verts.length - 1].y) > 1e-6) {
      verts.push({ x, y });
    }
  }
  
  console.log(`Arc tessellation complete: ${verts.length} vertices from ${start.toFixed(3)} to ${end.toFixed(3)} rad`);
  if (verts.length > 0) {
    console.log(`  First vertex: (${verts[0].x.toFixed(3)}, ${verts[0].y.toFixed(3)})`);
    console.log(`  Last vertex: (${verts[verts.length - 1].x.toFixed(3)}, ${verts[verts.length - 1].y.toFixed(3)})`);
  }
  
  return verts;
}

/**
 * Convert entity to segments based on type
 */
export function entityToSegments(entity: any): Segment[] {
  if (entity.type === 'line') {
    return [{ start: entity.start, end: entity.end }];
  }
  
  if (entity.type === 'polyline') {
    const vs = entity.vertices || [];
    const segs: Segment[] = [];
    
    for (let i = 0; i < vs.length - 1; i++) {
      segs.push({ start: vs[i], end: vs[i + 1] });
    }
    
    if (entity.closed && vs.length > 2) {
      segs.push({ start: vs[vs.length - 1], end: vs[0] });
    }
    
    return segs;
  }
  
  if (entity.type === 'arc') {
    const vertices = arcToPolyline(entity);
    const segs: Segment[] = [];
    
    for (let i = 0; i < vertices.length - 1; i++) {
      segs.push({ start: vertices[i], end: vertices[i + 1] });
    }
    
    return segs;
  }
  
  return [];
}

/**
 * Debug helper to log segment endpoints
 */
export function debugSegments(segs: Segment[], label: string): void {
  console.log(`🔍 ${label} segments (${segs.length}):`);
  segs.forEach((seg, i) => {
    console.log(`  [${i}] start:(${seg.start.x.toFixed(3)}, ${seg.start.y.toFixed(3)}) end:(${seg.end.x.toFixed(3)}, ${seg.end.y.toFixed(3)})`);
  });
}