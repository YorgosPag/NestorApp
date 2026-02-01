/**
 * ZOOM SYSTEM - UTILITIES INDEX
 * Export όλων των zoom utilities
 */

// === CALCULATIONS ===
export {
  // ❌ REMOVED: calculateZoomTransform - Use CoordinateTransforms.calculateZoomTransform() instead (single source of truth)
  // ❌ REMOVED: screenToWorld, worldToScreen - Use CoordinateTransforms.screenToWorld/worldToScreen() instead
  calculateFitTransform,
  calculateNormalizedTransform,
  getVisibleBounds,
  // ⚠️ DEPRECATED: isPointInBounds - Use SpatialUtils.pointInRect() directly (ADR-089)
  isPointInBounds,
  unionBounds,
  clampScale,
  getNextZoomLevel,
  distance,
  getBoundsCenter,
  getViewportCenter
} from './calculations';

// 🏢 ADR-089: Re-export SpatialUtils for point-in-bounds operations
export { SpatialUtils } from '../../../core/spatial/SpatialUtils';

// === BOUNDS ===
export {
  createBoundsFromPoints,
  createBoundsFromDxfScene,
  createBoundsFromLayers,
  createCombinedBounds,
  isValidBounds,
  hasMinimumSize,
  expandBounds,
  normalizeBounds,
  getBoundsDimensions,
  getBoundsAspectRatio,
  getDefaultBounds,
  getViewportBounds
} from './bounds';