/**
 * HIT TESTING MODULE - Public API exports
 * ✅ ΦΑΣΗ 5: Spatial indexing και optimized hit-testing
 */

// Core classes
export { HitTester, createHitTester } from './HitTester';

// Bounds utilities
export {
  BoundsCalculator,
  BoundsOperations,
  ViewportBounds
} from './Bounds';

// Types
export type {
  BoundingBox,
  Point2D
} from './Bounds';

export type {
  HitTestOptions,
  HitTestResult,
  SnapResult
} from './HitTester';