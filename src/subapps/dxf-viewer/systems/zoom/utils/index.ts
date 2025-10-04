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
  isPointInBounds,
  unionBounds,
  clampScale,
  getNextZoomLevel,
  distance,
  getBoundsCenter,
  getViewportCenter
} from './calculations';

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