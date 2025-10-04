// overlay-utils.ts
import type { Point2D } from '../overlays/types';

// Note: pointInPolygon and distanceToLineSegment functions removed as unused (ts-prune detected)

export function worldToScreen(point: [number, number], transform: { scale: number; offsetX: number; offsetY: number }): [number, number] {
  return [
    point[0] * transform.scale + transform.offsetX,
    point[1] * transform.scale + transform.offsetY
  ];
}

export function screenToWorld(point: Point2D, transform: { scale: number; offsetX: number; offsetY: number }): Point2D {
  return {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale
  };
}