/**
 * 🎨 FLOOR PLAN RENDERING UTILITIES
 *
 * Pure rendering functions for GeoJSON features on canvas.
 * Extracted from FloorPlanCanvasLayer (ADR-065 file split).
 *
 * @module floor-plan-system/rendering/floor-plan-render-utils
 */

import { createModuleLogger } from '@/lib/telemetry';
import { GEO_COLORS } from '../../config/color-config';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { AffineTransformMatrix } from '../types';

const logger = createModuleLogger('FloorPlanRenderUtils');

// ===================================================================
// TYPES
// ===================================================================

/** Bounding box for floor plan features */
export interface FloorPlanBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Coordinate transform function: local (x,y) → canvas [px, py] */
export type CoordTransformFn = (x: number, y: number) => [number, number];

// ===================================================================
// COORDINATE TRANSFORMS
// ===================================================================

/**
 * Create a coordinate transform function based on available transformation data.
 *
 * If an affine transform matrix is provided, uses geo-projection via MapLibre.
 * Otherwise falls back to simple local scaling within the canvas.
 */
export function createCoordTransform(
  ctx: CanvasRenderingContext2D,
  map: MaplibreMap,
  bounds: FloorPlanBounds,
  transformMatrix?: AffineTransformMatrix | null
): CoordTransformFn {
  if (transformMatrix) {
    // ✅ Use affine transformation matrix: local (x, y) → geo (lng, lat) → map pixels
    return (x: number, y: number): [number, number] => {
      const lng = transformMatrix.a * x + transformMatrix.b * y + transformMatrix.c;
      const lat = transformMatrix.d * x + transformMatrix.e * y + transformMatrix.f;
      const point = map.project([lng, lat]);
      return [point.x, point.y];
    };
  }

  // ⚠️ FALLBACK: Simple local scaling (no transformation matrix)
  const canvas = ctx.canvas;
  const scale = Math.min(
    canvas.width / (bounds.maxX - bounds.minX),
    canvas.height / (bounds.maxY - bounds.minY)
  ) * 0.8;

  const offsetX = (canvas.width - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = (canvas.height - (bounds.maxY - bounds.minY) * scale) / 2;

  return (x: number, y: number): [number, number] => [
    (x - bounds.minX) * scale + offsetX,
    canvas.height - ((y - bounds.minY) * scale + offsetY) // Flip Y
  ];
}

// ===================================================================
// FEATURE RENDERING
// ===================================================================

/**
 * Render single GeoJSON feature
 *
 * STEP 2.3: Supports proper geo-transformation via affine matrix.
 */
export function renderFeature(
  ctx: CanvasRenderingContext2D,
  feature: GeoJSON.Feature,
  map: MaplibreMap,
  bounds: FloorPlanBounds,
  transformMatrix?: AffineTransformMatrix | null
): void {
  const geometry = feature.geometry;
  const transform = createCoordTransform(ctx, map, bounds, transformMatrix);

  switch (geometry.type) {
    case 'LineString':
      renderLineString(ctx, geometry, transform);
      break;

    case 'Polygon':
      renderPolygon(ctx, geometry, transform);
      break;

    case 'Point':
      // Skip points (TEXT entities) for now
      break;

    default:
      logger.warn(`Unsupported geometry type: ${geometry.type}`);
  }
}

/**
 * Render LineString geometry
 */
function renderLineString(
  ctx: CanvasRenderingContext2D,
  geometry: GeoJSON.LineString,
  transform: CoordTransformFn
): void {
  if (geometry.coordinates.length < 2) return;

  ctx.beginPath();

  const [startX, startY] = transform(
    geometry.coordinates[0][0],
    geometry.coordinates[0][1]
  );
  ctx.moveTo(startX, startY);

  for (let i = 1; i < geometry.coordinates.length; i++) {
    const [x, y] = transform(
      geometry.coordinates[i][0],
      geometry.coordinates[i][1]
    );
    ctx.lineTo(x, y);
  }

  ctx.stroke();
}

/**
 * Render Polygon geometry
 */
function renderPolygon(
  ctx: CanvasRenderingContext2D,
  geometry: GeoJSON.Polygon,
  transform: CoordTransformFn
): void {
  if (geometry.coordinates.length === 0 || geometry.coordinates[0].length < 3) {
    return;
  }

  ctx.beginPath();

  // Exterior ring
  const exteriorRing = geometry.coordinates[0];
  const [startX, startY] = transform(exteriorRing[0][0], exteriorRing[0][1]);
  ctx.moveTo(startX, startY);

  for (let i = 1; i < exteriorRing.length; i++) {
    const [x, y] = transform(exteriorRing[i][0], exteriorRing[i][1]);
    ctx.lineTo(x, y);
  }

  ctx.closePath();

  // Fill and stroke
  if (ctx.fillStyle !== GEO_COLORS.TRANSPARENT && ctx.globalAlpha > 0) {
    ctx.fill();
  }
  ctx.stroke();
}

// ===================================================================
// SNAP INDICATOR
// ===================================================================

/** Snap point in local DXF coordinates */
interface SnapPoint {
  x: number;
  y: number;
}

/**
 * Render snap indicator (crosshair + circles) at a snap point.
 *
 * Transforms from DXF local coordinates to canvas pixels,
 * then draws the AutoCAD-style snap indicator.
 */
export function renderSnapIndicator(
  ctx: CanvasRenderingContext2D,
  snapPoint: SnapPoint,
  canvas: HTMLCanvasElement,
  map: MaplibreMap,
  bounds: FloorPlanBounds,
  transformMatrix?: AffineTransformMatrix | null
): void {
  const indicatorColor = GEO_COLORS.CAD.CROSSHAIR_INDICATOR; // Cyan - AutoCAD standard
  const indicatorSize = 8;

  // Transform DXF local coordinates → canvas pixels
  let canvasSnapX: number;
  let canvasSnapY: number;

  if (transformMatrix) {
    const lng = transformMatrix.a * snapPoint.x + transformMatrix.b * snapPoint.y + transformMatrix.c;
    const lat = transformMatrix.d * snapPoint.x + transformMatrix.e * snapPoint.y + transformMatrix.f;
    const mapPoint = map.project([lng, lat]);
    canvasSnapX = mapPoint.x;
    canvasSnapY = mapPoint.y;
  } else {
    const scale = Math.min(
      canvas.width / (bounds.maxX - bounds.minX),
      canvas.height / (bounds.maxY - bounds.minY)
    ) * 0.8;
    const offsetX = (canvas.width - (bounds.maxX - bounds.minX) * scale) / 2;
    const offsetY = (canvas.height - (bounds.maxY - bounds.minY) * scale) / 2;

    canvasSnapX = (snapPoint.x - bounds.minX) * scale + offsetX;
    canvasSnapY = canvas.height - ((snapPoint.y - bounds.minY) * scale + offsetY);
  }

  console.debug('🎯 Rendering snap indicator:', {
    local: { x: snapPoint.x.toFixed(2), y: snapPoint.y.toFixed(2) },
    canvas: { x: canvasSnapX.toFixed(2), y: canvasSnapY.toFixed(2) }
  });

  ctx.save();

  // Outer circle (glow effect)
  ctx.beginPath();
  ctx.arc(canvasSnapX, canvasSnapY, indicatorSize + 2, 0, 2 * Math.PI);
  ctx.strokeStyle = indicatorColor;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5;
  ctx.stroke();

  // Inner circle (solid)
  ctx.beginPath();
  ctx.arc(canvasSnapX, canvasSnapY, indicatorSize, 0, 2 * Math.PI);
  ctx.strokeStyle = indicatorColor;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 1.0;
  ctx.stroke();

  // Crosshair lines
  const crosshairSize = indicatorSize + 5;
  ctx.beginPath();
  ctx.moveTo(canvasSnapX - crosshairSize, canvasSnapY);
  ctx.lineTo(canvasSnapX + crosshairSize, canvasSnapY);
  ctx.moveTo(canvasSnapX, canvasSnapY - crosshairSize);
  ctx.lineTo(canvasSnapX, canvasSnapY + crosshairSize);
  ctx.strokeStyle = indicatorColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.restore();
}
