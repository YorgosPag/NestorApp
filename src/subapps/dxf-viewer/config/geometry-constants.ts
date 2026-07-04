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

// ============================================================================
// 🏢 ADR-158: INFINITY BOUNDS INITIALIZATION
// ============================================================================

/**
 * 🏢 ADR-158: Infinity Bounds structure for accumulation algorithms
 *
 * Use for iterating points/entities to find min/max values.
 * The Infinity pattern ensures first point always wins.
 */
export interface InfinityBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 🏢 ADR-158: Creates bounds initialized with Infinity for accumulation
 *
 * Use when iterating points/entities to find min/max values.
 * Pattern: minX/minY start at +Infinity, maxX/maxY start at -Infinity
 * so that any real value will immediately become the new min/max.
 *
 * @returns Fresh InfinityBounds object for accumulation
 *
 * @example
 * const bounds = createInfinityBounds();
 * for (const point of points) {
 *   bounds.minX = Math.min(bounds.minX, point.x);
 *   bounds.minY = Math.min(bounds.minY, point.y);
 *   bounds.maxX = Math.max(bounds.maxX, point.x);
 *   bounds.maxY = Math.max(bounds.maxY, point.y);
 * }
 * // Now bounds contains the tight bounding box of all points
 */
export function createInfinityBounds(): InfinityBounds {
  return {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  };
}

/**
 * 🏢 ADR-158: Check if bounds are still at initial Infinity state
 *
 * After creating with createInfinityBounds(), if no points were processed,
 * the bounds will still be at Infinity. This checks for that state.
 *
 * @param bounds - The bounds to check
 * @returns true if bounds are still at Infinity (no points processed)
 */
export function isInfinityBounds(bounds: InfinityBounds): boolean {
  return bounds.minX === Infinity;
}

/**
 * 🛡️ ADR-510 Φ5 — True iff all four bounds fields are FINITE (no NaN / ±Infinity).
 *
 * WHY (Bug 2 root cause): a single NON-FINITE entity must never poison an
 * AGGREGATE bounds fold. `Math.min/max` with `NaN` yields `NaN`, so one bad
 * entity turns the whole index bounds into NaN → `sanitizeBounds` collapses it
 * to `{0,0,0,0}` → EVERY real entity is rejected as "outside index bounds" →
 * hit-test / snap index empty → hover dead + ghost/snap dead. Callers skip an
 * entity/point whose coords are non-finite BEFORE folding it into the aggregate.
 */
export function isFiniteBounds(bounds: { minX: number; minY: number; maxX: number; maxY: number }): boolean {
  return Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY)
    && Number.isFinite(bounds.maxX) && Number.isFinite(bounds.maxY);
}

/** 🛡️ ADR-510 Φ5 — True iff both point coords are finite (aggregate-poisoning guard). */
export function isFinitePoint(p: { x: number; y: number }): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

// ============================================================================
// 📦 ADR-034: EMPTY_SPATIAL_BOUNDS CONSOLIDATION
// ============================================================================

/**
 * 📦 EMPTY_SPATIAL_BOUNDS - Zero-size spatial bounds (SpatialBounds format)
 *
 * Use for:
 * - Empty entity lists (getEntityBounds fallback)
 * - Spatial index empty results
 * - calculateBoundingBox empty array
 * - boundsFromPoints empty array fallback
 *
 * 🏢 ADR-034: Centralized empty bounds for SpatialBounds format
 * Consolidates 9 inline instances of { minX: 0, minY: 0, maxX: 0, maxY: 0 }
 *
 * @see EMPTY_BOUNDS for BoundingBox format ({ min: Point2D, max: Point2D })
 *
 * @example
 * if (entities.length === 0) return EMPTY_SPATIAL_BOUNDS;
 * if (points.length === 0) return EMPTY_SPATIAL_BOUNDS;
 */
export const EMPTY_SPATIAL_BOUNDS: Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}> = Object.freeze({
  minX: 0,
  minY: 0,
  maxX: 0,
  maxY: 0
});
