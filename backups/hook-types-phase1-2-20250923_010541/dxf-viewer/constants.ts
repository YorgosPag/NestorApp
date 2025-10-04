/**
 * @deprecated This file is a compatibility shim. 
 * Please migrate to importing directly from systems/rulers-grid/config.ts
 * This shim will be removed in v2.0.0
 */

import {
  coordTransforms as unifiedCoordTransforms,
  worldToScreen as unifiedWorldToScreen,
  screenToWorld as unifiedScreenToWorld,
  MARGINS,
  RULER_SIZE,
  type Point2D,
  type ViewTransform,
  type CanvasRect,
} from './systems/rulers-grid/config';

// Legacy compatibility types
export type Point = Point2D;
export type RectLike = { width: number; height: number };

// Compatibility wrappers for function signatures
/** @deprecated Use worldToScreen from systems/rulers-grid/config.ts */
export function worldToScreen(p: Point, t: ViewTransform, rect: RectLike): Point {
  return unifiedWorldToScreen(p, t, rect as CanvasRect);
}

/** @deprecated Use screenToWorld from systems/rulers-grid/config.ts */
export function screenToWorld(p: Point, t: ViewTransform, rect: RectLike): Point | null {
  return unifiedScreenToWorld(p, t, rect as CanvasRect);
}

// Compatibility object with wrapped functions
/** @deprecated Use coordTransforms from systems/rulers-grid/config.ts */
export const coordTransforms = {
  worldToScreen,
  screenToWorld
};

// Direct re-exports for simple constants
/** @deprecated Use RULER_SIZE from systems/rulers-grid/config.ts */
export { RULER_SIZE };

/** @deprecated Use MARGINS from systems/rulers-grid/config.ts */
export { MARGINS };

import { HIT_TEST_RADIUS_PX, CALIB_TOLERANCE_PX } from './config/tolerance-config';

// Re-export tolerance constants from central config
export { HIT_TEST_RADIUS_PX, CALIB_TOLERANCE_PX };

// Local constants (not in tolerance system)
export const RULER_LEFT_PAD = 30;
export const RULER_BOTTOM_PAD = 30;