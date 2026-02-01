/**
 * 🏢 ENTERPRISE: Centralized Geometry Constants
 * ADR-118: Zero Point Pattern Centralization
 *
 * Single Source of Truth για zero points, origin markers, και bounds constants.
 * Αντικαθιστά 74 διάσπαρτες επαναλήψεις του { x: 0, y: 0 } σε 41 αρχεία.
 *
 * @see docs/centralized-systems/reference/adr-index.md#adr-118
 */

import type { Point2D, BoundingBox } from '../rendering/types/Types';

// ============================================================================
// 🌍 ZERO POINTS - Semantic Constants
// ============================================================================

/**
 * 🌍 WORLD_ORIGIN - Reference point (0,0) in world coordinate system
 *
 * Use for:
 * - Coordinate transforms
 * - Grid/ruler rendering
 * - Origin markers
 * - World space calculations
 *
 * @example
 * const gridOrigin = WORLD_ORIGIN; // Reference point for grid
 * const markerPosition = WORLD_ORIGIN; // Origin marker location
 */
export const WORLD_ORIGIN: Readonly<Point2D> = Object.freeze({ x: 0, y: 0 });

/**
 * 📊 ZERO_VECTOR - Generic zero point (immutable)
 *
 * Use for:
 * - Return values from functions
 * - Error fallbacks
 * - Geometric calculations (accumulator initialization)
 * - Test data
 *
 * @example
 * function getCenter(): Point2D {
 *   if (!hasEntities) return ZERO_VECTOR;
 *   // ...
 * }
 */
export const ZERO_VECTOR: Readonly<Point2D> = Object.freeze({ x: 0, y: 0 });

/**
 * 🚀 ZERO_DELTA - Zero movement/displacement vector
 *
 * Use for:
 * - Movement tracking initialization
 * - Delta calculations
 * - Displacement vectors
 *
 * Note: For mutable state (React useState), use spread: { ...ZERO_DELTA }
 *
 * @example
 * const [totalDelta, setTotalDelta] = useState({ ...ZERO_DELTA });
 */
export const ZERO_DELTA: Readonly<Point2D> = Object.freeze({ x: 0, y: 0 });

// ============================================================================
// 📦 BOUNDS CONSTANTS
// ============================================================================

/**
 * 📦 EMPTY_BOUNDS - Zero-size bounding box
 *
 * Use for:
 * - Empty entity lists
 * - Initial bounds state
 * - Fallback when no entities exist
 *
 * @example
 * const bounds = entities.length === 0 ? EMPTY_BOUNDS : calculateBounds(entities);
 */
export const EMPTY_BOUNDS: Readonly<BoundingBox> = Object.freeze({
  min: Object.freeze({ x: 0, y: 0 }),
  max: Object.freeze({ x: 0, y: 0 })
});

/**
 * 🎯 DEFAULT_BOUNDS - Standard placeholder bounds (100x100)
 *
 * Use for:
 * - Mock implementations
 * - Fallback bounds when actual bounds unknown
 * - Test fixtures
 *
 * @example
 * const mockEntity = { bounds: DEFAULT_BOUNDS };
 */
export const DEFAULT_BOUNDS: Readonly<BoundingBox> = Object.freeze({
  min: Object.freeze({ x: 0, y: 0 }),
  max: Object.freeze({ x: 100, y: 100 })
});

// ============================================================================
// 🔧 UTILITY FUNCTIONS
// ============================================================================

/**
 * Creates a mutable copy of ZERO_VECTOR for state initialization
 *
 * Use when you need a fresh mutable point (e.g., for React state)
 *
 * @example
 * const [position, setPosition] = useState(createZeroPoint());
 */
export function createZeroPoint(): Point2D {
  return { x: 0, y: 0 };
}

/**
 * Creates a mutable copy of EMPTY_BOUNDS for state initialization
 *
 * @example
 * const [bounds, setBounds] = useState(createEmptyBounds());
 */
export function createEmptyBounds(): BoundingBox {
  return {
    min: { x: 0, y: 0 },
    max: { x: 0, y: 0 }
  };
}

/**
 * Checks if a point is at the origin (0, 0)
 *
 * @example
 * if (isAtOrigin(point)) {
 *   // Handle origin case
 * }
 */
export function isAtOrigin(point: Point2D): boolean {
  return point.x === 0 && point.y === 0;
}

/**
 * Checks if bounds are empty (zero size)
 *
 * @example
 * if (isEmptyBounds(bounds)) {
 *   return EMPTY_BOUNDS;
 * }
 */
export function isEmptyBounds(bounds: BoundingBox): boolean {
  return (
    bounds.min.x === 0 &&
    bounds.min.y === 0 &&
    bounds.max.x === 0 &&
    bounds.max.y === 0
  );
}

// ============================================================================
// 📚 BACKWARD COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use WORLD_ORIGIN instead
 * Kept for backward compatibility with rulers-grid system
 */
export const DEFAULT_ORIGIN: Readonly<Point2D> = WORLD_ORIGIN;
