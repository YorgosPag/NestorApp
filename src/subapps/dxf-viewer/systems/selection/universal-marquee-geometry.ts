import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import type { Point2D, ViewTransform, Viewport } from '../../rendering/types/Types';
import type { ColorLayer } from '../../canvas-v2/layer-canvas/layer-types';
import { calculateVerticesBounds, isPointInPolygon, segmentsIntersect } from '../../utils/geometry/GeometryUtils';
// 🏢 ADR-089: Centralized Point-In-Bounds
import { SpatialUtils } from '../../core/spatial/SpatialUtils';

export function selectItemsInMarquee(
  items: Array<{ id: string, vertices: Point2D[] }>,
  marqueeBounds: { min: Point2D, max: Point2D },
  isCrossing: boolean,
  tolerance: number,
  itemType: string,
  enableDebugLogs: boolean,
  transform: ViewTransform,
  viewport: Viewport
): string[] {
  const selectedIds: string[] = [];

  for (const item of items) {
    // 🔥 FIX: Convert world coordinates to screen coordinates before calculating bounds
    const screenVertices = item.vertices.map(vertex =>
      CoordinateTransforms.worldToScreen(vertex, transform, viewport)
    );
    const itemBounds = calculateVerticesBounds(screenVertices);
    if (!itemBounds) continue;

    let selected = false;

    if (isCrossing) {
      // 🏢 ENTERPRISE (2026-01-25): Use accurate polygon-to-rectangle intersection
      selected = polygonIntersectsRectangle(screenVertices, marqueeBounds);
    } else {
      selected = isFullyInsideWithTolerance(itemBounds, marqueeBounds, tolerance);
    }

    if (selected) {
      selectedIds.push(item.id);
    }

    if (enableDebugLogs) {
      console.log(`🎯 ${isCrossing ? 'CROSSING' : 'WINDOW'} [${itemType} ${item.id}]:`, {
        itemBounds,
        marqueeScreenBounds: marqueeBounds,
        worldVertices: item.vertices.slice(0, 3),
        screenVertices: screenVertices.slice(0, 3),
        selected
      });
    }
  }

  return selectedIds;
}

export function selectColorLayersInMarquee(
  layers: ColorLayer[],
  marqueeBounds: { min: Point2D, max: Point2D },
  isCrossing: boolean,
  tolerance: number,
  enableDebugLogs: boolean,
  transform: ViewTransform,
  viewport: Viewport
): string[] {
  const selectedIds: string[] = [];

  for (const layer of layers) {
    if (!layer.visible) continue;

    let layerSelected = false;

    for (const polygon of layer.polygons) {
      // 🔥 RE-FIXED: Polygon vertices are in WORLD coordinates, must transform to screen
      const screenVertices = polygon.vertices.map(vertex =>
        CoordinateTransforms.worldToScreen(vertex, transform, viewport)
      );
      const polygonBounds = calculateVerticesBounds(screenVertices);
      if (!polygonBounds) continue;

      let selected = false;

      if (isCrossing) {
        selected = polygonIntersectsRectangle(screenVertices, marqueeBounds);
      } else {
        selected = isFullyInsideWithTolerance(polygonBounds, marqueeBounds, tolerance);
      }

      if (selected) {
        layerSelected = true;
        break;
      }

      if (enableDebugLogs) {
        console.log(`🎯 ${isCrossing ? 'CROSSING' : 'WINDOW'} [Layer ${layer.id}, Polygon ${polygon.id}]:`, {
          polygonBounds,
          marqueeScreenBounds: marqueeBounds,
          worldVertices: polygon.vertices.slice(0, 3),
          screenVertices: screenVertices.slice(0, 3),
          selected
        });
      }
    }

    if (layerSelected) {
      selectedIds.push(layer.id);
      if (enableDebugLogs) {
        console.log(`🎯 LAYER SELECTED: ${layer.id}`);
      }
    }
  }

  return selectedIds;
}

export function boundsIntersect(
  bounds1: { min: Point2D, max: Point2D },
  bounds2: { min: Point2D, max: Point2D }
): boolean {
  return !(
    bounds1.max.x < bounds2.min.x ||
    bounds1.min.x > bounds2.max.x ||
    bounds1.max.y < bounds2.min.y ||
    bounds1.min.y > bounds2.max.y
  );
}

export function polygonIntersectsRectangle(
  polygonVertices: Point2D[],
  rectBounds: { min: Point2D, max: Point2D }
): boolean {
  if (polygonVertices.length < 3) return false;

  // 1. Check if any polygon vertex is inside the rectangle
  // 🏢 ADR-089: Centralized Point-In-Bounds
  for (const vertex of polygonVertices) {
    if (SpatialUtils.pointInRect(vertex, rectBounds)) {
      return true;
    }
  }

  // 2. Check if any polygon edge intersects the rectangle
  for (let i = 0; i < polygonVertices.length; i++) {
    const p1 = polygonVertices[i];
    const p2 = polygonVertices[(i + 1) % polygonVertices.length];

    if (lineIntersectsRectangle(p1, p2, rectBounds)) {
      return true;
    }
  }

  // 3. Check if rectangle center is inside the polygon (rectangle entirely inside polygon)
  const rectCenter: Point2D = {
    x: (rectBounds.min.x + rectBounds.max.x) / 2,
    y: (rectBounds.min.y + rectBounds.max.y) / 2
  };
  return isPointInPolygon(rectCenter, polygonVertices);
}

export function lineIntersectsRectangle(
  p1: Point2D,
  p2: Point2D,
  rect: { min: Point2D, max: Point2D }
): boolean {
  const rectCorners = [
    { x: rect.min.x, y: rect.min.y },
    { x: rect.max.x, y: rect.min.y },
    { x: rect.max.x, y: rect.max.y },
    { x: rect.min.x, y: rect.max.y }
  ];

  for (let i = 0; i < 4; i++) {
    const r1 = rectCorners[i];
    const r2 = rectCorners[(i + 1) % 4];
    if (segmentsIntersect(p1, p2, r1, r2)) {
      return true;
    }
  }

  return false;
}

export function isFullyInsideWithTolerance(
  itemBounds: { min: Point2D, max: Point2D },
  marqueeBounds: { min: Point2D, max: Point2D },
  tolerance: number
): boolean {
  const itemWidth = itemBounds.max.x - itemBounds.min.x;
  const itemHeight = itemBounds.max.y - itemBounds.min.y;

  if (itemWidth < tolerance || itemHeight < tolerance) {
    return boundsIntersect(itemBounds, marqueeBounds);
  }

  return (
    itemBounds.min.x >= marqueeBounds.min.x &&
    itemBounds.max.x <= marqueeBounds.max.x &&
    itemBounds.min.y >= marqueeBounds.min.y &&
    itemBounds.max.y <= marqueeBounds.max.y
  );
}
