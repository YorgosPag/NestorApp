/**
 * ✅ ΦΑΣΗ 7: Compatibility shim updated to use unified coordinate transforms
 * @deprecated This file is a compatibility shim.
 * Please migrate to importing directly from rendering/core/CoordinateTransforms.ts
 * This shim will be removed in v2.0.0
 */

// CoordinateTransforms import removed - use direct import from rendering/core/CoordinateTransforms.ts
import {
  MARGINS,
  RULER_SIZE,
} from './systems/rulers-grid/config';
// Point2D, ViewTransform, Viewport imports removed - not needed anymore

// Legacy compatibility types
export type RectLike = { width: number; height: number };

// ✅ DEPRECATED COORDINATE FUNCTIONS REMOVED
// Use CoordinateTransforms directly from rendering/core/CoordinateTransforms.ts

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