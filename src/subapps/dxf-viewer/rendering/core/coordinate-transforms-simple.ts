/**
 * RENDERING CORE — SIMPLE COORDINATE TRANSFORMS (ADR-151)
 *
 * Standalone, Y-inversion-free world↔screen helpers. Extracted from
 * `CoordinateTransforms.ts` to keep that file under the Google SRP 500-line
 * limit, and re-exported from there for backward-compatible imports.
 *
 * PURPOSE: Eliminate scattered inline coordinate transform patterns like:
 *   x: point.x * transform.scale + transform.offsetX,
 *   y: point.y * transform.scale + transform.offsetY
 *
 * USE CASES: Overlay systems, visibility checks, bounding boxes (NO Y-inversion).
 * For CAD rendering with Y-inversion, use `CoordinateTransforms.worldToScreen()`.
 */

import type { Point2D, ViewTransform } from '../types/Types';

interface AxisAlignedBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 🏢 ADR-151: Simple world-to-screen coordinate transform (NO Y-inversion).
 * Use for overlay systems, visibility checks, and bounding box calculations
 * where Y-axis inversion is NOT needed.
 */
export function worldToScreenSimple(point: Point2D, transform: ViewTransform): Point2D {
  return {
    x: point.x * transform.scale + transform.offsetX,
    y: point.y * transform.scale + transform.offsetY,
  };
}

/**
 * 🏢 ADR-151: Simple screen-to-world coordinate transform (NO Y-inversion).
 * Inverse of `worldToScreenSimple`.
 */
export function screenToWorldSimple(point: Point2D, transform: ViewTransform): Point2D {
  return {
    x: (point.x - transform.offsetX) / transform.scale,
    y: (point.y - transform.offsetY) / transform.scale,
  };
}

/**
 * 🏢 ADR-151: Transform bounding box from world to screen (NO Y-inversion).
 * Converts all four corners; use for visibility checks and culling.
 */
export function transformBoundsToScreen(
  bounds: AxisAlignedBounds,
  transform: ViewTransform,
): AxisAlignedBounds {
  return {
    minX: bounds.minX * transform.scale + transform.offsetX,
    minY: bounds.minY * transform.scale + transform.offsetY,
    maxX: bounds.maxX * transform.scale + transform.offsetX,
    maxY: bounds.maxY * transform.scale + transform.offsetY,
  };
}

/**
 * 🏢 ADR-151: Transform bounding box from screen to world (NO Y-inversion).
 * Inverse of `transformBoundsToScreen`.
 */
export function transformBoundsToWorld(
  bounds: AxisAlignedBounds,
  transform: ViewTransform,
): AxisAlignedBounds {
  return {
    minX: (bounds.minX - transform.offsetX) / transform.scale,
    minY: (bounds.minY - transform.offsetY) / transform.scale,
    maxX: (bounds.maxX - transform.offsetX) / transform.scale,
    maxY: (bounds.maxY - transform.offsetY) / transform.scale,
  };
}

export const IDENTITY_COORDINATE_TRANSFORM = {
  worldToScreen: (point: Point2D): Point2D => point,
  screenToWorld: (point: Point2D): Point2D => point,
} as const;
